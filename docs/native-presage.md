# Native Presage accessibility check

## What it is

The iPhone app has an optional camera check powered by Presage SmartSpectra. A stable breathing-rate sample prompts the resident to consider a quieter feedback-writing layout. Residents can also turn that layout on manually. This is an interface preference, not a health assessment.

## How it works

Profile → Accessibility asks for explicit consent, then a separate **Start camera check** action. `AccessibilityView` configures the SDK for breathing rate only, disables its optional session telemetry, starts the front camera, and waits for a sample marked `stable`. That SDK output makes the calmer-layout offer visible. Pressing the offer stores only the Boolean `envoy.calmWriting` preference in `UserDefaults`. Feedback then shows a larger message editor and hides the blank optional improvement field. The resident's message, category, destination, priority, and case status are unchanged.

The SDK stops when the resident stops the check, revokes consent, or leaves the screen. The displayed rate is held only in view memory and cleared when consent is revoked or a new check starts. Envoy does not upload the camera image or metric through its Worker. The selected layout remains a separately adjustable preference even after the camera check stops.

## How to change it

Edit `apps/mobile/ios/CivicResolve/Features/Accessibility/AccessibilityView.swift` for the consent, measurement, and offer flow. Edit `Features/Feedback/FeedbackView.swift` for the reading-layout effect. Keep the SDK result out of case and application payloads. Do not infer distress, emergency status, eligibility, complaint priority, or government routing from a breathing value. The camera check must remain optional and usable alternatives must remain available.

The SDK requires a physical iPhone for live camera acceptance. Generic-device and ARM64 simulator `xcodebuild` builds confirm compilation and packaging; the simulator can inspect the layout but cannot verify a real camera result. Release acceptance needs a signed device build, the configured API key, explicit in-app consent, an actual stable SDK reading, and a visual check of the feedback layout before closing the Presage issue. On 2026-09-26, only an iPhone simulator was connected and this Mac had no local code-signing identity, so the live-device acceptance remains pending.

## Configuration

The app target pins `SmartSpectra` from `Presage-Security/SmartSpectra-Swift` at 3.3.0, targets iOS 17+, and includes `NSCameraUsageDescription`. `PRESAGE_API_KEY` is an Xcode build setting expanded into the app's `Info.plist`; the tracked project defaults it to empty so builds without the key show a manual accessibility option. Set the key through a private local build configuration or a protected build environment. Do not add the key or a populated configuration file to Git. Because the SDK runs on the device, a supplied API key is embedded in that signed app; for a production distribution with stronger credential isolation, use Presage's documented OAuth mode and a registered bundle ID.

SmartSpectra ships a dynamic binary framework. The target keeps `@executable_path/Frameworks` in `LD_RUNPATH_SEARCH_PATHS` for Debug and Release so the installed app can load its embedded framework. When changing package linkage, check both the app bundle's `Frameworks/SmartSpectra.framework` and the app executable's `LC_RPATH` entries; a successful compile alone does not prove the app can launch.

This feature uses the user's existing Presage free trial entitlement. The camera check starts only after an explicit tap; do not enable unattended measurements or paid upgrades. `envoy.presageConsent` and `envoy.calmWriting` are on-device `UserDefaults` keys.

## Dependencies

- [Presage SmartSpectra Swift quick start](https://smartspectra.presagetech.com/docs/swift/option-1-api-key/) and [Swift API reference](https://smartspectra.presagetech.com/docs/swift/api-reference/)
- [Presage metrics guidance](https://smartspectra.presagetech.com/docs/swift/metrics/) and [telemetry controls](https://smartspectra.presagetech.com/docs/telemetry-and-privacy/)
- SwiftUI, iOS camera permission, and `UserDefaults`
