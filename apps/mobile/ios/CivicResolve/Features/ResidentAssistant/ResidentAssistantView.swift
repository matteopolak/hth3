import SwiftUI

@MainActor
private final class ResidentAssistantState: ObservableObject {
    @Published var threads: [AssistantThread] = AssistantThreadStore.load()
    @Published var selectedID: String?
    @Published var messages: [AssistantMessage] = []
    @Published var proposals: [AssistantProposal] = []
    @Published var tools: [AssistantTool] = []
    @Published var isWorking = false
    @Published var error: String?
    @Published var notice: String?
    @Published var toolOutput: String?

    private let api = ResidentAssistantAPI()
    private var loadGeneration = UUID()

    var selected: AssistantThread? { threads.first { $0.id == selectedID } }

    func load(accessToken: String?) async {
        if let accessToken {
            do {
                let remote = try await api.list(accessToken: accessToken)
                let guests = threads.filter(\.idIsGuest)
                let signedIn = remote.filter { $0.mode == "resident" }.map {
                    AssistantThread(id: $0.id, token: nil, title: title(for: $0), updatedAt: ISO8601DateFormatter().date(from: $0.updatedAt) ?? .now)
                }
                threads = (guests + signedIn).sorted { $0.updatedAt > $1.updatedAt }
            } catch { self.error = error.localizedDescription }
        } else {
            threads = AssistantThreadStore.load()
        }
        if let selectedID, threads.contains(where: { $0.id == selectedID }) {
            await open(selectedID, accessToken: accessToken)
        } else if let first = threads.first {
            await open(first.id, accessToken: accessToken)
        } else {
            selectedID = nil
            messages = []
            proposals = []
            tools = []
        }
    }

    func startNew() {
        selectedID = nil
        messages = []
        proposals = []
        tools = []
        error = nil
        notice = nil
        toolOutput = nil
    }

    func open(_ id: String, accessToken: String?) async {
        guard let thread = threads.first(where: { $0.id == id }) else { return }
        let generation = UUID()
        loadGeneration = generation
        selectedID = id
        error = nil
        notice = nil
        toolOutput = nil
        do {
            let detail = try await api.detail(thread, accessToken: accessToken)
            guard loadGeneration == generation else { return }
            messages = detail.messages.filter { $0.role != "tool" }
            proposals = detail.proposals
            tools = detail.tools
            if let first = messages.first(where: { $0.role == "user" }),
               let index = threads.firstIndex(where: { $0.id == id }),
               ["New conversation", "Nouvelle conversation"].contains(threads[index].title) {
                threads[index].title = String(first.content.prefix(60))
                try? persistGuestThreads()
            }
        } catch {
            guard loadGeneration == generation else { return }
            self.error = error.localizedDescription
        }
    }

    func send(_ text: String, locale: String, accessToken: String?) async {
        let message = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !message.isEmpty, !isWorking else { return }
        isWorking = true
        error = nil
        notice = nil
        defer { isWorking = false }
        do {
            let thread: AssistantThread
            if let selected { thread = selected }
            else {
                let created = try await api.create(locale: locale, accessToken: accessToken)
                thread = AssistantThread(id: created.conversation.id, token: created.conversationToken,
                                         title: String(message.prefix(60)), updatedAt: .now)
                threads.insert(thread, at: 0)
                tools = created.tools
                selectedID = thread.id
                try persistGuestThreads()
            }
            let result = try await api.send(message, thread: thread, accessToken: accessToken)
            await open(thread.id, accessToken: accessToken)
            toolOutput = result.toolResult?.displayed
            if result.proposal != nil { notice = nil }
            if let index = threads.firstIndex(where: { $0.id == thread.id }) {
                threads[index].updatedAt = .now
                if threads[index].title.isEmpty || ["New conversation", "Nouvelle conversation"].contains(threads[index].title) {
                    threads[index].title = String(message.prefix(60))
                }
                try persistGuestThreads()
            }
        } catch { self.error = error.localizedDescription }
    }

    func invoke(_ tool: AssistantTool, argsText: String, locale: String, accessToken: String?) async {
        guard !isWorking else { return }
        let args: [String: Any]
        do {
            guard let data = argsText.data(using: .utf8),
                  let parsed = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                throw AssistantAPIError.failed("Tool input must be a JSON object.")
            }
            args = parsed
        } catch { self.error = error.localizedDescription; return }
        isWorking = true
        error = nil
        defer { isWorking = false }
        do {
            let thread: AssistantThread
            if let selected { thread = selected }
            else {
                let created = try await api.create(locale: locale, accessToken: accessToken)
                thread = AssistantThread(id: created.conversation.id, token: created.conversationToken,
                                         title: "New conversation", updatedAt: .now)
                threads.insert(thread, at: 0)
                selectedID = thread.id
                tools = created.tools
                try persistGuestThreads()
            }
            let response = try await api.invoke(tool.name, args: args, thread: thread, accessToken: accessToken)
            await open(thread.id, accessToken: accessToken)
            toolOutput = response.result?.displayed
        } catch { self.error = error.localizedDescription }
    }

    func decide(_ proposal: AssistantProposal, approve: Bool, acknowledged: Bool, accessToken: String?) async {
        guard let thread = selected, !isWorking else { return }
        isWorking = true
        error = nil
        defer { isWorking = false }
        do {
            let receipt = KeychainReceiptStore.load()
            let response = try await api.decide(proposal, approve: approve, acknowledged: acknowledged,
                                                thread: thread, accessToken: accessToken, receiptToken: receipt?.receiptToken)
            let completionNotice: String
            if approve, proposal.name == "create_feedback",
               let data = response.result?.object?["data"]?.object,
               let id = data["submission"]?.object?["id"]?.string,
               let token = data["receiptToken"]?.string {
                try KeychainReceiptStore.save(ReceiptCredentials(submissionId: id, receiptToken: token))
                completionNotice = "Receipt: \(id)"
            } else {
                completionNotice = approve ? "Action completed." : "Action declined."
            }
            await open(thread.id, accessToken: accessToken)
            notice = completionNotice
            toolOutput = response.result?.displayed
        } catch { self.error = error.localizedDescription }
    }

    private func persistGuestThreads() throws {
        try AssistantThreadStore.save(threads.filter(\.idIsGuest))
    }

    private func title(for conversation: AssistantConversation) -> String {
        conversation.locale == "fr" ? "Nouvelle conversation" : "New conversation"
    }
}

struct ResidentAssistantView: View {
    @EnvironmentObject private var model: CivicResolveModel
    @StateObject private var state = ResidentAssistantState()
    @State private var draft = ""
    @State private var showHistory = false
    @State private var showTools = false
    @State private var selectedTool: AssistantTool?
    @State private var toolArguments = "{}"
    @State private var acknowledgedProposals: Set<String> = []

    private var isFrench: Bool { model.locale == .fr }
    private var accessToken: String? { model.authAccessToken }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 14) {
                Button { showHistory = true } label: { Image(systemName: "line.3.horizontal") }
                    .accessibilityLabel(copy("Conversations", "Conversations"))
                Text("envoy").font(.headline)
                Spacer()
                Button { state.startNew(); draft = "" } label: { Image(systemName: "square.and.pencil") }
                    .accessibilityLabel(copy("New chat", "Nouvelle conversation"))
            }
            .foregroundStyle(.black)
            .padding(.horizontal, 20)
            .padding(.vertical, 14)

            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 18) {
                        if state.messages.isEmpty {
                            Text(copy("What should we work on?", "Sur quoi devrions-nous travailler ?"))
                                .font(.title2.weight(.medium))
                                .frame(maxWidth: .infinity)
                                .padding(.top, 90)
                        }
                        ForEach(state.messages) { message in
                            messageView(message)
                        }
                        ForEach(state.proposals.filter { $0.status == "pending" }) { proposal in
                            proposalView(proposal)
                        }
                        if let output = state.toolOutput, !output.isEmpty {
                            DisclosureGroup(copy("Tool result", "Résultat de l’outil")) {
                                Text(output).font(.subheadline).textSelection(.enabled)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .padding(14)
                            .background(.white, in: RoundedRectangle(cornerRadius: 14))
                            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.black.opacity(0.12)))
                        }
                        if state.isWorking { ProgressView().frame(maxWidth: .infinity) }
                        if let notice = state.notice { Text(localizeNotice(notice)).font(.footnote).foregroundStyle(.secondary) }
                        if let error = state.error { Text(error).font(.footnote).foregroundStyle(.red) }
                        Color.clear.frame(height: 1).id("bottom")
                    }
                    .padding(20)
                    .frame(maxWidth: 720)
                    .frame(maxWidth: .infinity)
                }
                .onChange(of: state.messages.count) { _, _ in withAnimation { proxy.scrollTo("bottom", anchor: .bottom) } }
                .onChange(of: state.proposals.count) { _, _ in withAnimation { proxy.scrollTo("bottom", anchor: .bottom) } }
            }

            composer
        }
        .background(Color(red: 0.98, green: 0.98, blue: 0.98))
        .task { await state.load(accessToken: accessToken) }
        .onChange(of: model.authAccessToken) { _, _ in Task { await state.load(accessToken: accessToken) } }
        .sheet(isPresented: $showHistory) { historySheet }
        .sheet(isPresented: $showTools) { toolsSheet }
        .sheet(item: $selectedTool) { tool in toolSheet(tool) }
    }

    private var composer: some View {
        VStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 12) {
                TextField(copy("Ask envoy", "Demandez à envoy"), text: $draft, axis: .vertical)
                    .lineLimit(2...6)
                    .submitLabel(.send)
                    .onSubmit { submit() }
                    .disabled(state.isWorking)
                HStack {
                    Button { showTools = true } label: { Image(systemName: "plus").font(.title3) }
                        .accessibilityLabel(copy("Tools", "Outils"))
                    Spacer()
                    Text("Granite Micro").font(.caption).foregroundStyle(.secondary)
                    Button(action: submit) {
                        Image(systemName: "arrow.up")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white)
                            .frame(width: 34, height: 34)
                            .background(.black, in: Circle())
                    }
                    .accessibilityLabel(copy("Send", "Envoyer"))
                    .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || state.isWorking)
                }
                .foregroundStyle(.black)
            }
            .padding(14)
            .background(.white, in: RoundedRectangle(cornerRadius: 20))
            .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color.black.opacity(0.12)))
            Button { showTools = true } label: {
                Label(copy("Tools", "Outils"), systemImage: "square.grid.2x2")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 10)
        .frame(maxWidth: 720)
        .frame(maxWidth: .infinity)
    }

    private func messageView(_ message: AssistantMessage) -> some View {
        HStack {
            if message.role == "user" { Spacer(minLength: 36) }
            Text(message.content)
                .font(.body)
                .textSelection(.enabled)
                .padding(.horizontal, message.role == "user" ? 15 : 0)
                .padding(.vertical, message.role == "user" ? 11 : 0)
                .background(message.role == "user" ? Color.black.opacity(0.06) : Color.clear,
                            in: RoundedRectangle(cornerRadius: 18))
            if message.role != "user" { Spacer(minLength: 36) }
        }
    }

    private func proposalView(_ proposal: AssistantProposal) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(copy("Review action", "Vérifier l’action")).font(.headline)
            Text(proposal.name.replacingOccurrences(of: "_", with: " ").capitalized).font(.subheadline.weight(.medium))
            if let body = proposal.preview.object?["body"]?.displayed, !body.isEmpty {
                Text(body).font(.subheadline).textSelection(.enabled)
            }
            if let destination = proposal.preview.object?["destinationNotice"]?.string {
                Text(destination).font(.footnote).foregroundStyle(.secondary)
            }
            if proposal.requiresSandboxAcknowledgment {
                Toggle(isOn: Binding(
                    get: { acknowledgedProposals.contains(proposal.id) },
                    set: { if $0 { acknowledgedProposals.insert(proposal.id) } else { acknowledgedProposals.remove(proposal.id) } }
                )) {
                    Text(copy("I understand this report stays in envoy’s own intake queue and is not sent to a government office.",
                              "Je comprends que ce signalement reste dans la file d’envoy et n’est pas envoyé à un organisme gouvernemental."))
                        .font(.footnote)
                }
                .tint(.black)
            }
            HStack {
                Button(copy("Decline", "Refuser")) {
                    Task { await state.decide(proposal, approve: false, acknowledged: false, accessToken: accessToken) }
                }
                .buttonStyle(.bordered)
                Spacer()
                Button(copy("Approve", "Approuver")) {
                    Task { await state.decide(proposal, approve: true,
                                              acknowledged: acknowledgedProposals.contains(proposal.id), accessToken: accessToken) }
                }
                .buttonStyle(.borderedProminent)
                .tint(.black)
                .disabled(state.isWorking || (proposal.requiresSandboxAcknowledgment && !acknowledgedProposals.contains(proposal.id)))
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.white, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.black.opacity(0.14)))
    }

    private var historySheet: some View {
        NavigationStack {
            List {
                Button { state.startNew(); showHistory = false } label: {
                    Label(copy("New chat", "Nouvelle conversation"), systemImage: "square.and.pencil")
                }
                ForEach(state.threads) { thread in
                    Button {
                        showHistory = false
                        Task { await state.open(thread.id, accessToken: accessToken) }
                    } label: {
                        HStack {
                            Text(thread.title).lineLimit(1)
                            Spacer()
                            if thread.id == state.selectedID { Image(systemName: "checkmark") }
                        }
                    }
                }
            }
            .foregroundStyle(.black)
            .navigationTitle(copy("Conversations", "Conversations"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button(copy("Done", "Terminé")) { showHistory = false } } }
        }
    }

    private var toolsSheet: some View {
        NavigationStack {
            List(state.tools) { tool in
                Button {
                    showTools = false
                    selectedTool = tool
                    toolArguments = "{}"
                } label: {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(tool.name.replacingOccurrences(of: "_", with: " ").capitalized)
                            .font(.subheadline.weight(.medium))
                        Text(tool.description).font(.caption).foregroundStyle(.secondary)
                        if tool.access == "write" {
                            Text(copy("Review required", "Vérification requise")).font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .foregroundStyle(.black)
            .overlay {
                if state.tools.isEmpty {
                    Text(copy("Send a message to load available tools.", "Envoyez un message pour charger les outils disponibles."))
                        .font(.subheadline).foregroundStyle(.secondary).padding()
                }
            }
            .navigationTitle(copy("Tools", "Outils"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button(copy("Done", "Terminé")) { showTools = false } } }
        }
    }

    private func toolSheet(_ tool: AssistantTool) -> some View {
        NavigationStack {
            Form {
                Section {
                    Text(tool.description)
                    TextEditor(text: $toolArguments).frame(minHeight: 120)
                        .font(.system(.body, design: .monospaced))
                        .accessibilityLabel(copy("Tool arguments as JSON", "Arguments de l’outil en JSON"))
                } header: { Text(copy("Arguments", "Arguments")) }
                Button(copy(tool.access == "write" ? "Prepare for review" : "Run tool",
                            tool.access == "write" ? "Préparer pour vérification" : "Utiliser l’outil")) {
                    selectedTool = nil
                    Task { await state.invoke(tool, argsText: toolArguments, locale: model.locale.rawValue, accessToken: accessToken) }
                }
                .disabled(state.isWorking)
            }
            .navigationTitle(tool.name.replacingOccurrences(of: "_", with: " ").capitalized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button(copy("Done", "Terminé")) { selectedTool = nil } } }
        }
    }

    private func submit() {
        let message = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !message.isEmpty else { return }
        draft = ""
        Task { await state.send(message, locale: model.locale.rawValue, accessToken: accessToken) }
    }

    private func copy(_ english: String, _ french: String) -> String { isFrench ? french : english }

    private func localizeNotice(_ notice: String) -> String {
        if !isFrench { return notice }
        if notice == "Action completed." { return "Action terminée." }
        if notice == "Action declined." { return "Action refusée." }
        if notice.hasPrefix("Receipt: ") { return notice.replacingOccurrences(of: "Receipt: ", with: "Reçu : ") }
        return notice
    }
}
