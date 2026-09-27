# Judge questions and answers

## What it is

Short answers for the three-minute Hack the Hill III Q&A. They focus on the Civic Technology rubric and make the limits of the current demo explicit.

## How it works

Answer in 15–25 seconds, then offer a specific piece of evidence if a judge wants depth.

| Likely question | Answer |
| --- | --- |
| Who uses this, and what public process changes? | “Residents use it to find official jobs and services, understand a source, and raise a concern with a visible destination. Official applications remain on the publisher's site. Reports submitted here currently reach Envoy's review team; we have no municipal partner.” |
| How do you stop the assistant from making unauthorized changes? | “The model selects a typed tool. The Worker validates arguments and role scope. A write produces an editable proposal; the person must approve it, and the Worker checks authorization again at approval.” |
| What happens with duplicate concerns? | “Before offering a new report, Envoy searches the supported destination and category for a strong match. It shows the existing case status, asks whether this is separate or recurring, and repeats the match check when the user approves.” |
| Can I trust the job and service data? | “Each public record carries its official publisher and source link. Current individual vacancies are separate from general job finders; stale, closed, and sample records are excluded by default. We show freshness and hand people to the exact official page.” |
| Why Cloudflare and Tiger Data together? | “The Worker keeps the app and API on one origin. D1 holds transactional records and an idempotent outbox. Tiger receives privacy-limited event metadata so aggregate trends do not require sending the resident's report body.” |
| What does Auth0 enforce? | “The Worker verifies JWT signature, audience and issuer, then intersects token permissions with D1 organization membership. We have a local role smoke test and production signature rejection evidence. A real live staff-role session is still an acceptance task.” |
| What is the ElevenLabs integration? | “The Worker issues a short-lived signed session for a private voice agent. In one real call, the agent followed up on a streetlight concern by asking for the nearest intersection. The web microphone-to-draft handoff and final feedback submission still need acceptance, so voice is not part of our core live demo.” |
| What is Presage doing? | “The native SwiftUI client integrates a consented sensor path intended to make feedback writing calmer. The app builds, but we have not accepted a stable signal on a physical iPhone. We do not claim a device demonstration from simulator footage.” |
| What did you learn? | “Source provenance and destination are part of the interaction, not a footnote. We changed the assistant so it presents a reviewable action and the Worker enforces the final decision.” |
| What would you do with a public partner? | “We would first configure a verified organization and scoped staff roles, then test the report destination and response path with that partner. Until then, the interface says Envoy receives the report.” |

### Rubric map

| Criterion | Proof to point to |
| --- | --- |
| Technical Execution, 15 | Combined Worker and API, persisted D1 receipt, typed agent tools and approval, idempotent Tiger outbox, role checks in Worker. |
| Idea & Impact, 10 | Resident problem, real official publishers, explicit recipient, existing-case status instead of duplicate noise. |
| Design & Usability, 10 | End-to-end guest path, selected card details, source and closing date, map/list fallback, editable report and private receipt. |
| Learning & Technical Decisions, 5 | Source freshness, human approval, strict role boundary, separation of report text from analytics. |
| Presentation, 5 | One resident journey completed within five minutes with prepared recovery, truthful handoff and receipt. |

This map follows the [organizer's current Resources page](https://tracker.hackthehill.com/resources). Confirm on-site timing and rubric wording if the organizer updates it.

## How to change it

Replace an answer only when a live run or code change supports it. Keep the no-partner disclosure until a real municipality or employer participates. Update the [pitch script](pitch-script.md), [demo runbook](demo-runbook.md), and slide notes together when an integration passes acceptance. Do not give a numerical impact estimate without a measured baseline.

## Configuration

Bring the current public URL, a read-only Tiger event/aggregate query, and a link to the relevant repository code. Keep credentials, JWTs, receipt tokens, resident message bodies, and private résumé files off the projector.

## Dependencies

Answers rely on current Envoy Worker, D1, R2, Workers AI, Auth0, Tiger, ElevenLabs, and native SwiftUI implementation evidence documented elsewhere in `docs/`. The optional integration answers distinguish configured code from end-to-end acceptance.
