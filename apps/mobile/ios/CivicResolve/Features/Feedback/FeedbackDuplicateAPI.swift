import Foundation

struct FeedbackDuplicateCandidate: Decodable {
    let status: String
}

enum FeedbackCreateResult {
    case created(FeedbackReceipt, receiptToken: String)
    case duplicate(FeedbackDuplicateCandidate)
}

struct FeedbackDuplicateAPI {
    private let baseURL: URL
    private let session: URLSession
    private let municipalityID = "3520005"

    init(session: URLSession = .shared) {
        let configured = Bundle.main.object(forInfoDictionaryKey: "CIVICRESOLVE_API_BASE_URL") as? String
        baseURL = URL(string: configured ?? "") ?? URL(string: "http://127.0.0.1:5173/api/v1")!
        self.session = session
    }

    func check(message: String) async throws -> FeedbackDuplicateCandidate? {
        let body = DuplicateCheckRequest(message: message, municipalityId: municipalityID)
        let response: DuplicateCheckResponse = try await post("/feedback/duplicate-check", body: body)
        return response.duplicate
    }

    func create(message: String, improvement: String, locale: AppLocale, receiptToken: String, duplicateOverride: Bool) async throws -> FeedbackCreateResult {
        let body = FeedbackCreateRequest(
            message: message,
            whatWouldImprove: improvement.isEmpty ? nil : improvement,
            municipalityId: municipalityID,
            sandboxAcknowledged: true,
            locale: locale.rawValue,
            duplicateOverride: duplicateOverride ? true : nil
        )
        let response: FeedbackCreateResponse = try await post("/feedback", receiptToken: receiptToken, idempotencyKey: UUID().uuidString, body: body)
        if response.result == "duplicate", let duplicate = response.duplicate {
            return .duplicate(duplicate)
        }
        guard let submission = response.submission, let returnedToken = response.receiptToken else {
            throw WorkerAPIError.malformedResponse
        }
        return .created(submission, receiptToken: returnedToken)
    }

    private func post<Response: Decodable, Body: Encodable>(_ path: String, receiptToken: String? = nil, idempotencyKey: String? = nil, body: Body) async throws -> Response {
        var request = URLRequest(url: baseURL.appending(path: String(path.dropFirst())))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let receiptToken { request.setValue(receiptToken, forHTTPHeaderField: "X-Receipt-Token") }
        if let idempotencyKey { request.setValue(idempotencyKey, forHTTPHeaderField: "Idempotency-Key") }
        request.httpBody = try JSONEncoder().encode(body)
        let data: Data
        let response: URLResponse
        do { (data, response) = try await session.data(for: request) }
        catch { throw WorkerAPIError.unavailable }
        guard let http = response as? HTTPURLResponse else { throw WorkerAPIError.malformedResponse }
        guard (200..<300).contains(http.statusCode) else {
            let payload = try? JSONDecoder().decode(WorkerError.self, from: data)
            throw WorkerAPIError.requestFailed(status: http.statusCode, code: payload?.error.code ?? "REQUEST_FAILED")
        }
        guard let decoded = try? JSONDecoder().decode(Response.self, from: data) else {
            throw WorkerAPIError.malformedResponse
        }
        return decoded
    }
}

private struct DuplicateCheckRequest: Encodable {
    let message: String
    let municipalityId: String
}

private struct DuplicateCheckResponse: Decodable {
    let duplicate: FeedbackDuplicateCandidate?
}

private struct FeedbackCreateRequest: Encodable {
    let message: String
    let whatWouldImprove: String?
    let municipalityId: String
    let sandboxAcknowledged: Bool
    let locale: String
    let duplicateOverride: Bool?
}

private struct FeedbackCreateResponse: Decodable {
    let result: String?
    let duplicate: FeedbackDuplicateCandidate?
    let submission: FeedbackReceipt?
    let receiptToken: String?
}
