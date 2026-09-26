# Workspace and CI

## What it is

The repository uses a pnpm workspace for the Worker, public clients, and shared packages. A frozen install followed by `pnpm check` is the common CI gate; the check includes the local Worker/D1 smoke harness. `pnpm dev` starts the web app and its Cloudflare Worker API together for local development.

## How it works

`pnpm-workspace.yaml` lists `apps/*` and `packages/*`. The root manifest pins pnpm 12.6.0 and defines local development, lint, typecheck, test, build, and aggregate check commands. Package-age policy blocks versions published within the previous 14 days and rejects packages whose publication time is missing. `.github/workflows/check.yml` applies the frozen lockfile install and check suite on pushes to `main`, pull requests, and manual runs.

Dependency lifecycle scripts stay disabled unless explicitly addressed under `allowBuilds` in `pnpm-workspace.yaml`. Exact esbuild and workerd versions required by Vitest/Wrangler are allowed to install their runtimes; the unused sharp build is explicitly denied.

Shared TypeScript settings live in `packages/config/tsconfig/base.json`. Packages extend that config and own their checks; the root scripts recurse only into packages that provide the corresponding command. `pnpm smoke` applies local D1 migrations and exercises outbox idempotency/persistence plus role and organization denial through the Worker. The Wrangler dry-run explicitly selects the top-level local configuration; production deploys must name `--env production`.

For interactive development, `pnpm dev` first applies the Worker migrations to local D1, then starts Vite with the Cloudflare Vite plugin. Vite serves the web shell and the Worker API on the same origin at `http://localhost:5173`; the API health check is `/api/healthz`. Vite binds to `0.0.0.0`, so `pnpm dev -- --host` also supports opening the app through this machine's LAN address. The Vite config adds the machine's current IPv4 interface origins to the local Worker's development CORS allowlist.

The plugin loads `apps/worker/wrangler.dev.toml` and stores its D1/R2 state under `apps/worker/.wrangler/state`, the same ignored directory used by the local Wrangler migration command. Local records and uploaded objects persist there across restarts. The dev config enables fixed `dev-*` identities and contains a fake HMAC key for local feedback abuse checks; neither value is used by production. No AI or remote bindings are configured, so agent inference and other remote-provider calls are unavailable during `pnpm dev`.

All web API clients use the relative `/api/v1` base by default in Vite development. This keeps API requests on the same host and port as the web app, including when collaborators connect over the LAN. Set `VITE_API_BASE_URL` only when intentionally using a different API origin; configure that Worker origin in its CORS allowlist as well. The public Auth0 domain, audience, and client values in `apps/web/.env.example` are optional browser configuration; local fixed identities do not require a login.

## How to change it

Add new workspaces under `apps/` or `packages/`, then add their dependencies through pnpm so the root lockfile is updated. Keep the release-age policy enabled for every install. Add required package checks to each package's scripts and keep CI's frozen install and `pnpm check` steps aligned with the documented local gate. The Vite plugin and its Worker entry/config are wired in `apps/web/vite.config.ts`; local bindings belong in `apps/worker/wrangler.dev.toml`. Keep AI and remote bindings out of this local config unless the user explicitly authorizes paid or remote development calls.

## Configuration

- `pnpm-workspace.yaml`: workspace globs and the 20,160-minute strict minimum release age.
- `package.json`: pnpm and Node versions, shared scripts, and root developer tools.
- `apps/web/vite.config.ts`: dev Worker plugin, same-origin API base, local persistence path, and LAN CORS origins.
- `apps/worker/wrangler.dev.toml`: local-only Worker variables and D1/R2 bindings.
- `.github/workflows/check.yml`: CI triggers and runtime versions.
- `packages/config/tsconfig/base.json`: strict shared TypeScript defaults.

## Dependencies

Node.js 22.14 or newer, pnpm 12.6.0, Vite, `@cloudflare/vite-plugin`, Wrangler, Prettier, TypeScript, and GitHub Actions. CI obtains dependencies from the pnpm lockfile and does not use secrets or deploy credentials.
