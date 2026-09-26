import Foundation

enum LocalIdentity: String, CaseIterable, Identifiable {
    case none = ""
    case applicant = "dev-applicant"

    var id: String { rawValue }

    func label(_ locale: AppLocale) -> String {
        switch self {
        case .none: return locale == .en ? "Signed out" : "Déconnecté"
        case .applicant: return locale == .en ? "Local sample applicant" : "Candidat fictif local"
        }
    }
}

enum AppLocale: String, CaseIterable {
    case en
    case fr
}
