import { spawn } from "node:child_process";
import { resolve } from "node:path";

const command = process.platform === "win32" ? "wrangler.cmd" : "wrangler";
const child = spawn(command, process.argv.slice(2), {
  cwd: process.cwd(),
  env: {
    ...process.env,
    WRANGLER_LOG_PATH: resolve(process.cwd(), ".wrangler/logs"),
    WRANGLER_SEND_METRICS: "false",
  },
  stdio: "inherit",
});

child.once("error", (error) => {
  console.error(`Could not start Wrangler: ${error.message}`);
  process.exitCode = 1;
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.once("exit", (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
