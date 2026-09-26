# Tiger feedback analytics

## What it is

Tiger Cloud stores privacy-safe feedback events for the staff trends view. D1 remains the source of truth for submissions, messages, status, and the delivery outbox.

## How it works

Feedback writes insert a D1 `outbox_events` row in the same transaction as the case change. The Worker's scheduled handler calls `deliverFeedbackOutbox`, which selects at most 50 due `feedback.*` events, joins the D1 case metadata for category and sample status, inserts each into Tiger's `feedback_events` hypertable, and marks each D1 event delivered after Tiger acknowledges it. The `(occurred_at, event_id)` key makes replay idempotent. A failed insert leaves the D1 event pending with a bounded retry delay; resident submission success does not depend on Tiger availability. The Tiger row contains no message body, receipt token, attachment, or staff subject.

`feedback_daily` is a continuous aggregate grouped by UTC day, organization, event type, category, intent, municipality, and sample status. The staff-only `GET /api/v1/staff/organizations/{orgId}/analytics?days=30` endpoint checks the same organization role and D1 membership as the feedback queue, then returns daily volume, category/intent totals, status and reply event counts, the latest synchronized timestamp, and D1 pending-event count. Sample rows remain marked `sample: true`; current intake does not collect intent, so those rows use `unclassified` until explicit intent collection and a new event are implemented. A missing Tiger binding or query failure returns `ANALYTICS_UNAVAILABLE` rather than invented chart data.

Example response:

```json
{
  "apiVersion": "v1",
  "windowDays": 30,
  "generatedAt": "2026-09-26T16:00:00.000Z",
  "synchronizedThrough": "2026-09-26T15:58:00.000Z",
  "pendingEvents": 0,
  "daily": [
    {
      "day": "2026-09-26",
      "category": "parks_and_trees",
      "intent": "unclassified",
      "sample": true,
      "count": 1
    }
  ],
  "categories": [
    {
      "category": "parks_and_trees",
      "intent": "unclassified",
      "sample": true,
      "count": 1
    }
  ],
  "operational": { "feedback.status_changed": 1, "feedback.message_added": 1 }
}
```

## How to change it

Update `scripts/tiger/001_feedback_analytics.sql` with a forward migration when the event schema or aggregate changes; do not edit an already applied schema in place. Update the whitelist in `apps/worker/src/features/analytics/index.ts` if a new outbox event provides useful non-sensitive dimensions. Add explicit intent to the feedback write path before displaying named intent categories. Keep Tiger queries scoped to the authenticated organization, and preserve the sample dimension in every aggregate shown to staff. The cron frequency and batch size can be tuned if lag grows.

## Configuration

- `HYPERDRIVE` Worker binding: existing Tiger PostgreSQL connection. The Worker uses its `connectionString`; no password belongs in source or client code.
- A `*/5 * * * *` Worker cron calls the outbox delivery function.
- Apply the schema once with `tiger db query SERVICE_ID --file scripts/tiger/001_feedback_analytics.sql` from a Tiger-authenticated shell. Query `SELECT count(*) FROM feedback_events` to check arrival.
- The local Worker can omit `HYPERDRIVE`; analytics returns 503 and feedback stays available. For a local live integration test, configure Hyperdrive's local connection according to Cloudflare's Wrangler documentation.

## Dependencies

Tiger Cloud/TimescaleDB supplies the hypertable and continuous aggregate. Cloudflare Hyperdrive and `postgres` connect the Worker to PostgreSQL. D1 stores the transactional outbox and delivery state; Auth0 plus D1 organization membership gate staff reads. The dashboard consumes the Worker endpoint only.
