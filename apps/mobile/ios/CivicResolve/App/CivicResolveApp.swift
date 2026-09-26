import SwiftUI

@main
struct CivicResolveApp: App {
    @StateObject private var model = CivicResolveModel()

    var body: some Scene {
        WindowGroup {
            CivicResolveTabs()
                .environmentObject(model)
                .preferredColorScheme(.light)
        }
    }
}
