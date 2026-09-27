# Envoy

Envoy helps people find public services and opportunities, understand their next step, and turn civic issues into reviewable feedback. Residents can explore source-linked information, ask an assistant for help, and submit a practice report with a private receipt. Applicants can review and send applications to participating sandbox employers; staff tools are organization- and role-scoped.

## Demo and project links

- **Live app and API:** [envoy.matteopolak.workers.dev](https://envoy.matteopolak.workers.dev/). The root page and `/api/healthz` were verified with HTTP 200.
- **Repository:** [github.com/matteopolak/hth3](https://github.com/matteopolak/hth3)
- **Five-minute video:** [watch or download the captioned MP4](https://github.com/matteopolak/hth3/releases/download/v0.1.0-hth3-review/envoy-review.mp4). The [video notes](docs/video-production.md) identify the capture origins and pending live acceptance.

## What is real and what is practice data

Envoy links to public information and identifies its sources and freshness. An external link is a handoff to its publisher; it does not mean Envoy submitted an application or report for the resident, and source verification does not guarantee eligibility or current intake.

The in-app employer and feedback workspace is a fictional practice environment. “CivicResolve Toronto Sandbox” and its sample organizations, postings, applications, and reports are fictional and unaffiliated with Toronto or any government office. Toronto names a real geographic destination only. Practice reports stay in Envoy and are not delivered to a government agency. AI suggestions are shown for review; a person must confirm before a write action.

## App and stack

The web client is a bilingual English/French TypeScript app backed by a Cloudflare Worker. A separate native iOS client is built with SwiftUI. The platform uses Cloudflare Workers, D1, private R2, and Workers AI, with Auth0 for sign-in and Tiger Data for feedback analytics. Provider features have separate live-acceptance gates; the presence of an integration is not itself evidence of a completed provider flow.

## Run locally

Install the supported Node.js version and pnpm from the workspace setup, then run:

```sh
pnpm install
pnpm dev -- --host
```

This starts the Vite web app with the official Cloudflare Vite plugin and local Worker, D1, and R2. The `--host` option makes the development server reachable by collaborators on the LAN. Local role identities are development-only; production authorization is checked by the Worker.

The workspace enforces a strict two-week package release cooldown (`minimumReleaseAge: 20160` minutes), including rejection of packages whose publication time is missing. Do not bypass or relax this policy to install a dependency.

## Further reading

- [Documentation index](docs/README.md)
- [Devpost submission checklist](docs/submission-checklist.md)
- [Five-minute video storyboard](docs/video-storyboard.md)
- [Local setup and CI](docs/workspace-and-ci.md)
- [Deployment architecture and status](docs/deployment.md)
