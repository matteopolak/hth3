import SwiftUI

enum CivicTheme {
    static let accent = Color(red: 0.08, green: 0.38, blue: 0.37)
    static let ink = Color(red: 0.12, green: 0.17, blue: 0.19)
    static let muted = Color(red: 0.34, green: 0.40, blue: 0.42)
    static let canvas = Color(red: 0.96, green: 0.97, blue: 0.97)
    static let border = Color(red: 0.84, green: 0.87, blue: 0.88)
    static let warning = Color(red: 0.49, green: 0.30, blue: 0.08)
    static let success = Color(red: 0.15, green: 0.42, blue: 0.31)

    static func card<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content()
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.white, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(border.opacity(0.75), lineWidth: 1)
            }
    }
}

struct SandboxBadge: View {
    let title: String

    var body: some View {
        Label(title, systemImage: "flask")
            .font(.caption.weight(.semibold))
            .foregroundStyle(CivicTheme.warning)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Color.orange.opacity(0.10), in: Capsule())
    }
}

struct InlineNotice: View {
    let message: String
    var isError = false

    var body: some View {
        Label(message, systemImage: isError ? "exclamationmark.triangle" : "info.circle")
            .font(.subheadline)
            .foregroundStyle(isError ? .red : CivicTheme.muted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(isError ? Color.red.opacity(0.07) : CivicTheme.accent.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(isError ? .isStaticText : .isStaticText)
    }
}
