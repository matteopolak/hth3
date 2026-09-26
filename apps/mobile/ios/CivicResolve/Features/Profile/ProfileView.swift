import SwiftUI
import UIKit
import UniformTypeIdentifiers

struct ProfileView: View {
    @EnvironmentObject private var model: CivicResolveModel
    @State private var isImporting = false
    @State private var resumeToDelete: ResumeDocument?
    @State private var importError: String?

    private var documentTypes: [UTType] {
        [.pdf, UTType(filenameExtension: "docx") ?? .data]
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                NavigationLink {
                    AccessibilityView()
                        .navigationTitle(model.locale == .en ? "Accessibility" : "Accessibilité")
                } label: {
                    Label(model.locale == .en ? "Accessibility" : "Accessibilité", systemImage: "textformat.size")
                }
                .buttonStyle(.bordered)

                Text(copy("profile.intro"))
                    .font(.subheadline)
                    .foregroundStyle(CivicTheme.muted)

                if model.accessToken == nil {
                    signInCard
                } else {
                    if model.isUsingLocalIdentity {
                        InlineNotice(message: copy("local.identityNotice"))
                        Button(copy("auth.signInButton")) { Task { await model.signIn() } }
                            .buttonStyle(.bordered)
                            .disabled(model.authIsWorking)
                    } else if model.isAuth0SignedIn {
                        HStack {
                            Label(copy("auth.signedIn"), systemImage: "checkmark.circle.fill")
                                .foregroundStyle(CivicTheme.success)
                            Spacer()
                            Button(copy("auth.signOut")) { Task { await model.signOut() } }
                                .buttonStyle(.borderless)
                                .disabled(model.authIsWorking)
                        }
                    }

                    if model.profileIsLoading && !model.profileIsLoaded {
                        ProgressView(copy("common.loading"))
                    } else if !model.profileIsLoaded {
                        CivicTheme.card {
                            VStack(alignment: .leading, spacing: 12) {
                                if let error = model.profileError { InlineNotice(message: error, isError: true) }
                                Button(copy("common.retry")) { Task { await model.loadProfileWorkspace() } }
                                    .buttonStyle(.bordered)
                            }
                        }
                    } else {
                        profileForm
                        resumeLibrary
                    }
                    if model.profileIsWorking { ProgressView(copy("common.loading")) }
                    if let error = model.profileError { InlineNotice(message: error, isError: true) }
                    if let notice = model.profileNotice { InlineNotice(message: notice) }
                }
                if let message = model.authMessage {
                    InlineNotice(message: message, isError: message != copy("auth.signedOut"))
                }
                if let importError { InlineNotice(message: importError, isError: true) }
            }
            .padding(20)
            .frame(maxWidth: 720, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .background(CivicTheme.canvas)
        .task { await model.loadProfileWorkspace() }
        .onChange(of: model.accessToken) { _, _ in Task { await model.loadProfileWorkspace() } }
        .fileImporter(isPresented: $isImporting, allowedContentTypes: documentTypes, allowsMultipleSelection: false) { handleImport($0) }
        .confirmationDialog(
            copy("profile.deleteTitle"),
            isPresented: Binding(get: { resumeToDelete != nil }, set: { if !$0 { resumeToDelete = nil } }),
            titleVisibility: .visible
        ) {
            Button(copy("profile.delete"), role: .destructive) {
                if let resume = resumeToDelete { Task { await model.deleteResume(resume) } }
                resumeToDelete = nil
            }
            Button(copy("profile.cancel"), role: .cancel) { resumeToDelete = nil }
        } message: {
            Text(copy("profile.deleteMessage"))
        }
    }

    private var signInCard: some View {
        CivicTheme.card {
            VStack(alignment: .leading, spacing: 14) {
                Text(copy("profile.title")).font(.title2.weight(.semibold))
                Text(copy("profile.signInPrompt")).foregroundStyle(CivicTheme.muted)
                Button(copy("auth.signInButton")) { Task { await model.signIn() } }
                    .buttonStyle(.borderedProminent)
                    .disabled(model.authIsWorking || !model.authIsConfigured)
                if !model.authIsConfigured { Text(copy("profile.notConfigured")).font(.footnote).foregroundStyle(CivicTheme.muted) }
                if model.authIsWorking { ProgressView(copy("common.loading")) }
            }
        }
    }

    private var profileForm: some View {
        VStack(alignment: .leading, spacing: 16) {
            CivicTheme.card {
                VStack(alignment: .leading, spacing: 14) {
                    Text(copy("profile.title")).font(.title2.weight(.semibold))
                    editorField(copy("profile.name"), text: $model.profile.name)
                    editorField(copy("profile.email"), text: $model.profile.email, keyboard: .emailAddress)
                    editorField(copy("profile.phone"), text: $model.profile.phone, keyboard: .phonePad)
                    editorField(copy("profile.location"), text: $model.profile.location)
                    editorField(copy("profile.summary"), text: $model.profile.summary, minHeight: 88)
                    VStack(alignment: .leading, spacing: 7) {
                        Text(copy("profile.skills")).font(.subheadline.weight(.semibold))
                        TextField(copy("profile.skillsHint"), text: $model.profileSkillsText, axis: .vertical)
                            .lineLimit(3...8)
                            .padding(12)
                            .background(CivicTheme.canvas, in: RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(CivicTheme.border, lineWidth: 1))
                    }
                    Button(copy("profile.save")) { Task { await model.saveProfile() } }
                        .buttonStyle(.borderedProminent)
                        .disabled(model.profileIsWorking)
                }
            }

            entrySection(title: copy("profile.education"), addTitle: copy("profile.addEducation")) {
                model.profile.education.append(EducationEntry())
            } content: {
                ForEach($model.profile.education) { $entry in
                    CivicTheme.card {
                        VStack(alignment: .leading, spacing: 12) {
                            editorField(copy("profile.institution"), text: $entry.institution)
                            editorField(copy("profile.credential"), text: $entry.credential)
                            editorField(copy("profile.fieldOfStudy"), text: $entry.fieldOfStudy)
                            HStack {
                                editorField(copy("profile.startDate"), text: $entry.startDate)
                                editorField(copy("profile.endDate"), text: $entry.endDate)
                            }
                            editorField(copy("profile.description"), text: $entry.description, minHeight: 72)
                            Button(copy("profile.remove"), role: .destructive) {
                                let id = entry.id
                                model.profile.education.removeAll { $0.id == id }
                            }
                            .buttonStyle(.borderless)
                        }
                    }
                }
            }

            entrySection(title: copy("profile.experience"), addTitle: copy("profile.addExperience")) {
                model.profile.experience.append(ExperienceEntry())
            } content: {
                ForEach($model.profile.experience) { $entry in
                    CivicTheme.card {
                        VStack(alignment: .leading, spacing: 12) {
                            editorField(copy("profile.organization"), text: $entry.organization)
                            editorField(copy("profile.jobTitle"), text: $entry.title)
                            HStack {
                                editorField(copy("profile.startDate"), text: $entry.startDate)
                                editorField(copy("profile.endDate"), text: $entry.endDate)
                            }
                            editorField(copy("profile.description"), text: $entry.description, minHeight: 72)
                            Button(copy("profile.remove"), role: .destructive) {
                                let id = entry.id
                                model.profile.experience.removeAll { $0.id == id }
                            }
                            .buttonStyle(.borderless)
                        }
                    }
                }
            }

            Button(copy("profile.save")) { Task { await model.saveProfile() } }
                .buttonStyle(.borderedProminent)
                .disabled(model.profileIsWorking)
        }
    }

    private var resumeLibrary: some View {
        VStack(alignment: .leading, spacing: 14) {
            CivicTheme.card {
                VStack(alignment: .leading, spacing: 12) {
                    Text(copy("profile.resumeSection")).font(.headline)
                    Text(copy("profile.uploadNote")).font(.footnote).foregroundStyle(CivicTheme.muted)
                    Button(copy("profile.upload")) { isImporting = true }
                        .buttonStyle(.bordered)
                        .disabled(model.profileIsWorking)
                    if model.resumes.isEmpty { Text(copy("profile.noResumes")).font(.subheadline).foregroundStyle(CivicTheme.muted) }
                }
            }

            ForEach(model.resumes) { resume in
                CivicTheme.card {
                    VStack(alignment: .leading, spacing: 12) {
                        Text(resume.filename).font(.headline).textSelection(.enabled)
                        Text("\(ByteCountFormatter.string(fromByteCount: Int64(resume.byteSize), countStyle: .file)) · \(copy("profile.retentionUntil")) \(resume.retentionExpiresAt.prefix(10))")
                            .font(.caption)
                            .foregroundStyle(CivicTheme.muted)
                        Text(copy("profile.shareWarning"))
                            .font(.footnote)
                            .foregroundStyle(CivicTheme.muted)
                        HStack {
                            Button(copy("profile.extract")) { Task { await model.extractResume(resume) } }
                                .buttonStyle(.bordered)
                                .disabled(model.profileIsWorking)
                            Menu {
                                if model.applications.isEmpty {
                                    Text(copy("profile.noApplications"))
                                } else {
                                    ForEach(model.applications) { application in
                                        Button(application.postingTitle ?? copy("application.title")) {
                                            Task { await model.shareResume(resume, with: application) }
                                        }
                                    }
                                }
                            } label: {
                                Label(copy("profile.share"), systemImage: "square.and.arrow.up")
                            }
                            .disabled(model.applications.isEmpty || model.profileIsWorking)
                            Spacer()
                            Button(role: .destructive) { resumeToDelete = resume } label: {
                                Image(systemName: "trash")
                            }
                            .accessibilityLabel(copy("profile.delete"))
                        }

                        if let extraction = model.resumeExtraction, extraction.resumeId == resume.id {
                            extractionReview(extraction)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func extractionReview(_ extraction: ResumeExtraction) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Divider()
            Text(copy("profile.extractionReady")).font(.subheadline.weight(.semibold))
            if extraction.suggestionsTruncated { InlineNotice(message: copy("profile.truncated")) }
            if extraction.suggestions.isEmpty {
                Text(copy("profile.extractionUnavailable")).font(.footnote).foregroundStyle(CivicTheme.muted)
            }
            ForEach(extraction.suggestions) { suggestion in
                VStack(alignment: .leading, spacing: 6) {
                    Text("\(suggestion.field.capitalized) · \(suggestion.source.text)")
                        .font(.subheadline)
                        .textSelection(.enabled)
                    Button(copy("profile.applySuggestion")) { model.applyResumeSuggestion(suggestion) }
                        .buttonStyle(.borderless)
                }
                .padding(.vertical, 5)
            }
            DisclosureGroup(copy("profile.extractedText")) {
                Text(String(extraction.text.prefix(8_000)))
                    .font(.footnote.monospaced())
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if extraction.text.count > 8_000 {
                    Text(copy("profile.textPreviewCapped")).font(.caption).foregroundStyle(CivicTheme.muted)
                }
            }
        }
    }

    private func entrySection<Content: View>(
        title: String,
        addTitle: String,
        add: @escaping () -> Void,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(title).font(.headline)
                Spacer()
                Button(addTitle, action: add).buttonStyle(.borderless)
            }
            content()
        }
    }

    private func editorField(_ title: String, text: Binding<String>, keyboard: UIKeyboardType = .default, minHeight: CGFloat = 44) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.caption.weight(.semibold)).foregroundStyle(CivicTheme.muted)
            TextField(title, text: text, axis: minHeight > 44 ? .vertical : .horizontal)
                .keyboardType(keyboard)
                .lineLimit(minHeight > 44 ? 3...6 : 1...1)
                .padding(11)
                .frame(minHeight: minHeight, alignment: .topLeading)
                .background(CivicTheme.canvas, in: RoundedRectangle(cornerRadius: 9))
                .overlay(RoundedRectangle(cornerRadius: 9).stroke(CivicTheme.border, lineWidth: 1))
                .accessibilityLabel(title)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func handleImport(_ result: Result<[URL], Error>) {
        importError = nil
        guard case let .success(urls) = result, let url = urls.first else {
            if case let .failure(error) = result, (error as NSError).code != CocoaError.userCancelled.rawValue {
                importError = copy("profile.fileReadError")
            }
            return
        }
        guard ["pdf", "docx"].contains(url.pathExtension.lowercased()) else {
            importError = copy("profile.fileType")
            return
        }
        guard model.resumes.count < 10 else {
            importError = copy("profile.resumeDraftLimit")
            return
        }
        let hasAccess = url.startAccessingSecurityScopedResource()
        Task {
            defer { if hasAccess { url.stopAccessingSecurityScopedResource() } }
            do {
                let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                guard size > 0, size <= 5 * 1024 * 1024 else { importError = copy("profile.fileTooLarge"); return }
                let data = try Data(contentsOf: url)
                let filename = url.lastPathComponent
                    .replacingOccurrences(of: "\r", with: "")
                    .replacingOccurrences(of: "\n", with: "")
                    .replacingOccurrences(of: "\"", with: "")
                let contentType = url.pathExtension.lowercased() == "pdf"
                    ? "application/pdf"
                    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                await model.uploadResume(data: data, filename: filename, contentType: contentType)
            } catch { importError = copy("profile.fileReadError") }
        }
    }

    private func copy(_ key: String) -> String { model.copy(key) }
}
