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
    @Published var authAccessToken: String?
    @Published var authIsWorking = false
    @Published var authMessage: String?
    @Published var profile = ApplicantProfile.empty
    @Published var profileSkillsText = ""
    @Published var resumes: [ResumeDocument] = []
    @Published var resumeExtraction: ResumeExtraction?
    @Published var profileIsLoading = false
    @Published var profileIsLoaded = false
    @Published var profileIsWorking = false
    @Published var profileError: String?
    @Published var profileNotice: String?
    @Published var feedbackDraft = ""
    @Published var improvementDraft = ""
    @Published var applicationExperience = ""
    @Published var applicationAvailability = ""
    @Published var replyDraft = ""
    @Published var feedbackReviewing = false
    @Published var feedbackAcknowledged = false
    @Published var emergencyGuidanceShowing = false
    @Published var applicationConfirmed = false
    @Published var isLoadingPostings = false
    @Published var isLoadingApplications = false
    @Published var isWorking = false
    @Published var error: String?
    @Published var notice: String?

    private let api = WorkerAPI()
    private let authSession = Auth0Session()
    private var profileLoadID = UUID()

    var authIsConfigured: Bool { authSession.isConfigured }
    var isAuth0SignedIn: Bool { authAccessToken != nil }
    #if DEBUG
    var isUsingLocalIdentity: Bool { !identity.rawValue.isEmpty }
    #else
    var isUsingLocalIdentity: Bool { false }
    #endif

    func copy(_ key: String) -> String {
        AppCopy.value(key, locale: locale)
    }

    func statusCopy(_ status: String) -> String {
        AppCopy.status(status, locale: locale)
    }

    var accessToken: String? {
        #if DEBUG
        if !identity.rawValue.isEmpty { return identity.rawValue }
        return authAccessToken
        #else
        return authAccessToken
        #endif
    }

    func restoreAuthSession() async {
        guard authSession.isConfigured, authAccessToken == nil else { return }
        do {
            authAccessToken = try await authSession.restoreAccessToken()
            #if DEBUG
            identity = .none
            #endif
        }
        catch { authAccessToken = nil }
    }

    func signIn() async {
        guard authSession.isConfigured else { authMessage = copy("auth.notConfigured"); return }
        authIsWorking = true
        authMessage = nil
        error = nil
        #if DEBUG
        identity = .none
        #endif
        defer { authIsWorking = false }
        do {
            authAccessToken = try await authSession.signIn()
        } catch {
            authMessage = copy("auth.signInError")
        }
    }

    func signOut() async {
        authIsWorking = true
        defer { authIsWorking = false }
        do {
            try await authSession.signOut()
            authMessage = copy("auth.signedOut")
        } catch {
            authMessage = copy("auth.logoutError")
        }
        authAccessToken = nil
        profile = .empty
        profileSkillsText = ""
        resumes = []
        resumeExtraction = nil
        applications = []
        #if DEBUG
        identity = .none
        #endif
    }

    func loadProfileWorkspace() async {
        let loadID = UUID()
        profileLoadID = loadID
        guard let token = accessToken else {
            profile = .empty
            profileSkillsText = ""
            resumes = []
            resumeExtraction = nil
            profileIsLoaded = false
            return
        }
        profileIsLoading = true
        profileIsLoaded = false
        profileError = nil
        resumes = []
        applications = []
        defer { if profileLoadID == loadID { profileIsLoading = false } }
        do {
            let loadedProfile = try await api.profile(token: token)
            guard profileLoadID == loadID, accessToken == token else { return }
            profile = loadedProfile
            profileSkillsText = profile.skills.joined(separator: "\n")
            let loadedResumes = try await api.resumes(token: token)
            guard profileLoadID == loadID, accessToken == token else { return }
            resumes = loadedResumes
            let loadedApplications = try await api.applications(token: token)
            guard profileLoadID == loadID, accessToken == token else { return }
            applications = loadedApplications
            profileIsLoaded = true
        } catch { if profileLoadID == loadID { profileError = localizedError(error) } }
    }

    func saveProfile() async {
        guard let token = accessToken else { profileError = copy("auth.signInRequired"); return }
        profile.skills = profileSkillsText
            .components(separatedBy: .newlines)
            .flatMap { $0.split(separator: ",").map(String.init) }
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        profileIsWorking = true
        profileError = nil
        profileNotice = nil
        defer { profileIsWorking = false }
        do {
            profile = try await api.saveProfile(profile, token: token)
            profileSkillsText = profile.skills.joined(separator: "\n")
            profileNotice = copy("profile.saved")
        } catch { profileError = localizedError(error) }
    }

    func uploadResume(data: Data, filename: String, contentType: String) async {
        guard let token = accessToken else { profileError = copy("auth.signInRequired"); return }
        profileIsWorking = true
        profileError = nil
        profileNotice = nil
        defer { profileIsWorking = false }
        do {
            let resume = try await api.uploadResume(data: data, filename: filename, contentType: contentType, token: token)
            resumes.insert(resume, at: 0)
            profileNotice = copy("profile.resumeUploaded")
        } catch { profileError = localizedError(error) }
    }

    func deleteResume(_ resume: ResumeDocument) async {
        guard let token = accessToken else { profileError = copy("auth.signInRequired"); return }
        profileIsWorking = true
        profileError = nil
        profileNotice = nil
        defer { profileIsWorking = false }
        do {
            try await api.deleteResume(id: resume.id, token: token)
            resumes.removeAll { $0.id == resume.id }
            if resumeExtraction?.resumeId == resume.id { resumeExtraction = nil }
            profileNotice = copy("profile.resumeDeleted")
        } catch { profileError = localizedError(error) }
    }

    func extractResume(_ resume: ResumeDocument) async {
        guard let token = accessToken else { profileError = copy("auth.signInRequired"); return }
        profileIsWorking = true
        profileError = nil
        profileNotice = nil
        defer { profileIsWorking = false }
        do {
            resumeExtraction = try await api.extractResume(id: resume.id, token: token)
            profileNotice = copy("profile.extractionReady")
        } catch { profileError = localizedError(error) }
    }

    func applyResumeSuggestion(_ suggestion: ResumeSuggestion) {
        let text: String?
        switch suggestion.value {
        case let .text(value): text = value
        case let .list(values): text = values.joined(separator: "\n")
        }
        guard let text else { return }
        switch suggestion.field {
        case "name": profile.name = text
        case "email": profile.email = text
        case "phone": profile.phone = text
        case "location": profile.location = text
        case "summary": profile.summary = text
        case "skills": profileSkillsText = ([profileSkillsText, text].filter { !$0.isEmpty }).joined(separator: "\n")
        case "education":
            if !profile.education.contains(where: { $0.description == text }) {
                profile.education.append(EducationEntry(description: text))
            }
        case "experience":
            if !profile.experience.contains(where: { $0.description == text }) {
                profile.experience.append(ExperienceEntry(description: text))
            }
        default: return
        }
        profileNotice = copy("profile.suggestionDrafted")
    }

    func shareResume(_ resume: ResumeDocument, with application: CivicApplication) async {
        guard let token = accessToken else { profileError = copy("auth.signInRequired"); return }
        profileIsWorking = true
        profileError = nil
        profileNotice = nil
        defer { profileIsWorking = false }
        do {
            try await api.shareResume(id: resume.id, with: application.id, token: token)
            profileNotice = copy("profile.resumeShared")
        } catch { profileError = localizedError(error) }
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

    func reopenFeedback() async {
        guard let credentials,
              let currentReceipt = feedbackReceipt,
              ["closed", "outcome_recorded"].contains(currentReceipt.status),
              !replyDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        isWorking = true
        error = nil
        notice = nil
        defer { isWorking = false }
        do {
            try await api.reopen(credentials, message: replyDraft)
            replyDraft = ""
            feedbackReceipt = try await api.receipt(credentials)
            notice = copy("feedback.reopened")
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
        case "SANDBOX_UNAVAILABLE": return copy("error.unsupportedDestination")
        case "ABUSE_CONTROL_UNAVAILABLE": return copy("error.abuseUnavailable")
        case "RATE_LIMITED": return copy("error.rateLimited")
        case "SANDBOX_ACK_REQUIRED": return copy("feedback.ackRequired")
        case "UNREADABLE_RESUME": return copy("error.unreadableResume")
        case "UNSUPPORTED_FILE_TYPE", "INVALID_FILE": return copy("error.unsupportedFile")
        case "EMERGENCY_REDIRECT": return copy("feedback.emergency")
        case "NETWORK_ERROR": return copy("error.network")
        default: return copy("error.generic")
        }
    }
}
