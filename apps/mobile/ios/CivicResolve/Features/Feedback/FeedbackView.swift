import SwiftUI

struct FeedbackView: View {
    @EnvironmentObject private var model: CivicResolveModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if model.emergencyGuidanceShowing {
                    emergencyGuidance
                } else {
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
                    if let receipt = model.feedbackReceipt {
                        receiptCard(receipt)
                    } else if model.credentials == nil {
                        Text(copy("feedback.noReceipt"))
                            .font(.footnote)
                            .foregroundStyle(CivicTheme.muted)
                    }
                    if model.isWorking { ProgressView(copy("common.loading")) }
                }
            }
            .padding(20)
            .frame(maxWidth: 720, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .background(CivicTheme.canvas)
        .task { await model.refreshReceipt() }
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
                        Text(message.author == "staff" ? copy("feedback.sampleQueue") : copy("feedback.original"))
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
