# Agent results and approvals

## What it is

The web assistant renders source, theme, posting, application, and feedback tool results as compact cards. Write proposals show a clear pending state and retain an approved or declined record in the thread.

## How it works

`apps/web/src/features/agent-results/index.ts` accepts the Worker’s `{status, data}` tool envelope or its stored JSON string. It recognizes known response collections by their top-level keys and reads only fields used in the cards. Unknown shapes remain available in a keyboard-accessible disclosure with sensitive key names redacted. Source links open only HTTPS URLs, and sample records never get a source link. Every result uses the server’s actual counts and practice flags.

The platform chat calls `agentResult()` for tool messages, `agentApprovalIntro()` inside pending proposal cards, and `agentApprovalState()` for approved or declined proposals. Buttons, checkboxes, proposal execution, and Auth0 authorization remain in the platform and Worker flows; the feature module only renders information. Native `<details>` and `<a>` controls support keyboard use without extra JavaScript.

## How to change it

Add a response recognizer to `resultCollection()` when a Worker tool returns a new shape, then select a concise title, description, and metadata in `resultItem()`. Keep private receipt tokens, Auth0 subjects, internal paths, and raw proposal flags out of visible cards. Keep fallbacks so unfamiliar tools still expose their result. Add action names to `approvalTitle()` for a specific review label; unknown actions use a neutral title.

The shell’s `chatPage()` supplies tool message content, and its `proposalCard()` supplies the approval preview. The Worker owns proposal status changes. Update both if the stored message format changes.

## Configuration

No environment variables are required. The caller supplies `en` or `fr` from the active locale.

## Dependencies

The module uses browser DOM APIs, the shared `Locale` type, and the Worker agent conversation result and proposal envelopes. Scoped styling lives in `styles.css`.
