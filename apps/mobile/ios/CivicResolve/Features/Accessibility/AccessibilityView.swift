import SwiftUI
import SmartSpectra

struct AccessibilityView: View {
    @EnvironmentObject private var model: CivicResolveModel
    @AppStorage("envoy.presageConsent") private var cameraConsent = false
    @AppStorage("envoy.calmWriting") private var calmWriting = false

    private let sdk = SmartSpectraSDK.shared
    @State private var lastStableBreathingRate: Int?
    @State private var sessionError: String?

    private var configuredKey: String? {
        guard let key = Bundle.main.object(forInfoDictionaryKey: "PRESAGE_API_KEY") as? String,
              !key.isEmpty, !key.hasPrefix("$(") else { return nil }
        return key
    }

    private var isMeasuring: Bool {
        sdk.processingStatus == .starting || sdk.processingStatus == .running
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text(copy("title"))
                    .font(.title2.weight(.semibold))

                Text(copy("intro"))
                    .font(.body)

                Toggle(copy("consent"), isOn: $cameraConsent)
                    .tint(.black)

                Text(copy("privacy"))
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                if cameraConsent {
                    if configuredKey == nil {
                        Text(copy("unavailable"))
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    } else {
                        preview
                        Button(isMeasuring ? copy("stop") : copy("start")) {
                            Task { await toggleMeasurement() }
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.black)
                        .disabled(sdk.processingStatus == .stopping)

                        if isMeasuring {
                            Text(sdk.validationStatus?.hint ?? copy("waiting"))
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                        if let lastStableBreathingRate {
                            Text(String(format: copy("reading"), lastStableBreathingRate))
                                .font(.subheadline)
                            Text(copy("offer"))
                                .font(.subheadline)
                            Button(calmWriting ? copy("turnOff") : copy("turnOn")) {
                                calmWriting.toggle()
                            }
                            .buttonStyle(.bordered)
                        }
                        if let sessionError {
                            Text(sessionError)
                                .font(.footnote)
                                .foregroundStyle(.red)
                        }
                    }
                }

                Toggle(copy("manual"), isOn: $calmWriting)
                    .tint(.black)
                Text(copy("explanation"))
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .padding(20)
            .frame(maxWidth: 720, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .onChange(of: sdk.metrics?.breathing.rate.last?.timestamp) { _, _ in
            guard cameraConsent,
                  let sample = sdk.metrics?.breathing.rate.last,
                  sample.stable,
                  sample.value.isFinite else { return }
            lastStableBreathingRate = Int(sample.value.rounded())
        }
        .onChange(of: cameraConsent) { _, enabled in
            if !enabled {
                lastStableBreathingRate = nil
                Task { await stopMeasurement() }
            }
        }
        .onDisappear {
            lastStableBreathingRate = nil
            Task { await stopMeasurement() }
        }
    }

    private var preview: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.black)
            if let image = sdk.imageOutput, isMeasuring {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .clipped()
            } else {
                Image(systemName: "camera.viewfinder")
                    .font(.largeTitle)
                    .foregroundStyle(.white)
            }
        }
        .frame(height: 210)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .accessibilityLabel(copy("preview"))
    }

    private func toggleMeasurement() async {
        if isMeasuring {
            await stopMeasurement()
            return
        }
        guard cameraConsent, let key = configuredKey else { return }
        sessionError = nil
        lastStableBreathingRate = nil
        sdk.config.apiKey = key
        sdk.config.cameraPosition = .front
        sdk.config.imageOutputEnabled = true
        sdk.config.enableTelemetry = false
        sdk.config.requestedMetrics = [.breathingRate]
        do {
            try await sdk.start()
        } catch {
            sessionError = copy("failed")
        }
    }

    private func stopMeasurement() async {
        guard isMeasuring else { return }
        try? await sdk.stop()
    }

    private func copy(_ key: String) -> String {
        let english: [String: String] = [
            "title": "Accessibility",
            "intro": "You can check whether a quieter writing layout would help. The camera check is optional.",
            "consent": "Allow a camera check with Presage",
            "privacy": "The camera runs only after you press Start. The reading stays on this device and is cleared when you leave. Presage session telemetry is disabled.",
            "unavailable": "Camera check is unavailable in this build. You can still choose the quieter layout below.",
            "start": "Start camera check", "stop": "Stop camera check", "waiting": "Finding a clear reading…",
            "reading": "Presage breathing reading: %d breaths/minute",
            "offer": "Would a quieter writing layout help while you describe your issue?",
            "turnOn": "Use quieter layout", "turnOff": "Use standard layout",
            "manual": "Quieter feedback layout", "explanation": "This changes only how you write feedback. It never changes eligibility, routing, or priority, and it is not a health assessment.",
            "failed": "The camera check could not start. You can use the quieter layout without it.",
            "preview": "Live camera preview",
        ]
        let french: [String: String] = [
            "title": "Accessibilité",
            "intro": "Vous pouvez vérifier si une présentation plus calme facilite la rédaction. La caméra est facultative.",
            "consent": "Autoriser une vérification avec Presage",
            "privacy": "La caméra démarre seulement après votre demande. La mesure reste sur cet appareil et est effacée quand vous quittez cette page. La télémétrie Presage est désactivée.",
            "unavailable": "La caméra n’est pas disponible dans cette version. Vous pouvez choisir la présentation plus calme ci-dessous.",
            "start": "Démarrer la caméra", "stop": "Arrêter la caméra", "waiting": "Recherche d’une mesure fiable…",
            "reading": "Mesure respiratoire Presage : %d respirations/minute",
            "offer": "Une présentation plus calme vous aiderait-elle à décrire votre problème ?",
            "turnOn": "Utiliser la présentation calme", "turnOff": "Utiliser la présentation standard",
            "manual": "Présentation calme des commentaires", "explanation": "Seule la présentation change. L’admissibilité, l’acheminement et la priorité restent identiques. Il ne s’agit pas d’une évaluation de santé.",
            "failed": "La caméra n’a pas pu démarrer. Vous pouvez utiliser la présentation calme sans elle.",
            "preview": "Aperçu de la caméra",
        ]
        return (model.locale == .en ? english : french)[key] ?? key
    }
}
