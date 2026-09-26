# Guest civic feedback

## What it is

Guest feedback is a private, replyable case record for constructive comments. This build routes Toronto submissions to a clearly fictional CivicResolve sandbox; it does not deliver reports to the City of Toronto or another government office.

## How it works

The resident reviews their exact original wording with an optional “what would improve this?” note, selects a service category, chooses a municipality, and confirms the destination. The Worker preserves `message` verbatim in `feedback_submissions.original_text` and stores the improvement note separately. Categories and the municipality are routing metadata; the resident’s text remains the source of truth.

`POST /api/v1/feedback` accepts JSON with `message`, optional `whatWouldImprove`, `category`, `evidence`, `municipalityId`, and `sandboxAcknowledged: true`. The only seeded route is Toronto’s Statistics Canada 2021 Census Subdivision UID `3520005`, which maps to `CivicResolve Toronto Sandbox (Fictional, unaffiliated)`. That identifier represents a real municipality. The destination remains fictional. The route is explicitly confirmed before it is used, and an unknown or unsupported municipality returns `DESTINATION_NOT_SUPPORTED` without falling back to Toronto.

The request’s `X-Receipt-Token` must contain 32 cryptographically random bytes as 64 hexadecimal characters. The Worker stores only its SHA-256 hash and returns the client token with the initial receipt response. It does not place the token in a URL, audit event, outbox event, or idempotency response. Keep the token private: possession grants access to the receipt. Create a new token for each new submission. Reusing the same idempotency key and token replays the original receipt.

Receipts are available at `GET /api/v1/feedback/receipts/{id}`. A resident can add a message at `/messages`; when a case is closed or has an outcome, they must use `POST /reopen` with new information. The state update, reply, audit, outbox event, and idempotency result are written together. Staff can list and read cases, messages, and evidence under `/api/v1/staff/organizations/{orgId}/feedback`, reply, and make only valid status changes. The Worker checks the organization role and active D1 membership on every staff route. Hiring reviewers and other organizations cannot read civic feedback.

Emergency requests are redirected before the Worker creates a case. English and French responses tell the resident to call 911 if someone is in immediate danger and state that CivicResolve does not monitor emergencies or dispatch responders. The redirect response confirms that nothing was submitted.

Optional evidence accepts up to three PDF, PNG, or JPEG files, with a 5 MiB per-file and 10 MiB total limit. The Worker checks file signatures, stores bytes in private R2, and stores scoped metadata in D1. Guests must present the receipt token to download their files. Staff downloads require the same organization authorization as the case. No file bytes or base64 data are written to logs, audit details, or outbox payloads.

Guest create, reply, and reopen writes use an HMAC of Cloudflare’s `CF-Connecting-IP` header as a short-lived abuse-control key. Raw IP addresses are not stored. Current limits are 8 new reports, 16 replies, and 4 reopens per IP per hour. The keyed counters are deleted after 24 hours. Idempotent retries do not consume additional requests.

## How to change it

Add schema changes as forward-only migrations and keep the domain transition rules in `packages/domain/src/feedback/`. Keep the original resident wording separate from any summary or staff reply. A new municipal destination must use an authoritative municipality identifier and explicit D1 routing row; never route an unsupported municipality to Toronto. Preserve the fictional destination label until a real organization has been verified and configured.

Keep receipt tokens out of URLs, logs, analytics, audit details, and persisted idempotency responses. Do not replace the token with a public case number. When changing evidence rules, keep the R2 bucket private, validate the content signature and size, and retain both the receipt-token check and organization scope on downloads. Add English and French messages for any new emergency or destination states.

Staff mutations must use the explicit transition map, authorize the organization against both the token permissions and D1 membership, and batch the state change with its audit, outbox, and idempotency rows. Outbox and audit payloads may include category, status, text length, and evidence count; they must never contain feedback text, receipt tokens, or attachment bytes.

## Configuration

- `DB`: D1 stores cases, replies, geography, destination mappings, scoped evidence metadata, abuse counters, audits, idempotency records, and outbox events.
- `PRIVATE_ASSETS`: private R2 bucket used for evidence. It must not have a public URL or public-read policy.
- `FEEDBACK_ABUSE_HMAC_KEY`: Worker secret with at least 32 characters. Configure a random secret separately for every environment. Guest writes fail closed with `503` if it is absent or too short. Do not put it in source control or Wrangler vars.
- `X-Receipt-Token`: client-generated CSPRNG value from `crypto.getRandomValues(new Uint8Array(32))`, hex encoded. Never log or put it in a URL.
- `Idempotency-Key`: required on writes and scoped to the action and actor.
- `municipalityId`: Statistics Canada CSDUID. Only `3520005` has a route in this prototype.
- `sandboxAcknowledged`: must be `true` after the resident has seen and confirmed the fictional Toronto destination.
- `emergency: true`: optional explicit emergency redirect. The Worker returns localized 911 guidance with `accepted: false` and creates no case; do not infer this flag from free text.
- `evidence`: optional array of `{ fileName, contentType, data }`, with `data` base64 encoded. Allowed content types are `application/pdf`, `image/png`, and `image/jpeg`.
- `CF-Connecting-IP`: supplied by Cloudflare at the edge and used only as HMAC input. Local smoke requests set a fixed test value.
- Geography source: [Statistics Canada SGC 2021 entry for Toronto CSDUID 3520005](https://www23.statcan.gc.ca/imdb/p3VD.pl?CLV=4&CPV=3520005&CST=01012021&CVD=1341558&Function=getVD&MLV=4&TVD=1346772&dbg=1). Toronto directs residents to call [911 for emergencies](https://www.toronto.ca/home/contact-us/); its official [311 Toronto](https://www.toronto.ca/home/311-toronto-at-your-service/find-service-information/article/?kb=kA06g000001cvpFCAQ) channel handles non-emergency City services. CivicResolve does not submit to either channel.

## Dependencies

The feature uses Cloudflare Workers, D1, private R2, `@civicresolve/contracts`, `@civicresolve/domain/feedback`, shared D1 idempotency/outbox helpers, and Auth0-backed organization authorization. Statistics Canada supplies the seeded municipality identifier. This local workflow does not claim live government routing, Auth0 acceptance, or downstream event delivery.
