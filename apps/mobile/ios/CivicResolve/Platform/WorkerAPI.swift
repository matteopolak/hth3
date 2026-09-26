import Foundation

struct Posting: Decodable, Identifiable {
    let id: String
    let organizationName: String
    let title: String
    let description: String
    let location: String
    let sample: Bool
}

struct FeedbackMessage: Decodable, Identifiable {
    let id: String
    let author: String
    let body: String
    let createdAt: String
}

struct Municipality: Decodable {
    let id: String
    let name: String
    let province: String
}

struct FeedbackReceipt: Decodable, Identifiable {
    let id: String
    let originalText: String
    let constructiveFollowUp: String?
    let sample: Bool
    let municipality: Municipality?
    let status: String
    let messages: [FeedbackMessage]
    let outcome: String?
}

struct CivicApplication: Decodable, Identifiable {
    let id: String
    let postingId: String
    let postingTitle: String?
    let status: String
    let sample: Bool
    let submittedAt: String
    let updatedAt: String
    let answers: [String: String]
}

struct WorkerError: Decodable {
    struct Detail: Decodable {
        let code: String
        let message: String
        let requestId: String
    }
    let error: Detail
}

enum WorkerAPIError: LocalizedError {
    case unavailable
    case requestFailed(status: Int, code: String)
    case malformedResponse

    var errorDescription: String? {
        switch self {
        case .unavailable: return "The service could not be reached. Check your connection and try again."
        case let .requestFailed(_, code): return "The request could not be completed (\(code)). No success was assumed."
        case .malformedResponse: return "The service returned an unreadable response."
        }
    }

    var code: String {
        switch self {
        case .unavailable: return "NETWORK_ERROR"
        case let .requestFailed(_, code): return code
        case .malformedResponse: return "BAD_RESPONSE"
        }
    }
}

struct WorkerAPI {
    private let baseURL: URL
    private let session: URLSession

    init(baseURL: URL? = nil, session: URLSession = .shared) {
        if let baseURL {
            self.baseURL = baseURL
        } else if let configured = Bundle.main.object(forInfoDictionaryKey: "CIVICRESOLVE_API_BASE_URL") as? String,
                  let url = URL(string: configured) {
            self.baseURL = url
        } else {
            self.baseURL = URL(string: "http://127.0.0.1:8787/api/v1")!
        }
        self.session = session
    }

    func postings() async throws -> [Posting] {
        try await get("/postings", as: PostingEnvelope.self).postings
    }

    func applications(token: String) async throws -> [CivicApplication] {
        try await get("/applications", token: token, as: ApplicationsEnvelope.self).applications
    }

    func submitApplication(token: String, postingId: String, experience: String, availability: String) async throws -> CivicApplication {
        let body = ApplicationSubmission(
            postingId: postingId,
            answers: ["experience": experience, "availability": availability],
            confirmedByApplicant: true
        )
        return try await send("/applications", method: "POST", token: token, idempotent: true, body: body, as: ApplicationEnvelope.self).application
    }

    func submitFeedback(message: String, improvement: String, locale: AppLocale, receiptToken: String) async throws -> (FeedbackReceipt, String) {
        let body = FeedbackSubmission(
            message: message,
            whatWouldImprove: improvement.isEmpty ? nil : improvement,
            municipalityId: "3520005",
            sandboxAcknowledged: true,
            locale: locale.rawValue
        )
        let result = try await send("/feedback", method: "POST", receiptToken: receiptToken, idempotent: true, body: body, as: FeedbackEnvelope.self)
        return (result.submission, result.receiptToken)
    }

    func receipt(_ credentials: ReceiptCredentials) async throws -> FeedbackReceipt {
        let path = "/feedback/receipts/\(credentials.submissionId)"
        return try await send(path, method: "GET", receiptToken: credentials.receiptToken, as: ReceiptEnvelope.self).submission
    }

    func reply(to credentials: ReceiptCredentials, message: String) async throws {
        let body = MessageSubmission(message: message)
        let path = "/feedback/receipts/\(credentials.submissionId)/messages"
        let _: MessageEnvelope = try await send(path, method: "POST", receiptToken: credentials.receiptToken, idempotent: true, body: body)
    }

    private func get<Response: Decodable>(_ path: String, token: String? = nil, as type: Response.Type) async throws -> Response {
        try await send(path, method: "GET", token: token, as: type)
    }

    private func send<Response: Decodable, Body: Encodable>(
        _ path: String,
        method: String,
        token: String? = nil,
        receiptToken: String? = nil,
        idempotent: Bool = false,
        body: Body,
        as type: Response.Type = Response.self
    ) async throws -> Response {
        var request = makeRequest(path, method: method, token: token, receiptToken: receiptToken, idempotent: idempotent)
        request.httpBody = try JSONEncoder().encode(body)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return try await perform(request, as: type)
    }

    private func send<Response: Decodable>(
        _ path: String,
        method: String,
        token: String? = nil,
        receiptToken: String? = nil,
        idempotent: Bool = false,
        as type: Response.Type
    ) async throws -> Response {
        try await perform(makeRequest(path, method: method, token: token, receiptToken: receiptToken, idempotent: idempotent), as: type)
    }

    private func makeRequest(_ path: String, method: String, token: String?, receiptToken: String?, idempotent: Bool) -> URLRequest {
        var request = URLRequest(url: baseURL.appending(path: path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let receiptToken { request.setValue(receiptToken, forHTTPHeaderField: "X-Receipt-Token") }
        if idempotent { request.setValue(UUID().uuidString, forHTTPHeaderField: "Idempotency-Key") }
        return request
    }

    private func perform<Response: Decodable>(_ request: URLRequest, as type: Response.Type) async throws -> Response {
        let data: Data
        let response: URLResponse
        do { (data, response) = try await session.data(for: request) }
        catch { throw WorkerAPIError.unavailable }
        guard let http = response as? HTTPURLResponse else { throw WorkerAPIError.malformedResponse }
        guard (200..<300).contains(http.statusCode) else {
            let payload = try? JSONDecoder().decode(WorkerError.self, from: data)
            throw WorkerAPIError.requestFailed(status: http.statusCode, code: payload?.error.code ?? "REQUEST_FAILED")
        }
        guard let value = try? JSONDecoder().decode(type, from: data) else { throw WorkerAPIError.malformedResponse }
        return value
    }
}

private struct PostingEnvelope: Decodable { let postings: [Posting] }
private struct ApplicationsEnvelope: Decodable { let applications: [CivicApplication] }
private struct ApplicationEnvelope: Decodable { let application: CivicApplication }
private struct FeedbackEnvelope: Decodable { let submission: FeedbackReceipt; let receiptToken: String }
private struct ReceiptEnvelope: Decodable { let submission: FeedbackReceipt }
private struct MessageEnvelope: Decodable { let message: FeedbackMessage }
private struct ApplicationSubmission: Encodable { let postingId: String; let answers: [String: String]; let confirmedByApplicant: Bool }
private struct FeedbackSubmission: Encodable {
    let message: String
    let whatWouldImprove: String?
    let municipalityId: String
    let sandboxAcknowledged: Bool
    let locale: String
}
private struct MessageSubmission: Encodable { let message: String }
