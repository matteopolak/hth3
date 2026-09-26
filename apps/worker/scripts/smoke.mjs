import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const workerDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = await availablePort();
const baseUrl = `http://127.0.0.1:${port}`;
const idempotencyKey = crypto.randomUUID();
const payload = { value: `smoke-${idempotencyKey}` };

await run("node", [
  "scripts/wrangler.mjs",
  "d1",
  "migrations",
  "apply",
  "civicresolve-local",
  "--local",
]);

try {
  let child = await startWorker();
  try {
    await waitForHealth(child);
    const first = await postSmokeEvent();
    const retry = await postSmokeEvent();
    assert(
      first.status === 201 && retry.status === 200,
      "first write and retry returned expected statuses",
    );
    assert(
      first.body.eventId === retry.body.eventId,
      "retry reused the original event ID",
    );
    assert(retry.body.replayed === true, "retry was marked as a replay");
    await stopWorker(child);
    child = await startWorker();
    await waitForHealth(child);
    const persisted = await fetch(
      `${baseUrl}/api/v1/_local/smoke/outbox/${first.body.eventId}`,
    );
    const saved = await persisted.json();
    assert(persisted.status === 200, "outbox event survived a Worker restart");
    assert(
      saved.event.payload.value === payload.value,
      "persisted outbox payload matches the request",
    );
    console.log(
      "Local D1 migration and Worker outbox smoke passed: retry was idempotent and the event survived a Worker restart.",
    );
  } finally {
    await stopWorker(child);
  }
} catch (error) {
  throw new Error(`Worker smoke failed: ${error.message}`);
}

async function startWorker() {
  const child = spawn(
    "node",
    [
      "scripts/wrangler.mjs",
      "dev",
      "--local",
      "--ip",
      "127.0.0.1",
      "--port",
      String(port),
      "--persist-to",
      ".wrangler/state",
    ],
    {
      cwd: workerDirectory,
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let diagnostics = "";
  const capture = (chunk) => {
    diagnostics = (diagnostics + chunk).slice(-3000);
  };
  child.stdout.setEncoding("utf8").on("data", capture);
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", capture);
  child.diagnostics = () => diagnostics;
  return child;
}

async function waitForHealth(child) {
  const deadline = Date.now() + 30000;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `Wrangler exited before health check: ${child.diagnostics()}`,
      );
    }
    try {
      const response = await fetch(`${baseUrl}/api/healthz`);
      if (response.ok) return;
      lastError = new Error(`health endpoint returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw new Error(
    `Worker did not become healthy: ${lastError?.message ?? "timeout"}. ${child.diagnostics()}`,
  );
}

async function postSmokeEvent() {
  const response = await fetch(`${baseUrl}/api/v1/_local/smoke/outbox`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
  return { status: response.status, body: await response.json() };
}

async function stopWorker(child) {
  if (!child || child.killed || child.exitCode !== null) return;
  child.kill("SIGTERM");
  const exited = await Promise.race([
    new Promise((resolveExit) => child.once("exit", () => resolveExit(true))),
    delay(5000).then(() => false),
  ]);
  if (!exited) child.kill("SIGKILL");
}

async function run(command, args) {
  await new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: workerDirectory,
      stdio: "inherit",
    });
    child.once("error", rejectRun);
    child.once("exit", (code) => {
      if (code === 0) resolveRun();
      else
        rejectRun(
          new Error(`${command} ${args.join(" ")} exited with ${code}`),
        );
    });
  });
}

async function availablePort() {
  const server = createServer();
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Could not allocate a local port.");
  await new Promise((resolveClose) => server.close(resolveClose));
  return address.port;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
