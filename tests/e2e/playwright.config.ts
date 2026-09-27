import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

const baseURL = process.env.ENVOY_E2E_BASE_URL ?? "http://127.0.0.1:5173";
const repositoryRoot = resolve(__dirname, "../..");

export default defineConfig({
  testDir: ".",
  testMatch: "guest-smoke.pw.ts",
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    browserName: "chromium",
    channel: "chrome",
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  webServer: process.env.ENVOY_E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm dev -- --host",
        cwd: repositoryRoot,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
