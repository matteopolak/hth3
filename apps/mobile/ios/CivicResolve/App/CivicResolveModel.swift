import Foundation
import Combine

@MainActor
final class CivicResolveModel: ObservableObject {
    @Published var locale = AppLocale(
        rawValue: UserDefaults.standard.string(forKey: "civicresolve.locale") ?? "en"
    ) ?? .en {
        didSet { UserDefaults.standard.set(locale.rawValue, forKey: "civicresolve.locale") }
    }
    #if DEBUG
    @Published var identity: LocalIdentity = .applicant
    #else
    @Published var identity: LocalIdentity = .none
    #endif
    @Published var postings: [Posting] = []
    @Published var applications: [CivicApplication] = []
    @Published var selectedPostingId = ""
    @Published var feedbackReceipt: FeedbackReceipt?
    @Published var credentials = KeychainReceiptStore.load()
    @Published var feedbackDraft = ""
    @Published var improvementDraft = ""
    @Published var applicationExperience = ""
    @Published var applicationAvailability = ""
    @Published var replyDraft = ""
    @Published var feedbackReviewing = false
    @Published var feedbackAcknowledged = false
    @Published var applicationConfirmed = false
    @Published var isLoadingPostings = false
    @Published var isLoadingApplications = false
    @Published var isWorking = false
    @Published var error: String?
    @Published var notice: String?

    private let api = WorkerAPI()

    func copy(_ key: String) -> String {
        AppCopy.value(key, locale: locale)
    }

    func statusCopy(_ status: String) -> String {
        AppCopy.status(status, locale: locale)
    }

    var accessToken: String? {
        #if DEBUG
        return identity.rawValue.isEmpty ? nil : identity.rawValue
        #else
        return nil
        #endif
    }

    func loadPostings() async {
        isLoadingPostings = true
        error = nil
        defer { isLoadingPostings = false }
        do {
            postings = try await api.postings()
            if !postings.contains(where: { $0.id == selectedPostingId }) {
                selectedPostingId = postings.first?.id ?? ""
            }
        } catch { self.error = localizedError(error) }
    }

    func loadApplications() async {
        guard let accessToken else { applications = []; return }
        isLoadingApplications = true
        error = nil
        defer { isLoadingApplications = false }
        do { applications = try await api.applications(token: accessToken) }
        catch { self.error = localizedError(error) }
    }

    func submitFeedback() async {
        guard feedbackAcknowledged, !feedbackDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        isWorking = true
        error = nil
        notice = nil
        defer { isWorking = false }
        do {
            let token = try KeychainReceiptStore.randomToken()
            let (receipt, returnedToken) = try await api.submitFeedback(message: feedbackDraft, improvement: improvementDraft, locale: locale, receiptToken: token)
            let saved = ReceiptCredentials(submissionId: receipt.id, receiptToken: returnedToken)
            credentials = saved
            feedbackReceipt = receipt
            feedbackDraft = ""
            improvementDraft = ""
            feedbackReviewing = false
            feedbackAcknowledged = false
            notice = copy("feedback.sent")
            do { try KeychainReceiptStore.save(saved) }
            catch { self.error = copy("feedback.keychainFailed") }
        } catch { self.error = localizedError(error) }
    }

    func refreshReceipt() async {
        guard let credentials else { return }
        isWorking = true
        error = nil
        defer { isWorking = false }
        do { feedbackReceipt = try await api.receipt(credentials) }
        catch { self.error = localizedError(error) }
    }

    func sendReply() async {
        guard let credentials, !replyDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        isWorking = true
        error = nil
        defer { isWorking = false }
        do {
            try await api.reply(to: credentials, message: replyDraft)
            replyDraft = ""
            notice = copy("feedback.replySent")
            do { feedbackReceipt = try await api.receipt(credentials) }
            catch { self.error = localizedError(error) }
        } catch { self.error = localizedError(error) }
    }

    func submitApplication() async {
        guard applicationConfirmed else { return }
        guard let token = accessToken else { error = copy("auth.unavailable"); return }
        guard !selectedPostingId.isEmpty,
              !applicationExperience.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !applicationAvailability.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            error = copy("error.requiredFields")
            return
        }
        isWorking = true
        error = nil
        notice = nil
        defer { isWorking = false }
        do {
            let application = try await api.submitApplication(token: token, postingId: selectedPostingId, experience: applicationExperience, availability: applicationAvailability)
            applications.insert(application, at: 0)
            applicationConfirmed = false
            notice = copy("application.sent")
        } catch { self.error = localizedError(error) }
    }

    private func localizedError(_ error: Error) -> String {
        guard let apiError = error as? WorkerAPIError else { return copy("error.generic") }
        switch apiError.code {
        case "UNAUTHENTICATED": return copy("auth.signInRequired")
        case "FORBIDDEN": return copy("error.forbidden")
        case "DESTINATION_NOT_SUPPORTED": return copy("error.unsupportedDestination")
        case "SANDBOX_ACK_REQUIRED": return copy("feedback.ackRequired")
        case "EMERGENCY_REDIRECT": return copy("feedback.emergency")
        case "NETWORK_ERROR": return copy("error.network")
        default: return apiError.errorDescription ?? copy("error.generic")
        }
    }
}
