import Foundation
import Security

struct AssistantConversation: Decodable, Identifiable {
    let id: String
    let mode: String
    let locale: String
    let createdAt: String
    let updatedAt: String
}

struct AssistantMessage: Decodable, Identifiable {
    let id: String
    let role: String
    let content: String
    let createdAt: String
}

struct AssistantTool: Decodable, Identifiable {
    let name: String
    let access: String
    let description: String
    var id: String { name }
}

struct AssistantProposal: Decodable, Identifiable {
    let id: String
    let status: String
    let preview: AssistantValue
    let expiresAt: String?

    var name: String { preview.object?["name"]?.string ?? "" }
    var requiresSandboxAcknowledgment: Bool { name == "create_feedback" }
}

indirect enum AssistantValue: Decodable {
    case object([String: AssistantValue])
    case array([AssistantValue])
    case string(String)
    case number(Double)
    case bool(Bool)
    case null

    init(from decoder: Decoder) throws {
        let value = try decoder.singleValueContainer()
        if value.decodeNil() { self = .null }
        else if let object = try? value.decode([String: AssistantValue].self) { self = .object(object) }
        else if let array = try? value.decode([AssistantValue].self) { self = .array(array) }
        else if let string = try? value.decode(String.self) { self = .string(string) }
        else if let bool = try? value.decode(Bool.self) { self = .bool(bool) }
        else { self = .number(try value.decode(Double.self)) }
    }

    var object: [String: AssistantValue]? {
        if case let .object(value) = self { return value }
        return nil
    }

    var string: String? {
        if case let .string(value) = self { return value }
        return nil
    }

    var displayed: String {
        switch self {
        case let .string(value): return value
        case let .number(value): return String(value)
        case let .bool(value): return value ? "true" : "false"
        case .null: return ""
        case let .array(items): return items.map(\.displayed).joined(separator: ", ")
        case let .object(entries):
            return entries.keys.sorted().compactMap { key in
                if ["receiptToken", "conversationToken", "accessToken"].contains(key) { return nil }
                guard let text = entries[key]?.displayed, !text.isEmpty else { return nil }
                return "\(key): \(text)"
            }.joined(separator: "\n")
        }
    }
}

struct AssistantThread: Codable, Identifiable {
    let id: String
    var token: String?
    var title: String
    var updatedAt: Date
    var idIsGuest: Bool { token != nil }
}

struct AssistantConversationCreate: Decodable {
    let conversation: AssistantConversation
    let conversationToken: String?
    let tools: [AssistantTool]
}

struct AssistantConversationDetail: Decodable {
    let conversation: AssistantConversation
    let messages: [AssistantMessage]
    let proposals: [AssistantProposal]
    let tools: [AssistantTool]
}

struct AssistantSendResult: Decodable {
    let message: String
    let toolResult: AssistantValue?
    let proposal: AssistantProposal?
}

struct AssistantToolResult: Decodable {
    let result: AssistantValue?
    let proposal: AssistantProposal?
}

struct AssistantDecisionResult: Decodable {
    let proposal: AssistantProposalDecision
    let result: AssistantValue?
}

struct AssistantProposalDecision: Decodable {
    let id: String
    let status: String
}

enum AssistantAPIError: LocalizedError {
    case unavailable
    case failed(String)
    case unreadable
    case missingCredentials

    var errorDescription: String? {
        switch self {
        case .unavailable: return "The service could not be reached."
        case let .failed(message): return message
        case .unreadable: return "The service returned an unreadable response."
        case .missingCredentials: return "This conversation needs the account that created it."
        }
    }
}

struct ResidentAssistantAPI {
    private let baseURL: URL
    private let session: URLSession

    init(session: URLSession = .shared) {
        let configured = Bundle.main.object(forInfoDictionaryKey: "CIVICRESOLVE_API_BASE_URL") as? String
        baseURL = URL(string: configured ?? "") ?? URL(string: "http://127.0.0.1:5173/api/v1")!
        self.session = session
    }

    func create(locale: String, accessToken: String?) async throws -> AssistantConversationCreate {
        try await request("/agent/conversations", method: "POST", accessToken: accessToken,
                          body: ["mode": "resident", "locale": locale])
    }

    func list(accessToken: String) async throws -> [AssistantConversation] {
        let response: AssistantConversationList = try await request("/agent/conversations", accessToken: accessToken)
        return response.conversations
    }

    func detail(_ thread: AssistantThread, accessToken: String?) async throws -> AssistantConversationDetail {
        try await request("/agent/conversations/\(thread.id)", accessToken: accessToken, conversationToken: thread.token)
    }

    func send(_ text: String, thread: AssistantThread, accessToken: String?) async throws -> AssistantSendResult {
        try await request("/agent/conversations/\(thread.id)/messages", method: "POST", accessToken: accessToken,
                          conversationToken: thread.token, body: ["message": text])
    }

    func invoke(_ name: String, args: [String: Any], thread: AssistantThread, accessToken: String?) async throws -> AssistantToolResult {
        try await request("/agent/conversations/\(thread.id)/tools", method: "POST", accessToken: accessToken,
                          conversationToken: thread.token, body: ["tool": name, "args": args])
    }

    func decide(_ proposal: AssistantProposal, approve: Bool, acknowledged: Bool,
                thread: AssistantThread, accessToken: String?, receiptToken: String?) async throws -> AssistantDecisionResult {
        try await request("/agent/conversations/\(thread.id)/proposals/\(proposal.id)/\(approve ? "approve" : "reject")",
                          method: "POST", accessToken: accessToken, conversationToken: thread.token,
                          receiptToken: receiptToken,
                          body: approve ? ["approved": true, "sandboxAcknowledged": acknowledged] : [:])
    }

    private func request<Response: Decodable>(
        _ path: String, method: String = "GET", accessToken: String? = nil,
        conversationToken: String? = nil, receiptToken: String? = nil,
        body: [String: Any]? = nil
    ) async throws -> Response {
        if accessToken == nil && conversationToken == nil && !(method == "POST" && path == "/agent/conversations") {
            throw AssistantAPIError.missingCredentials
        }
        guard let url = URL(string: baseURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + path) else {
            throw AssistantAPIError.unreadable
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let accessToken { request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization") }
        if let conversationToken { request.setValue(conversationToken, forHTTPHeaderField: "X-Conversation-Token") }
        if let receiptToken { request.setValue(receiptToken, forHTTPHeaderField: "X-Receipt-Token") }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let data: Data
        let response: URLResponse
        do { (data, response) = try await session.data(for: request) }
        catch { throw AssistantAPIError.unavailable }
        guard let http = response as? HTTPURLResponse else { throw AssistantAPIError.unreadable }
        if !(200..<300).contains(http.statusCode) {
            let envelope = try? JSONDecoder().decode(AssistantErrorEnvelope.self, from: data)
            throw AssistantAPIError.failed(envelope?.error.message ?? "The request could not be completed (\(http.statusCode)).")
        }
        guard let decoded = try? JSONDecoder().decode(Response.self, from: data) else { throw AssistantAPIError.unreadable }
        return decoded
    }
}

private struct AssistantConversationList: Decodable { let conversations: [AssistantConversation] }
private struct AssistantErrorEnvelope: Decodable {
    struct Detail: Decodable { let message: String }
    let error: Detail
}

enum AssistantThreadStore {
    private static let service = "com.matteopolak.envoy.assistant"
    private static let account = "resident-threads"

    static func load() -> [AssistantThread] {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return [] }
        return (try? JSONDecoder().decode([AssistantThread].self, from: data)) ?? []
    }

    static func save(_ threads: [AssistantThread]) throws {
        let data = try JSONEncoder().encode(threads)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
        var insert = query
        insert[kSecValueData as String] = data
        insert[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(insert as CFDictionary, nil)
        if status != errSecSuccess { throw AssistantAPIError.failed("Could not securely save this conversation.") }
    }
}
