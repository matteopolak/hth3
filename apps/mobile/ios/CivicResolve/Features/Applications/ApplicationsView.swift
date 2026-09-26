import SwiftUI

struct ApplicationsView: View {
    @EnvironmentObject private var model: CivicResolveModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                SandboxBadge(title: copy("sandbox.title"))
                Text(copy("application.signIn")).font(.subheadline).foregroundStyle(CivicTheme.muted)
                #if DEBUG
                InlineNotice(message: copy("local.identityNotice"))
                #endif
                if model.isLoadingPostings {
                    ProgressView(copy("common.loading"))
                } else if model.postings.isEmpty {
                    CivicTheme.card {
                        VStack(alignment: .leading, spacing: 12) {
                            Text(copy("application.noPostings"))
                            Button(copy("common.retry")) { Task { await model.loadPostings() } }
                                .buttonStyle(.bordered)
                        }
                    }
                } else if let posting = model.postings.first(where: { $0.id == model.selectedPostingId }) {
                    CivicTheme.card {
                        VStack(alignment: .leading, spacing: 14) {
                            Text(posting.title).font(.title2.weight(.semibold))
                            Text(posting.organizationName).font(.headline)
                            Text(posting.description).foregroundStyle(CivicTheme.muted)
                            Text(copy("application.sampleLocation")).font(.caption).foregroundStyle(CivicTheme.warning)
                            field(copy("application.experience"), hint: copy("application.experienceHint"), text: $model.applicationExperience, minHeight: 110)
                            field(copy("application.availability"), hint: copy("application.availabilityHint"), text: $model.applicationAvailability, minHeight: 72)
                            if model.accessToken == nil { InlineNotice(message: copy("auth.signInRequired")) }
                            Toggle(copy("application.confirm"), isOn: $model.applicationConfirmed)
                                .font(.subheadline)
                            Button(copy("application.submit")) { Task { await model.submitApplication() } }
                                .buttonStyle(.borderedProminent)
                                .disabled(model.accessToken == nil || !model.applicationConfirmed || model.isWorking)
                        }
                    }
                }
                if let error = model.error { InlineNotice(message: error, isError: true) }
                if let notice = model.notice { InlineNotice(message: notice) }
                applicationsList
                if model.isWorking { ProgressView(copy("common.loading")) }
            }
            .padding(20)
            .frame(maxWidth: 720, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .background(CivicTheme.canvas)
        .task {
            await model.loadPostings()
            await model.loadApplications()
        }
        .onChange(of: model.identity) { _, _ in Task { await model.loadApplications() } }
    }

    @ViewBuilder
    private var applicationsList: some View {
        if model.accessToken != nil {
            CivicTheme.card {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text(copy("application.title")).font(.headline)
                        Spacer()
                        Button(copy("common.refresh")) { Task { await model.loadApplications() } }
                            .buttonStyle(.borderless)
                    }
                    if model.isLoadingApplications {
                        ProgressView(copy("common.loading"))
                    } else if model.applications.isEmpty {
                        Text(copy("application.noApplications")).foregroundStyle(CivicTheme.muted)
                    } else {
                        ForEach(model.applications) { application in
                            HStack(alignment: .top) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(application.postingTitle ?? application.postingId).font(.subheadline.weight(.semibold))
                                    Text(model.statusCopy(application.status))
                                        .font(.caption).foregroundStyle(CivicTheme.accent)
                                }
                                Spacer()
                                Text(application.updatedAt.prefix(10)).font(.caption).foregroundStyle(CivicTheme.muted)
                            }
                            .padding(.vertical, 7)
                            if application.id != model.applications.last?.id { Divider() }
                        }
                    }
                }
            }
        }
    }

    private func field(_ title: String, hint: String, text: Binding<String>, minHeight: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title).font(.subheadline.weight(.semibold))
            TextField(hint, text: text, axis: .vertical)
                .lineLimit(3...7)
                .padding(12)
                .frame(minHeight: minHeight, alignment: .topLeading)
                .background(.white, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(CivicTheme.border, lineWidth: 1))
                .accessibilityLabel(title)
        }
    }

    private func copy(_ key: String) -> String { model.copy(key) }
}
