import Auth0
import Foundation

@MainActor
final class Auth0Session {
    private let clientId: String?
    private let domain: String?
    private let audience: String?
    private let redirectURL: URL?
    private let credentialsManager: CredentialsManager?

    init(bundle: Bundle = .main) {
        clientId = bundle.object(forInfoDictionaryKey: "CIVICRESOLVE_AUTH0_CLIENT_ID") as? String
        domain = bundle.object(forInfoDictionaryKey: "CIVICRESOLVE_AUTH0_DOMAIN") as? String
        audience = bundle.object(forInfoDictionaryKey: "CIVICRESOLVE_AUTH0_AUDIENCE") as? String
        redirectURL = (bundle.object(forInfoDictionaryKey: "CIVICRESOLVE_AUTH0_REDIRECT_URL") as? String).flatMap { URL(string: $0) }
        if let clientId, let domain {
            credentialsManager = CredentialsManager(authentication: Auth0.authentication(clientId: clientId, domain: domain))
        } else {
            credentialsManager = nil
        }
    }

    var isConfigured: Bool {
        clientId?.isEmpty == false && domain?.isEmpty == false && audience?.isEmpty == false && redirectURL != nil
    }

    func signIn() async throws -> String {
        guard let clientId, let domain, let audience, let redirectURL,
              let credentialsManager else {
            throw AuthSessionError.notConfigured
        }
        let credentials = try await Auth0
            .webAuth(clientId: clientId, domain: domain)
            .audience(audience)
            .scope("openid profile email offline_access read:applications submit:applications write:applications read:profile write:profile")
            .redirectURL(redirectURL)
            .useCredentialsManager(credentialsManager)
            .start()
        return credentials.accessToken
    }

    func restoreAccessToken() async throws -> String {
        guard let credentialsManager else { throw AuthSessionError.notConfigured }
        return try await credentialsManager.credentials().accessToken
    }

    func signOut() async throws {
        guard let clientId, let domain, let redirectURL,
              let credentialsManager else {
            throw AuthSessionError.notConfigured
        }
        do {
            try await Auth0.webAuth(clientId: clientId, domain: domain)
                .redirectURL(redirectURL)
                .logout()
        } catch {
            try? credentialsManager.clear()
            throw error
        }
        try credentialsManager.clear()
    }
}

enum AuthSessionError: Error {
    case notConfigured
}
