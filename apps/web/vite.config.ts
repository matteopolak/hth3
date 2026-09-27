import { networkInterfaces } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig, loadEnv } from "vite";

const webDir = dirname(fileURLToPath(import.meta.url));
const workerConfigPath = resolve(webDir, "../worker/wrangler.dev.toml");
const workerStatePath = resolve(webDir, "../worker/.wrangler/state");

function localOrigins(): string[] {
  const addresses = Object.values(networkInterfaces())
    .flatMap((interfaces) => interfaces ?? [])
    .filter((address) => address.family === "IPv4" && !address.internal)
    .map((address) => `http://${address.address}:5173`);

  return [
    ...new Set([
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      ...addresses,
    ]),
  ];
}

export default defineConfig(({ command, mode }) => {
  const environment = loadEnv(mode, webDir, "VITE_");
  const apiBaseUrl =
    process.env.VITE_API_BASE_URL ?? environment.VITE_API_BASE_URL ?? "/api/v1";

  return {
    plugins:
      command === "serve"
        ? [
            ...cloudflare({
              configPath: workerConfigPath,
              persistState: { path: workerStatePath },
              config: (workerConfig) => ({
                vars: {
                  ...workerConfig.vars,
                  ALLOWED_ORIGINS: localOrigins().join(","),
                },
              }),
            }),
          ]
        : [],
    define: apiBaseUrl
      ? { "import.meta.env.VITE_API_BASE_URL": JSON.stringify(apiBaseUrl) }
      : {},
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
    },
    build: {
      target: "es2022",
    },
  };
});
