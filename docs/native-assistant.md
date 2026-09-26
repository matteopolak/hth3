# Native resident assistant

## What it is

The iOS app offers a SwiftUI resident chat backed by Envoy's Workers AI conversation service. It works as a guest; a signed-in resident can also use their account-scoped tools. No employee tools are shown in this view.

## How it works

`ResidentAssistantView` displays the conversation, a compact composer, saved conversations, the tools returned by the Worker, and pending action previews. The first message creates a `resident` conversation through `POST /api/v1/agent/conversations`; subsequent messages use its `/messages` route. The Worker may proactively prepare a `create_feedback` proposal when a resident describes a service problem. The app shows the original proposed body and destination notice and requires a separate approval. A feedback approval additionally requires the resident to acknowledge that Envoy's intake queue is unaffiliated with government. Approved feedback receipt credentials are saved through the existing `KeychainReceiptStore`.

Guest conversation IDs and private tokens are stored in the iOS Keychain under `com.matteopolak.envoy.assistant`. History is loaded from the Worker whenever a thread opens. Auth0 residents get their remote conversation list when signed in. The tools sheet lists only tools returned by the Worker. It accepts a JSON object for arguments and sends reads immediately; writes return a preview to approve or decline. This permits all role-exposed tools without duplicating their individual forms in SwiftUI.

## How to change it

Update `Features/ResidentAssistant/ResidentAssistantAPI.swift` when the Worker conversation protocol changes. Update `ResidentAssistantView.swift` for presentation and localized copy. Keep private guest tokens out of logs and user-visible tool output. New write tools should follow the same approval-card path; only `create_feedback` needs the extra sandbox acknowledgment. The Xcode target must include both Swift files.

## Configuration

The feature uses the existing `CIVICRESOLVE_API_BASE_URL` Info.plist setting. Debug points at the local Worker, while Release points at the production Worker. It uses the current `CivicResolveModel.authAccessToken` when the resident has signed in; otherwise it creates a guest thread. The model and free-credit cap are configured on the Worker, not in iOS.

## Dependencies

SwiftUI, Foundation `URLSession`, iOS Security Keychain, the shared `CivicResolveModel`, `KeychainReceiptStore`, and the Worker agent endpoints. No paid native AI SDK is used.

Generic device Debug and Release builds pass. The host's outdated CoreSimulator prevents a native runtime or visual acceptance run; the Worker conversation flow is verified separately by its web and API clients.
