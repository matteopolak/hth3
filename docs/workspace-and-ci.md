# Workspace and CI

## What it is

The repository uses a pnpm workspace for the Worker, public clients, and shared packages. A frozen install followed by `pnpm check` is the common local and CI gate; the check includes the local Worker/D1 smoke harness.

## How it works

`pnpm-workspace.yaml` lists `apps/*` and `packages/*`. The root manifest pins pnpm 12.6.0 and defines lint, typecheck, test, build, and aggregate check commands. Package-age policy blocks versions published within the previous 14 days and rejects packages whose publication time is missing. `.github/workflows/check.yml` applies the frozen lockfile install and check suite on pushes to `main`, pull requests, and manual runs.

Dependency lifecycle scripts stay disabled unless explicitly addressed under `allowBuilds` in `pnpm-workspace.yaml`. Exact esbuild and workerd versions required by Vitest/Wrangler are allowed to install their runtimes; the unused sharp build is explicitly denied.

Shared TypeScript settings live in `packages/config/tsconfig/base.json`. Packages extend that config and own their checks; the root scripts recurse only into packages that provide the corresponding command. `pnpm smoke` applies local D1 migrations and exercises outbox idempotency/persistence plus role and organization denial through the Worker. The Wrangler dry-run explicitly selects the top-level local configuration; production deploys must name `--env production`.

## How to change it

Add new workspaces under `apps/` or `packages/`, then add their dependencies through pnpm so the root lockfile is updated. Keep the release-age policy enabled for every install. Add required package checks to each package's scripts and keep CI's frozen install and `pnpm check` steps aligned with the documented local gate.

## Configuration

- `pnpm-workspace.yaml`: workspace globs and the 20,160-minute strict minimum release age.
- `package.json`: pnpm and Node versions, shared scripts, and root developer tools.
- `.github/workflows/check.yml`: CI triggers and runtime versions.
- `packages/config/tsconfig/base.json`: strict shared TypeScript defaults.

## Dependencies

Node.js 22.14 or newer, pnpm 12.6.0, Prettier, TypeScript, and GitHub Actions. CI obtains dependencies from the pnpm lockfile and does not use secrets or deploy credentials.
