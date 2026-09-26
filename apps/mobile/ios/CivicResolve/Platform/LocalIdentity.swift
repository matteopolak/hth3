import Foundation

enum LocalIdentity: String, CaseIterable, Identifiable {
    case none = ""
    #if DEBUG
    case applicant = "dev-applicant"
    #endif

    var id: String { rawValue }

    func label(_ locale: AppLocale) -> String {
        switch self {
        case .none: return locale == .en ? "Signed out" : "Déconnecté"
        #if DEBUG
        case .applicant: return locale == .en ? "Local sample applicant" : "Candidat fictif local"
        #endif
        }
    }
}

enum AppLocale: String, CaseIterable {
    case en
    case fr
}
