import SwiftUI

struct FeedbackView: View {
    @EnvironmentObject private var model: CivicResolveModel
    @AppStorage("envoy.calmWriting") private var calmWriting = false
    @State private var duplicate: FeedbackDuplicateCandidate?
    @State private var duplicateOverride = false
    @State private var checkingDuplicate = false
    @State private var duplicateCheckFailed = false
    @State private var previewRequestID: UUID?
    private let duplicateAPI = FeedbackDuplicateAPI()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if model.emergencyGuidanceShowing {
                    emergencyGuidance
                } else {
                    if let receipt = model.feedbackReceipt {
                        receiptCard(receipt)
                    }
                    CivicTheme.card {
                        VStack(alignment: .leading, spacing: 16) {
                            if model.feedbackReviewing {
                                review
                            } else {
                                field(copy("feedback.message"), hint: copy("feedback.messageHint"), text: $model.feedbackDraft, minHeight: calmWriting ? 230 : 124)
                                if !calmWriting || !model.improvementDraft.isEmpty {
                                    field(copy("feedback.improvement"), hint: copy("feedback.improvementHint"), text: $model.improvementDraft, minHeight: 84)
                                }
                                Button(copy("feedback.review")) {
                                    model.error = nil
                                    model.feedbackReviewing = true
                                    duplicate = nil
                                    duplicateOverride = false
                                    duplicateCheckFailed = false
                                    checkingDuplicate = true
                                    let requestID = UUID()
                                    previewRequestID = requestID
                                    Task { await checkDuplicate(requestID: requestID) }
                                }
                                .buttonStyle(.borderedProminent)
                                .disabled(model.feedbackDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || model.isWorking)
                            }
                        }
                    }
                    Button {
                        model.emergencyGuidanceShowing = true
                    } label: {
                        Label(copy("feedback.emergencyAction"), systemImage: "phone.fill")
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .buttonStyle(.bordered)
                    .tint(CivicTheme.warning)
                    if let error = model.error { InlineNotice(message: error, isError: true) }
                    if let notice = model.notice { InlineNotice(message: notice) }
                    if model.isWorking { ProgressView(copy("common.loading")) }
                }
            }
            .padding(20)
            .frame(maxWidth: 720, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .background(CivicTheme.canvas)
        .task { await restoreReceipt() }
        .refreshable { await model.refreshReceipt() }
    }

    private var emergencyGuidance: some View {
        CivicTheme.card {
            VStack(alignment: .leading, spacing: 16) {
                Label(copy("feedback.emergencyTitle"), systemImage: "exclamationmark.triangle.fill")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(CivicTheme.warning)
                Text(copy("feedback.emergencyGuidance"))
                    .font(.body)
                    .fixedSize(horizontal: false, vertical: true)
                if let number = URL(string: "tel:911") {
                    Link(destination: number) {
                        Label(copy("feedback.call911"), systemImage: "phone.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(CivicTheme.warning)
                }
                Button(copy("feedback.back")) {
                    model.emergencyGuidanceShowing = false
                }
                .buttonStyle(.bordered)
            }
        }
    }

    private var review: some View {
        return VStack(alignment: .leading, spacing: 14) {
            Text(copy("feedback.reviewTitle")).font(.title2.weight(.semibold))
            Text(copy("feedback.original")).font(.caption.weight(.semibold)).foregroundStyle(CivicTheme.muted)
            Text(model.feedbackDraft).textSelection(.enabled).frame(maxWidth: .infinity, alignment: .leading)
                .padding(12).background(CivicTheme.canvas, in: RoundedRectangle(cornerRadius: 10))
            if !model.improvementDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Text(copy("feedback.improvement")).font(.caption.weight(.semibold)).foregroundStyle(CivicTheme.muted)
                Text(model.improvementDraft).textSelection(.enabled)
            }
            if checkingDuplicate {
                ProgressView(previewCopy("checking"))
                    .font(.subheadline)
            } else if let duplicate {
                VStack(alignment: .leading, spacing: 9) {
                    Label(previewCopy("similarTitle"), systemImage: "doc.on.doc")
                        .font(.subheadline.weight(.semibold))
                    Text(previewCopy("similarBody"))
                        .font(.subheadline)
                    Text("\(previewCopy("status")): \(model.statusCopy(duplicate.status))")
                        .font(.subheadline.weight(.medium))
                    Toggle(previewCopy("separateIssue"), isOn: $duplicateOverride)
                        .font(.subheadline)
                    Text(previewCopy("sameIssue"))
                        .font(.caption).foregroundStyle(CivicTheme.muted)
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(CivicTheme.canvas, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(CivicTheme.border))
            } else if duplicateCheckFailed {
                InlineNotice(message: previewCopy("checkUnavailable"))
            }
            Toggle(copy("feedback.ack"), isOn: $model.feedbackAcknowledged)
                .font(.subheadline)
            HStack {
                Button(copy("feedback.edit")) {
                    model.feedbackReviewing = false
                    duplicate = nil
                    duplicateOverride = false
                    previewRequestID = nil
                    checkingDuplicate = false
                }
                    .buttonStyle(.bordered)
                Button(copy("feedback.send")) { Task { await submitReviewedFeedback() } }
                    .buttonStyle(.borderedProminent)
                    .disabled(!model.feedbackAcknowledged || model.isWorking || checkingDuplicate || (duplicate != nil && !duplicateOverride))
            }
        }
    }

    private func checkDuplicate(requestID: UUID) async {
        let message = model.feedbackDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard message.count >= 48, message.split(whereSeparator: { $0.isWhitespace }).count >= 7 else {
            if previewRequestID == requestID { checkingDuplicate = false }
            return
        }
        defer { if previewRequestID == requestID { checkingDuplicate = false } }
        do {
            let candidate = try await duplicateAPI.check(message: message)
            if previewRequestID == requestID { duplicate = candidate }
        } catch {
            if previewRequestID == requestID { duplicateCheckFailed = true }
        }
    }

    private func submitReviewedFeedback() async {
        guard model.feedbackAcknowledged, !model.feedbackDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        model.isWorking = true
        model.error = nil
        model.notice = nil
        defer { model.isWorking = false }
        do {
            let token = try KeychainReceiptStore.randomToken()
            let result = try await duplicateAPI.create(
                message: model.feedbackDraft,
                improvement: model.improvementDraft,
                locale: model.locale,
                receiptToken: token,
                duplicateOverride: duplicateOverride
            )
            switch result {
            case let .duplicate(candidate):
                duplicate = candidate
                duplicateOverride = false
                duplicateCheckFailed = false
            case let .created(receipt, returnedToken):
                let credentials = ReceiptCredentials(submissionId: receipt.id, receiptToken: returnedToken)
                model.credentials = credentials
                model.feedbackReceipt = receipt
                model.feedbackDraft = ""
                model.improvementDraft = ""
                model.feedbackReviewing = false
                model.feedbackAcknowledged = false
                duplicate = nil
                duplicateOverride = false
                previewRequestID = nil
                model.notice = copy("feedback.sent")
                do { try KeychainReceiptStore.save(credentials) }
                catch { model.error = copy("feedback.keychainFailed") }
            }
        } catch {
            model.error = error.localizedDescription
        }
    }

    private func receiptCard(_ receipt: FeedbackReceipt) -> some View {
        return CivicTheme.card {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text(copy("feedback.receipt")).font(.headline)
                    Spacer()
                    Text(model.statusCopy(receipt.status))
                        .font(.caption.weight(.semibold)).padding(.horizontal, 9).padding(.vertical, 5)
                        .background(CivicTheme.accent.opacity(0.10), in: Capsule())
                }
                Text(receipt.id).font(.caption.monospaced()).foregroundStyle(CivicTheme.muted)
                if let municipality = receipt.municipality {
                    Text("\(municipality.name), \(municipality.province)")
                        .font(.caption).foregroundStyle(CivicTheme.muted)
                }
                Text(receipt.originalText).textSelection(.enabled)
                if let outcome = receipt.outcome, !outcome.isEmpty { Text(outcome).font(.subheadline) }
                ForEach(receipt.messages) { message in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(message.author == "staff" ? copy("feedback.sampleQueue") : copy("feedback.original"))
                            .font(.caption.weight(.semibold)).foregroundStyle(CivicTheme.muted)
                        Text(message.body).textSelection(.enabled)
                    }
                    .padding(10).frame(maxWidth: .infinity, alignment: .leading)
                    .background(CivicTheme.canvas, in: RoundedRectangle(cornerRadius: 10))
                }
                Button(copy("feedback.refresh")) { Task { await model.refreshReceipt() } }
                    .buttonStyle(.bordered)
                let needsReopen = ["closed", "outcome_recorded"].contains(receipt.status)
                field(copy(needsReopen ? "feedback.reopen" : "feedback.reply"),
                      hint: copy(needsReopen ? "feedback.reopenHint" : "feedback.replyHint"),
                      text: $model.replyDraft, minHeight: 78)
                Button(copy(needsReopen ? "feedback.reopen" : "feedback.replySend")) {
                    Task {
                        if needsReopen { await model.reopenFeedback() }
                        else { await model.sendReply() }
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(model.replyDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || model.isWorking)
            }
        }
    }

    private func field(_ title: String, hint: String, text: Binding<String>, minHeight: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title).font(.subheadline.weight(.semibold))
            TextField(hint, text: text, axis: .vertical)
                .lineLimit(3...8)
                .font(calmWriting ? .title3 : .body)
                .padding(12)
                .frame(minHeight: minHeight, alignment: .topLeading)
                .background(.white, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(CivicTheme.border, lineWidth: 1))
                .accessibilityLabel(title)
        }
    }

    private func copy(_ key: String) -> String { model.copy(key) }

    private func restoreReceipt() async {
        if let latest = KeychainReceiptStore.load(), latest != model.credentials {
            model.credentials = latest
        }
        await model.refreshReceipt()
    }

    private func previewCopy(_ key: String) -> String {
        let english: [String: String] = [
            "checking": "Checking for similar reports…",
            "similarTitle": "A similar report may already be open",
            "similarBody": "Only its current status is shown. No one else’s report or personal information is shared.",
            "status": "Current status",
            "separateIssue": "This is a separate issue or a recurrence. Send my report anyway.",
            "sameIssue": "If this describes the same issue, you can keep your draft and avoid sending a duplicate.",
            "checkUnavailable": "Similar reports could not be checked now. The service will check again before saving your report.",
        ]
        let french: [String: String] = [
            "checking": "Recherche de signalements semblables…",
            "similarTitle": "Un signalement semblable est peut-être déjà ouvert",
            "similarBody": "Seul son état actuel est affiché. Le signalement et les renseignements personnels d’une autre personne ne sont pas partagés.",
            "status": "État actuel",
            "separateIssue": "Il s’agit d’un problème distinct ou récurrent. Envoyer quand même mon signalement.",
            "sameIssue": "S’il s’agit du même problème, vous pouvez garder votre brouillon sans envoyer de doublon.",
            "checkUnavailable": "La recherche de signalements semblables est indisponible. Le service vérifiera de nouveau avant d’enregistrer votre signalement.",
        ]
        return (model.locale == .fr ? french : english)[key] ?? key
    }
}
