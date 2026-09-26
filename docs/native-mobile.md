# Envoy native iOS app

## What it is

`apps/mobile/ios/CivicResolve` is Envoy’s native SwiftUI iOS client for guest feedback, applicant profiles and résumés, and sample employer applications. It calls the same Cloudflare Worker API as the web client and does not wrap a web page.

## How it works

The tab shell provides feedback, applications, and profile screens in English and French. Guests can review and submit feedback to the clearly labeled fictional Toronto sandbox, keep a private receipt token in Keychain, and check later replies. A distinct emergency action opens local 911 guidance and a phone link; it never submits a report and does not infer emergencies from message text.

Native sign-in uses Auth0.swift’s PKCE Universal Login flow. It requests the CivicResolve API audience and applicant permissions; Auth0 credentials and refresh tokens are stored by the SDK in Keychain. The app does not ask for an employer organization during resident sign-in. Debug builds also include fixed local Worker identities for development; those values are not present in Release.

The profile view reads and saves the authenticated applicant’s supported profile fields. Résumés upload as multipart PDF or DOCX files to the private Worker storage route, can be deleted, and are extracted only through the deterministic Worker parser. The app displays each source-backed suggestion and text preview; tapping “Apply to draft” changes the editable profile, and the applicant must still save it. There is no OCR or automated qualification inference. Résumés stay private unless the applicant explicitly selects one and shares it with a specific application. Deletion revokes that share.

Sample postings load without sign-in. Application submission requires an Auth0 or local development identity, complete answers, and the applicant’s explicit confirmation. The displayed result always comes from the Worker response.

## How to change it

Keep JSON models and Worker requests in `Platform/WorkerAPI.swift`, Auth0 configuration and credential handling in `Platform/Auth0Session.swift`, local-only identities in `Platform/LocalIdentity.swift`, and guest receipt storage in `Platform/KeychainReceiptStore.swift`. Screen behavior belongs in `Features/Feedback`, `Features/Applications`, and `Features/Profile`. Add English and French copy to `Platform/AppCopy.swift` until the shared localization catalogue is consumed natively.

When an API request or response changes, update the Worker and shared contract first, then the Codable type, client method, and screen. Keep profile suggestions reviewable and source-linked; never save them automatically. Keep a résumé private unless the user chooses a particular application to share it with. Do not add a production local identity or store tokens in ordinary preferences.

## Configuration

| Setting | Default | Purpose |
| --- | --- | --- |
| `CIVICRESOLVE_API_BASE_URL` | Debug: `http://127.0.0.1:8787/api/v1`; Release: `https://civicresolve-api-production.matteopolak.workers.dev/api/v1` | Worker API base URL is selected by the Xcode build configuration. Change the matching `CIVICRESOLVE_API_BASE_URL` setting in `project.pbxproj` when adding another environment. |
| `CIVICRESOLVE_AUTH0_DOMAIN` | `dev-ole6i03kzvf3yb8z.us.auth0.com` | Auth0 tenant domain. |
| `CIVICRESOLVE_AUTH0_CLIENT_ID` | Mobile public client ID in `Info.plist` | Auth0 native application identifier; this is public client configuration, not a secret. |
| `CIVICRESOLVE_AUTH0_AUDIENCE` | `https://civicresolve.example/api` | API audience requested for Worker access tokens. |
| `CIVICRESOLVE_AUTH0_REDIRECT_URL` | `civicresolve://auth/callback` | Auth0 login callback and logout redirect. The `civicresolve` scheme is registered in `Info.plist`; this URI is allowlisted as both a callback and an Allowed Logout URL. The pre-existing `civicresolve://auth/logout` logout URL remains allowlisted too. |
| `AppLocale` | English | The toolbar switches between `en` and `fr`. |
| `LocalIdentity` | `dev-applicant` in Debug; signed out in Release | Fixed test identity accepted only by a local Worker with development auth enabled. |

Auth0’s Applicant role needs `read:applications`, `submit:applications`, `write:applications`, `read:profile`, and `write:profile`. `offline_access` enables the SDK’s Keychain-backed token renewal. Never add an Auth0 client secret to this native app.

Open `apps/mobile/ios/CivicResolve.xcodeproj` in Xcode. The app display name is Envoy and its bundle identifier is `com.matteopolak.envoy`; the Auth0 callback scheme remains `civicresolve`. The project includes Auth0.swift 3.0.0 through Swift Package Manager. A generic device build can be checked with `xcodebuild -project apps/mobile/ios/CivicResolve.xcodeproj -scheme CivicResolve -sdk iphoneos -configuration Debug -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build`. The app targets iOS 17 or newer. Local HTTP is allowed only for local networking; Release targets the deployed HTTPS Worker.

At the foundation checkpoint, generic iOS Debug and Release builds succeeded, but runtime visual QA was unavailable: the host's CoreSimulator 1051.54.0 is older than the Xcode 27 requirement 1171.7.0, and its simulator service cannot start. The current Auth0 and profile UI additions can be compile-checked on a generic iOS destination, but real Auth0 sign-in, upload, and simulator visual acceptance still require a working simulator. No provider or deployment acceptance should be inferred from the build.

## Dependencies

SwiftUI, Foundation/URLSession, UniformTypeIdentifiers, Security/Keychain, Auth0.swift, and the Worker postings, application, profile, résumé, feedback-receipt, and guest-message APIs. The Worker depends on D1 for applicant metadata and private R2 for résumé bytes. See [Applicant profile and résumé extraction](applications/resume-extraction.md) for parser and retention limits.
