import SwiftUI

enum CivicTheme {
    static let accent = Color.black
    static let ink = Color.black
    static let muted = Color(red: 0.36, green: 0.36, blue: 0.36)
    static let canvas = Color(red: 0.975, green: 0.975, blue: 0.975)
    static let border = Color(red: 0.86, green: 0.86, blue: 0.86)
    static let warning = Color(red: 0.33, green: 0.33, blue: 0.33)
    static let success = Color.black

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
            .background(CivicTheme.canvas, in: Capsule())
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
