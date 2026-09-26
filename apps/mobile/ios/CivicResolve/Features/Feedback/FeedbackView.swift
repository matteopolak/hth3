import SwiftUI

struct FeedbackView: View {
    @EnvironmentObject private var model: CivicResolveModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                SandboxBadge(title: copy("sandbox.title"))
                Text(copy("feedback.intro"))
                    .font(.subheadline)
                    .foregroundStyle(CivicTheme.muted)
                CivicTheme.card {
                    VStack(alignment: .leading, spacing: 16) {
                        if model.feedbackReviewing {
                            review
                        } else {
                            Text(copy("feedback.title"))
                                .font(.title2.weight(.semibold))
                            field(copy("feedback.message"), hint: copy("feedback.messageHint"), text: $model.feedbackDraft, minHeight: 124)
                            field(copy("feedback.improvement"), hint: copy("feedback.improvementHint"), text: $model.improvementDraft, minHeight: 84)
                            Button(copy("feedback.review")) {
                                model.error = nil
                                model.feedbackReviewing = true
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(model.feedbackDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || model.isWorking)
                        }
                    }
                }
                InlineNotice(message: copy("sandbox.body"))
                InlineNotice(message: copy("feedback.emergency"), isError: false)
                if let error = model.error { InlineNotice(message: error, isError: true) }
                if let notice = model.notice { InlineNotice(message: notice) }
                if let receipt = model.feedbackReceipt {
                    receiptCard(receipt)
                } else if model.credentials == nil {
                    Text(copy("feedback.noReceipt"))
                        .font(.footnote)
                        .foregroundStyle(CivicTheme.muted)
                }
                if model.isWorking { ProgressView(copy("common.loading")) }
            }
            .padding(20)
            .frame(maxWidth: 720, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .background(CivicTheme.canvas)
        .task { await model.refreshReceipt() }
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
            Toggle(copy("feedback.ack"), isOn: $model.feedbackAcknowledged)
                .font(.subheadline)
            HStack {
                Button(copy("feedback.edit")) { model.feedbackReviewing = false }
                    .buttonStyle(.bordered)
                Button(copy("feedback.send")) { Task { await model.submitFeedback() } }
                    .buttonStyle(.borderedProminent)
                    .disabled(!model.feedbackAcknowledged || model.isWorking)
            }
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
                        Text(message.author == "staff" ? "CivicResolve sample queue" : copy("feedback.original"))
                            .font(.caption.weight(.semibold)).foregroundStyle(CivicTheme.muted)
                        Text(message.body).textSelection(.enabled)
                    }
                    .padding(10).frame(maxWidth: .infinity, alignment: .leading)
                    .background(CivicTheme.canvas, in: RoundedRectangle(cornerRadius: 10))
                }
                Button(copy("feedback.refresh")) { Task { await model.refreshReceipt() } }
                    .buttonStyle(.bordered)
                if receipt.status != "closed" {
                    field(copy("feedback.reply"), hint: copy("feedback.replyHint"), text: $model.replyDraft, minHeight: 78)
                    Button(copy("feedback.replySend")) { Task { await model.sendReply() } }
                        .buttonStyle(.borderedProminent)
                        .disabled(model.replyDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || model.isWorking)
                }
            }
        }
    }

    private func field(_ title: String, hint: String, text: Binding<String>, minHeight: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title).font(.subheadline.weight(.semibold))
            TextField(hint, text: text, axis: .vertical)
                .lineLimit(3...8)
                .padding(12)
                .frame(minHeight: minHeight, alignment: .topLeading)
                .background(.white, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(CivicTheme.border, lineWidth: 1))
                .accessibilityLabel(title)
        }
    }

    private func copy(_ key: String) -> String { model.copy(key) }
}
