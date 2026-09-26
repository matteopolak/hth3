import SwiftUI

struct CivicResolveTabs: View {
    @EnvironmentObject private var model: CivicResolveModel

    var body: some View {
        TabView {
            NavigationStack {
                DiscoveryView()
                    .navigationTitle(copy("nav.discover"))
                    .toolbar { languageToolbar }
            }
            .tabItem { Image(systemName: "magnifyingglass").accessibilityLabel(copy("nav.discover")) }

            NavigationStack {
                ResidentAssistantView()
                    .navigationTitle(copy("nav.assistant"))
                    .toolbar { languageToolbar }
            }
            .tabItem { Image(systemName: "bubble.left").accessibilityLabel(copy("nav.assistant")) }

            NavigationStack {
                FeedbackView()
                    .navigationTitle(copy("nav.feedback"))
                    .toolbar { languageToolbar }
            }
            .tabItem { Image(systemName: "bubble.left.and.bubble.right").accessibilityLabel(copy("nav.feedback")) }

            NavigationStack {
                ApplicationsView()
                    .navigationTitle(copy("nav.applications"))
                    .toolbar { languageToolbar }
            }
            .tabItem { Image(systemName: "briefcase").accessibilityLabel(copy("nav.applications")) }

            NavigationStack {
                ProfileView()
                    .navigationTitle(copy("nav.profile"))
                    .toolbar { languageToolbar }
            }
            .tabItem { Image(systemName: "person.crop.circle").accessibilityLabel(copy("nav.profile")) }

        }
        .tint(CivicTheme.accent)
        .task { await model.restoreAuthSession() }
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
