import SwiftUI

struct ApplicationsView: View {
    @EnvironmentObject private var model: CivicResolveModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if model.isLoadingPostings { ProgressView(copy("common.loading")) }
                if model.postings.isEmpty && !model.isLoadingPostings {
                    Text(copy("application.noPostings"))
                        .foregroundStyle(CivicTheme.muted)
                }
                ForEach(model.postings) { posting in
                    NavigationLink {
                        ApplicationComposerView(posting: posting)
                    } label: {
                        VStack(alignment: .leading, spacing: 7) {
                            Text(posting.title).font(.headline).foregroundStyle(CivicTheme.ink)
                            Text(posting.organizationName).font(.subheadline).foregroundStyle(CivicTheme.muted)
                            Text(posting.location).font(.caption).foregroundStyle(CivicTheme.muted)
                            if posting.sample {
                                Label(copy("application.practicePosting"), systemImage: "info.circle")
                                    .font(.caption).foregroundStyle(CivicTheme.warning)
                            }
                        }
                        .padding(15)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(.white, in: RoundedRectangle(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(CivicTheme.border))
                    }
                    .buttonStyle(.plain)
                }
                if let error = model.error { InlineNotice(message: error, isError: true) }
                HStack {
                    Text(copy("application.myApplications")).font(.headline)
                    Spacer()
                    Button(copy("common.refresh")) { Task { await model.loadApplications() } }
                }
                if model.accessToken == nil {
                    Text(copy("application.signIn")).font(.subheadline).foregroundStyle(CivicTheme.muted)
                    Button(copy("auth.signInButton")) { Task { await model.signIn() } }
                        .buttonStyle(.bordered)
                } else if model.applications.isEmpty && !model.isLoadingApplications {
                    Text(copy("application.noApplications")).foregroundStyle(CivicTheme.muted)
                } else {
                    ForEach(model.applications) { application in
                        NavigationLink {
                            ApplicationDetailView(application: application)
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(application.postingTitle ?? application.postingId)
                                        .font(.subheadline.weight(.semibold))
                                    Text(model.statusCopy(application.status)).font(.caption).foregroundStyle(CivicTheme.muted)
                                }
                                Spacer()
                                Image(systemName: "chevron.right").font(.caption)
                            }
                            .padding(15)
                            .foregroundStyle(CivicTheme.ink)
                            .background(.white, in: RoundedRectangle(cornerRadius: 14))
                            .overlay(RoundedRectangle(cornerRadius: 14).stroke(CivicTheme.border))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: 720, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .background(CivicTheme.canvas)
        .task {
            await model.loadPostings()
            await model.loadApplications()
        }
        .onChange(of: model.accessToken) { _, _ in Task { await model.loadApplications() } }
    }

    private func copy(_ key: String) -> String { model.copy(key) }
}

private struct ApplicationComposerView: View {
    @EnvironmentObject private var model: CivicResolveModel
    let posting: Posting
    @State private var experience = ""
    @State private var availability = ""
    @State private var confirmed = false
    @State private var sending = false
    @State private var error: String?
    @State private var sent: CivicApplication?
    private let api = WorkerAPI()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(posting.title).font(.title2.weight(.semibold))
                Text(posting.organizationName).foregroundStyle(CivicTheme.muted)
                Text(posting.description)
                if posting.sample {
                    InlineNotice(message: copy("application.practiceNotice"))
                }
                if let sent {
                    InlineNotice(message: copy(posting.sample ? "application.sentEnvoyOnly" : "application.sent"))
                    NavigationLink(copy("application.viewApplication")) {
                        ApplicationDetailView(application: sent)
                    }
                } else {
                    Text(copy("application.reviewTitle")).font(.headline)
                    Text(copy("application.reviewNote"))
                        .font(.subheadline).foregroundStyle(CivicTheme.muted)
                    field(copy("application.experience"), hint: copy("application.experienceHint"), text: $experience)
                    field(copy("application.availability"), hint: copy("application.availabilityHint"), text: $availability)
                    if model.accessToken == nil {
                        InlineNotice(message: copy("auth.signInRequired"))
                        Button(copy("auth.signInButton")) { Task { await model.signIn() } }
                            .buttonStyle(.bordered)
                    }
                    Toggle(copy("application.confirmReviewed"), isOn: $confirmed)
                    Button { Task { await submit() } } label: {
                        Text(copy("application.submit")).frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(CivicTheme.ink)
                    .disabled(model.accessToken == nil || !confirmed || sending || experience.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || availability.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    if sending { ProgressView(copy("common.loading")) }
                }
                if let error { InlineNotice(message: error, isError: true) }
            }
            .padding(16)
            .frame(maxWidth: 720, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .background(CivicTheme.canvas)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func field(_ title: String, hint: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title).font(.subheadline.weight(.semibold))
            TextField(hint, text: text, axis: .vertical)
                .lineLimit(3...6)
                .padding(12)
                .background(.white, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(CivicTheme.border))
        }
    }

    private func submit() async {
        guard let token = model.accessToken, confirmed else { return }
        sending = true
        error = nil
        defer { sending = false }
        do {
            sent = try await api.submitApplication(token: token, postingId: posting.id, experience: experience, availability: availability)
            await model.loadApplications()
        } catch { self.error = error.localizedDescription }
    }

    private func copy(_ key: String) -> String { model.copy(key) }
}

private struct ApplicationDetailView: View {
    @EnvironmentObject private var model: CivicResolveModel
    let application: CivicApplication
    @State private var liveApplication: CivicApplication?
    @State private var messages: [ApplicationMessage] = []
    @State private var draft = ""
    @State private var error: String?
    @State private var sending = false
    @State private var loading = false
    private let api = WorkerAPI()

    private var current: CivicApplication { liveApplication ?? application }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(current.postingTitle ?? current.postingId).font(.title2.weight(.semibold))
                Text(model.statusCopy(current.status))
                    .font(.subheadline).foregroundStyle(CivicTheme.muted)
                HStack(spacing: 16) {
                    Text("\(copy("application.submittedAt")): \(String(current.submittedAt.prefix(10)))")
                    Text("\(copy("application.updatedAt")): \(String(current.updatedAt.prefix(10)))")
                }
                .font(.caption).foregroundStyle(CivicTheme.muted)
                Button {
                    Task { await load() }
                } label: {
                    Label(copy("application.refreshStatus"), systemImage: "arrow.clockwise")
                }
                .buttonStyle(.bordered)
                .disabled(loading)
                if loading { ProgressView(copy("common.loading")) }
                if current.sample {
                    InlineNotice(message: copy("application.practiceNotice"))
                }
                VStack(alignment: .leading, spacing: 9) {
                    Text(copy("application.answers")).font(.headline)
                    ForEach(current.answers.keys.sorted(), id: \.self) { key in
                        VStack(alignment: .leading, spacing: 3) {
                            Text(key.capitalized).font(.caption).foregroundStyle(CivicTheme.muted)
                            Text(current.answers[key] ?? "")
                        }
                    }
                }
                .padding(15)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.white, in: RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(CivicTheme.border))
                Text(copy("application.messages")).font(.headline)
                if messages.isEmpty { Text(copy("application.noMessages")).foregroundStyle(CivicTheme.muted) }
                ForEach(messages) { message in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(message.author == "employer" ? copy("application.employer") : copy("application.you"))
                            .font(.caption.weight(.semibold)).foregroundStyle(CivicTheme.muted)
                        Text(message.body)
                        Text(String(message.createdAt.prefix(10))).font(.caption).foregroundStyle(CivicTheme.muted)
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.white, in: RoundedRectangle(cornerRadius: 14))
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(CivicTheme.border))
                }
                TextField(copy("application.messageHint"), text: $draft, axis: .vertical)
                    .lineLimit(2...5)
                    .padding(12)
                    .background(.white, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(CivicTheme.border))
                Button(copy("application.sendMessage")) { Task { await send() } }
                    .buttonStyle(.borderedProminent)
                    .tint(CivicTheme.ink)
                    .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || sending)
                if let error { InlineNotice(message: error, isError: true) }
            }
            .padding(16)
            .frame(maxWidth: 720, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .background(CivicTheme.canvas)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        guard let token = model.accessToken else { return }
        loading = true
        error = nil
        defer { loading = false }
        do {
            async let detail = api.application(id: application.id, token: token)
            async let conversation = api.applicationMessages(id: application.id, token: token)
            let (updated, latestMessages) = try await (detail, conversation)
            liveApplication = updated
            messages = latestMessages
            if let index = model.applications.firstIndex(where: { $0.id == updated.id }) {
                model.applications[index] = updated
            }
        }
        catch { self.error = error.localizedDescription }
    }

    private func send() async {
        guard let token = model.accessToken else { return }
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        sending = true
        defer { sending = false }
        do {
            let message = try await api.sendApplicationMessage(id: current.id, text: text, token: token)
            messages.append(message)
            draft = ""
        } catch { self.error = error.localizedDescription }
    }

    private func copy(_ key: String) -> String { model.copy(key) }
}
