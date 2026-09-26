# Native iOS shell

## What it is

`apps/mobile/ios/CivicResolve` is a native SwiftUI iOS client for guest civic feedback and sample employer applications. It calls the same Worker API as the web shell; it is not an Expo app or a web view.

## How it works

The tab shell exposes feedback and applications in English and French. Feedback lets a guest compose and review their original message plus an optional improvement note, confirms the fictional Toronto sandbox before sending, generates a fresh 32-byte receipt token with `SecRandomCopyBytes`, and stores the returned receipt credentials in Keychain. The receipt screen fetches status and staff replies with that private token and can add a follow-up.

Public sample postings load from the Worker. Application submit is enabled only after an identity is available, required answers are present, and the applicant explicitly confirms the answers. Debug builds offer fixed local Worker test identities; Release builds contain no local token and require a future real sign-in integration. The request result is always taken from the Worker response. Network and API errors are shown without presenting a false success.

## How to change it

Keep URL construction and JSON models in `Platform/WorkerAPI.swift`, local-only tokens in `Platform/LocalIdentity.swift`, and receipt credential storage in `Platform/KeychainReceiptStore.swift`. Screen-level interaction belongs in `Features/Feedback` and `Features/Applications`; reusable colors and controls belong in `Design/CivicTheme.swift`. Add both translations to `Platform/AppCopy.swift` until the native localization catalogue is connected to the shared package. When a shared request shape changes, update the Worker and contract first, then the Codable model and corresponding screen.

Do not add a production local identity or persist the guest receipt token in ordinary preferences. Keep the message preview and sandbox confirmation directly before submission. Any new destination needs explicit routing support; the current feedback slice sends only to the fictional Toronto sandbox.

## Configuration

| Setting | Default | Purpose |
| --- | --- | --- |
| `CIVICRESOLVE_API_BASE_URL` in `Info.plist` | `http://127.0.0.1:8787/api/v1` | Worker API base URL. Set an HTTPS endpoint for deployed builds. |
| `AppLocale` | English | The toolbar language menu switches between `en` and `fr`; copy is in `Platform/AppCopy.swift`. |
| `LocalIdentity` | `dev-applicant` in Debug; signed out in Release | Fixed development identity values accepted only by the local Worker with development auth enabled. |

Open `apps/mobile/ios/CivicResolve.xcodeproj` in Xcode. A generic device build can be checked with `xcodebuild -project apps/mobile/ios/CivicResolve.xcodeproj -scheme CivicResolve -sdk iphoneos -configuration Debug -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build`. The current app uses iOS 17 or newer. Local HTTP is allowed only for local networking; production must use HTTPS.

## Dependencies

SwiftUI, Foundation/URLSession, Security/Keychain, and the Worker postings, application, feedback receipt, and guest-message APIs. Auth0 native sign-in and native sensory/voice integration are separate follow-up work; this shell currently provides no real account login in Release builds.
