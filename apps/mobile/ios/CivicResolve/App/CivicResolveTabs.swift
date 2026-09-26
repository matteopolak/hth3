import SwiftUI

struct CivicResolveTabs: View {
    @EnvironmentObject private var model: CivicResolveModel

    var body: some View {
        TabView {
            NavigationStack {
                FeedbackView()
                    .navigationTitle(copy("app.name"))
                    .toolbar { languageToolbar }
            }
            .tabItem { Label(copy("nav.feedback"), systemImage: "bubble.left.and.bubble.right") }

            NavigationStack {
                ApplicationsView()
                    .navigationTitle(copy("nav.applications"))
                    .toolbar { languageToolbar }
            }
            .tabItem { Label(copy("nav.applications"), systemImage: "briefcase") }
        }
        .tint(CivicTheme.accent)
    }

    @ToolbarContentBuilder
    private var languageToolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                Button("English") { model.locale = .en }
                Button("Français") { model.locale = .fr }
                #if DEBUG
                Divider()
                Menu(copy("local.identityLabel")) {
                    ForEach(LocalIdentity.allCases) { identity in
                        Button(identity.label(model.locale)) { model.identity = identity }
                    }
                }
                #endif
            } label: {
                Label(model.locale == .en ? "EN" : "FR", systemImage: "globe")
                    .labelStyle(.titleAndIcon)
            }
            .accessibilityLabel(copy("app.language"))
        }
    }

    private func copy(_ key: String) -> String { model.copy(key) }
}
