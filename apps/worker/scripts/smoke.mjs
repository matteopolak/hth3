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
const smokePostingId = `sample-smoke-${crypto.randomUUID()}`;
const receiptToken = Buffer.from(
  crypto.getRandomValues(new Uint8Array(32)),
).toString("hex");
const feedbackIdempotencyKey = crypto.randomUUID();
const applicationIdempotencyKey = crypto.randomUUID();
let feedbackSubmissionId;
let applicationId;

await run("node", [
  "scripts/wrangler.mjs",
  "d1",
  "migrations",
  "apply",
  "civicresolve-local",
  "--local",
]);
await run("node", [
  "scripts/wrangler.mjs",
  "d1",
  "execute",
  "civicresolve-local",
  "--local",
  "--file",
  "scripts/local-authz-seed.sql",
]);
await run("node", [
  "scripts/wrangler.mjs",
  "d1",
  "execute",
  "civicresolve-local",
  "--local",
  "--command",
  `INSERT INTO postings (id, organization_id, title, description, location_name, sample, status, created_at, updated_at) VALUES ('${smokePostingId}', 'org_43G1B1RhPwac7EjS', 'Sample: Local smoke employer review', 'Fictional posting created for the local acceptance check.', 'Toronto, Ontario (sample geography)', 1, 'published', '2026-09-26T00:00:00.000Z', '2026-09-26T00:00:00.000Z')`,
]);

let child;
try {
  child = await startWorker();
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
    await assertAuthorization(
      "dev-civic-staff",
      "feedback:read_organization",
      "org_43G1B1RhPwac7EjS",
      200,
    );
    await assertAuthorization(
      "dev-civic-staff",
      "feedback:read_organization",
      "org_local_other",
      403,
    );
    await assertAuthorization(
      "dev-other-civic-staff",
      "feedback:read_organization",
      "org_43G1B1RhPwac7EjS",
      403,
    );
    await assertAuthorization(
      "dev-applicant",
      "feedback:read_organization",
      "org_43G1B1RhPwac7EjS",
      403,
    );
    await assertAuthorization(
      "dev-applicant",
      "application:create_own",
      null,
      200,
    );
    await assertAuthorization(
      "dev-hiring-reviewer",
      "application:review_organization",
      "org_43G1B1RhPwac7EjS",
      200,
    );
    await assertAuthorization(
      "dev-hiring-reviewer",
      "feedback:read_organization",
      "org_43G1B1RhPwac7EjS",
      403,
    );

    const publicPostings = await fetch(`${baseUrl}/api/v1/postings`);
    const postingBody = await publicPostings.json();
    assert(publicPostings.status === 200, "sample posting list is public");
    assert(
      postingBody.postings.some((posting) => posting.sample === true),
      "public posting is explicitly labeled as sample",
    );

    const guestFeedback = await requestApi("/api/v1/feedback", {
      method: "POST",
      headers: {
        "Idempotency-Key": feedbackIdempotencyKey,
        "X-Receipt-Token": receiptToken,
      },
      body: { message: "The sample streetlight is out near the library." },
    });
    assert(
      guestFeedback.status === 201,
      `guest feedback is accepted (${guestFeedback.status}): ${JSON.stringify(guestFeedback.body)}`,
    );
    assert(
      guestFeedback.body.submission.sample === true,
      "guest receipt identifies the fictional sample destination",
    );
    feedbackSubmissionId = guestFeedback.body.submission.id;
    const privateReceipt = await requestApi(
      `/api/v1/feedback/receipts/${feedbackSubmissionId}`,
      { headers: { "X-Receipt-Token": receiptToken } },
    );
    assert(privateReceipt.status === 200, "receipt token opens its receipt");
    const wrongReceipt = await requestApi(
      `/api/v1/feedback/receipts/${feedbackSubmissionId}`,
      { headers: { "X-Receipt-Token": "0".repeat(64) } },
    );
    assert(
      wrongReceipt.status === 404,
      "wrong receipt token reveals no record",
    );
    const staffFeedbackList = await requestApi(
      "/api/v1/staff/organizations/org_43G1B1RhPwac7EjS/feedback",
      { token: "dev-civic-staff" },
    );
    assert(
      staffFeedbackList.status === 200,
      "sandbox civic staff can read feedback",
    );
    assert(
      staffFeedbackList.body.submissions.some(
        (submission) => submission.id === feedbackSubmissionId,
      ),
      "staff feedback queue includes the saved sample report",
    );
    const invalidFeedbackTransition = await requestApi(
      `/api/v1/staff/organizations/org_43G1B1RhPwac7EjS/feedback/${feedbackSubmissionId}/status`,
      {
        method: "PATCH",
        token: "dev-civic-staff",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: { status: "closed" },
      },
    );
    assert(
      invalidFeedbackTransition.status === 409,
      "invalid feedback transition is rejected",
    );
    const staffFeedbackMessage = await requestApi(
      `/api/v1/staff/organizations/org_43G1B1RhPwac7EjS/feedback/${feedbackSubmissionId}/messages`,
      {
        method: "POST",
        token: "dev-civic-staff",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: {
          message: "The fictional sandbox team has received this report.",
        },
      },
    );
    assert(
      staffFeedbackMessage.status === 200,
      "staff can respond to feedback",
    );
    for (const status of ["acknowledged", "in_review"]) {
      const update = await requestApi(
        `/api/v1/staff/organizations/org_43G1B1RhPwac7EjS/feedback/${feedbackSubmissionId}/status`,
        {
          method: "PATCH",
          token: "dev-civic-staff",
          headers: { "Idempotency-Key": crypto.randomUUID() },
          body: { status },
        },
      );
      assert(update.status === 200, `feedback can transition to ${status}`);
    }
    const residentMessage = await requestApi(
      `/api/v1/feedback/receipts/${feedbackSubmissionId}/messages`,
      {
        method: "POST",
        headers: {
          "Idempotency-Key": crypto.randomUUID(),
          "X-Receipt-Token": receiptToken,
        },
        body: { message: "Thank you. I can share the nearest intersection." },
      },
    );
    assert(residentMessage.status === 200, "receipt owner can add a follow-up");

    const missingConfirmation = await requestApi("/api/v1/applications", {
      method: "POST",
      token: "dev-applicant",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: {
        postingId: smokePostingId,
        answers: { experience: "Sample answer" },
        confirmedByApplicant: false,
      },
    });
    assert(
      missingConfirmation.status === 400,
      "application is not submitted without explicit applicant confirmation",
    );
    const submitted = await requestApi("/api/v1/applications", {
      method: "POST",
      token: "dev-applicant",
      headers: { "Idempotency-Key": applicationIdempotencyKey },
      body: {
        postingId: smokePostingId,
        answers: {
          experience: "Fictional sample answer",
          availability: "Sample schedule",
        },
        confirmedByApplicant: true,
      },
    });
    assert(
      submitted.status === 201,
      "confirmed applicant submission is persisted",
    );
    assert(
      submitted.body.application.sample === true,
      "application is labeled sample",
    );
    applicationId = submitted.body.application.id;
    const applicantStatus = await requestApi("/api/v1/applications", {
      token: "dev-applicant",
    });
    assert(
      applicantStatus.body.applications.some(
        (item) => item.id === applicationId,
      ),
      "applicant sees their own application",
    );
    const staffApplicationQueue = await requestApi(
      "/api/v1/staff/organizations/org_43G1B1RhPwac7EjS/applications",
      { token: "dev-hiring-reviewer" },
    );
    assert(
      staffApplicationQueue.status === 200,
      "hiring reviewer can read employer queue",
    );
    assert(
      staffApplicationQueue.body.applications.some(
        (item) => item.id === applicationId,
      ),
      "employer queue contains the persisted applicant submission",
    );
    const civicApplicationQueue = await requestApi(
      "/api/v1/staff/organizations/org_43G1B1RhPwac7EjS/applications",
      { token: "dev-civic-staff" },
    );
    assert(
      civicApplicationQueue.status === 403,
      "civic staff cannot read applications",
    );
    const otherOrgQueue = await requestApi(
      "/api/v1/staff/organizations/org_local_other/applications",
      { token: "dev-hiring-reviewer" },
    );
    assert(
      otherOrgQueue.status === 403,
      "reviewer cannot access another organization",
    );
    const staffOwnerRead = await requestApi(
      `/api/v1/applications/${applicationId}`,
      { token: "dev-hiring-reviewer" },
    );
    assert(
      staffOwnerRead.status === 403,
      "staff cannot use the applicant owner route",
    );
    const invalidApplicationTransition = await requestApi(
      `/api/v1/staff/organizations/org_43G1B1RhPwac7EjS/applications/${applicationId}/status`,
      {
        method: "PATCH",
        token: "dev-hiring-reviewer",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: { status: "offer" },
      },
    );
    assert(
      invalidApplicationTransition.status === 409,
      "invalid application transition is rejected",
    );
    const reviewed = await requestApi(
      `/api/v1/staff/organizations/org_43G1B1RhPwac7EjS/applications/${applicationId}/status`,
      {
        method: "PATCH",
        token: "dev-hiring-reviewer",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: { status: "under_review" },
      },
    );
    assert(
      reviewed.status === 200,
      "employer can move submitted application to review",
    );
    const ownerStatus = await requestApi(
      `/api/v1/applications/${applicationId}`,
      {
        token: "dev-applicant",
      },
    );
    assert(
      ownerStatus.body.application.status === "under_review",
      "applicant sees the employer status after refresh",
    );

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
    const persistedFeedback = await requestApi(
      `/api/v1/feedback/receipts/${feedbackSubmissionId}`,
      { headers: { "X-Receipt-Token": receiptToken } },
    );
    assert(
      persistedFeedback.status === 200 &&
        persistedFeedback.body.submission.status === "in_review" &&
        persistedFeedback.body.submission.messages.length === 3,
      "feedback state and messages survive a Worker restart",
    );
    const persistedApplication = await requestApi(
      `/api/v1/applications/${applicationId}`,
      { token: "dev-applicant" },
    );
    assert(
      persistedApplication.status === 200 &&
        persistedApplication.body.application.status === "under_review",
      "application state survives a Worker restart",
    );
    console.log(
      "Local D1 smoke passed: guest receipt privacy, staff response/status, applicant-confirmed sample application, employer review, denial boundaries, and persistence across a Worker restart.",
    );
    console.log(
      "Local authorization smoke passed using fixed development principals: allowed sandbox staff and applicant-owner actions; denied cross-organization, cross-role, and applicant staff access. No real Auth0 token was used.",
    );
  } finally {
    await stopWorker(child);
  }
} catch (error) {
  throw new Error(
    `Worker smoke failed: ${error.message}. ${child?.diagnostics?.() ?? ""}`,
  );
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
      "--var",
      "DEV_AUTH_ENABLED:true",
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

async function assertAuthorization(
  token,
  action,
  targetOrganizationId,
  status,
) {
  const response = await fetch(`${baseUrl}/api/v1/_local/smoke/authz`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, targetOrganizationId }),
  });
  const body = await response.json();
  assert(
    response.status === status,
    `${token} ${action} expected ${status}, got ${response.status}`,
  );
  assert(
    body.allowed === (status === 200),
    `${token} ${action} returned unexpected authorization decision`,
  );
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

async function requestApi(path, options = {}) {
  const headers = new Headers(options.headers ?? {});
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
  if (options.body !== undefined)
    headers.set("Content-Type", "application/json");
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
  });
  const body = await response.json();
  return { status: response.status, body };
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
