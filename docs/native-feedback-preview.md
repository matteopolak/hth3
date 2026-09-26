# Native feedback duplicate review

## What it is

The SwiftUI feedback review screen checks for a strongly similar recent report before a guest sends a new one. It shows only the other report's status and requires an explicit choice before sending a separate issue or recurrence.

## How it works

Selecting **Review** keeps the draft on device and calls `POST /api/v1/feedback/duplicate-check` when the message is long enough for the Worker to compare. A match displays its status; the send button stays disabled until the resident chooses to send anyway. A failed preview leaves the draft available because the create endpoint checks duplicates again.

`FeedbackDuplicateAPI` sends the reviewed draft to `POST /api/v1/feedback`. The Worker can return a duplicate at this point even if the preview found none. That response creates no receipt and returns the resident to the explicit choice. A successful response is saved to the existing receipt model and Keychain store. The preview does not receive another resident's case ID, report text, identity, or receipt token.

## How to change it

Edit `Features/Feedback/FeedbackView.swift` for the review state and English/French copy. Edit `Features/Feedback/FeedbackDuplicateAPI.swift` for the two request and response contracts. If the Worker changes duplicate thresholds or routing, update the client and [guest feedback contract](guest-feedback.md) together. Keep the create-time duplicate response distinct from a successful receipt; an HTTP 200 does not by itself mean a report was created.

## Configuration

The API root comes from the iOS `CIVICRESOLVE_API_BASE_URL` Info.plist value and falls back to `http://127.0.0.1:5173/api/v1` for the combined local Vite and Worker server. The native guest route currently uses Toronto's CSD UID `3520005`, the same value as the existing native feedback submission. The precheck uses the Worker's minimum of 48 characters and 7 words to avoid a request for text the server will not compare.

## Dependencies

This screen uses the Worker guest feedback API, `CivicResolveModel` for the draft and receipt, `KeychainReceiptStore` for the private receipt token, and SwiftUI. Guest sign-in is not required.
