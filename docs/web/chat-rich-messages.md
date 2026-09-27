# Rich assistant messages

## What it is

Resident and employee chats render assistant Markdown, compact source attribution, role-available `@` tool references, and live server-streamed replies. User text remains plain text. Write tools still require a separate approval card.

## How it works

`apps/web/src/features/chat-rich/` turns assistant text into Markdown DOM using Marked, escapes raw HTML, then sanitizes the generated nodes with DOMPurify's narrow tag and attribute allowlist. Links must use HTTP or HTTPS and open with `noopener noreferrer`. Tool results with source records become a collapsed `From N sources` disclosure with filled initials from up to five distinct publisher sites. Opening the disclosure shows every loaded source, its publisher, and practice label. Other tool results use the existing structured result renderer.

Typing `@` at the caret opens an accessible list of tools returned by the conversation API for that role. Choosing one creates a removable chip and stores its exact tool name separately from the draft. Up to three selected names are sent in `toolMentions` to the Worker. The saved user message also carries `[[tool:name]]` references, but the browser presents friendly labels instead of raw names. The Worker validates names against its role-filtered catalogue and decides whether a tool can run; write calls still create proposals.

The browser posts to `/api/v1/agent/conversations/:id/messages/stream`. SSE `text` deltas update one assistant message without rerendering the full page, preserving focus and composer state. A `final` event supplies the persisted message and optional result/proposal; incomplete or error streams show an error and restore the draft. The older JSON endpoint is used only when the stream route is unavailable (404, 405, or 501).

## How to change it

Add friendly tool labels in `mentions.ts`; the picker description comes from the Worker's tool catalogue. Keep the exact name in `toolMentions` and ensure the Worker authorizes new names. Change Markdown tags or attributes only in `chat-rich/index.ts`, retaining raw-HTML escaping and URL checks. Extend `sourceAttribution()` only for source-bearing result shapes, preserving the expandable detail and practice labels. The SSE parser lives in `apps/web/src/platform/api.ts`; update it alongside the Worker event contract. The chat UI and optimistic message state live in `apps/web/src/platform/main.ts`.

## Configuration

`VITE_API_BASE_URL` selects the Worker. The maximum is three selected tools per message. The composer limits the editable draft to 3,600 characters so tool references fit within the server message limit. The root pnpm workspace enforces a strict two-week minimum package release age.

## Dependencies

The web app depends on `marked`, `dompurify`, the Worker agent conversation routes, and the existing agent result/approval renderer. Publisher initials are deterministic and do not require third-party favicon requests. The count still refers to all loaded source records, including multiple records from one site.
