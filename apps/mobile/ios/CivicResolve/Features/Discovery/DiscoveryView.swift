import SwiftUI

private enum DiscoveryArea: String, CaseIterable, Identifiable {
    case all, jobs, support, funding, nearby, participation, saved
    var id: String { rawValue }
    var apiValue: String? { self == .all || self == .saved ? nil : rawValue }
    var icon: String {
        switch self {
        case .all: "square.grid.2x2"
        case .jobs: "briefcase"
        case .support: "heart.text.square"
        case .funding: "dollarsign.circle"
        case .nearby: "mappin.and.ellipse"
        case .participation: "person.3"
        case .saved: "bookmark"
        }
    }
}

private struct DiscoveryLocation: Identifiable {
    let code: String
    let key: String
    var id: String { code }

    static let all: [DiscoveryLocation] = [
        .init(code: "", key: "allCanada"),
        .init(code: "CA-AB", key: "alberta"),
        .init(code: "CA-BC", key: "britishColumbia"),
        .init(code: "CA-MB", key: "manitoba"),
        .init(code: "CA-NB", key: "newBrunswick"),
        .init(code: "CA-NL", key: "newfoundlandLabrador"),
        .init(code: "CA-NT", key: "northwestTerritories"),
        .init(code: "CA-NS", key: "novaScotia"),
        .init(code: "CA-NU", key: "nunavut"),
        .init(code: "CA-ON", key: "ontario"),
        .init(code: "CA-PE", key: "princeEdwardIsland"),
        .init(code: "CA-QC", key: "quebec"),
        .init(code: "CA-SK", key: "saskatchewan"),
        .init(code: "CA-YT", key: "yukon"),
    ]
}

struct DiscoveryView: View {
    @EnvironmentObject private var model: CivicResolveModel
    @State private var area: DiscoveryArea = .all
    @State private var query = ""
    @State private var jurisdiction = ""
    @State private var currentOnly = false
    @State private var includeSamples = false
    @State private var showOptions = false
    @State private var items: [DiscoveryItem] = []
    @State private var saved: [DiscoverySavedItem] = []
    @State private var total = 0
    @State private var loading = false
    @State private var loadingNearbyPages = false
    @State private var error: String?
    @State private var mapMode = false
    private let api = WorkerAPI()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                ScrollViewReader { categories in
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(DiscoveryArea.allCases) { option in
                                Button { area = option; Task { await refresh() } } label: {
                                    Label(text("discovery.\(option.rawValue)"), systemImage: option.icon)
                                        .font(.subheadline.weight(area == option ? .semibold : .regular))
                                        .padding(.horizontal, 12).padding(.vertical, 9)
                                        .foregroundStyle(area == option ? .white : CivicTheme.ink)
                                        .background(area == option ? CivicTheme.ink : .white, in: Capsule())
                                        .overlay(Capsule().stroke(CivicTheme.border, lineWidth: area == option ? 0 : 1))
                                }
                                .buttonStyle(.plain)
                                .id(option)
                            }
                        }
                    }
                    .onChange(of: area) { _, selected in
                        withAnimation { categories.scrollTo(selected, anchor: .leading) }
                    }
                }
                if area != .saved {
                    HStack {
                        Image(systemName: "magnifyingglass").foregroundStyle(CivicTheme.muted)
                        TextField(text("discovery.searchHint"), text: $query)
                            .submitLabel(.search)
                            .onSubmit { Task { await refresh() } }
                        if !query.isEmpty {
                            Button { query = ""; Task { await refresh() } } label: { Image(systemName: "xmark.circle.fill") }
                                .accessibilityLabel(text("discovery.clear"))
                        }
                    }
                    .padding(12)
                    .background(.white, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(CivicTheme.border))

                    HStack(spacing: 12) {
                        Menu {
                            ForEach(DiscoveryLocation.all) { location in
                                Button {
                                    jurisdiction = location.code
                                    Task { await refresh() }
                                } label: {
                                    if jurisdiction == location.code {
                                        Label(text("discovery.location.\(location.key)"), systemImage: "checkmark")
                                    } else {
                                        Text(text("discovery.location.\(location.key)"))
                                    }
                                }
                            }
                        } label: {
                            Label(locationLabel, systemImage: "mappin.and.ellipse")
                                .lineLimit(1)
                        }
                        .accessibilityLabel(text("discovery.locationLabel"))
                        Spacer()
                        Button { withAnimation { showOptions.toggle() } } label: {
                            Label(text("discovery.options"), systemImage: "slider.horizontal.3")
                        }
                        .accessibilityValue(showOptions ? text("discovery.expanded") : text("discovery.collapsed"))
                    }
                    .font(.subheadline)
                    .buttonStyle(.plain)
                    .foregroundStyle(CivicTheme.muted)
                    if showOptions {
                        VStack(spacing: 8) {
                            Toggle(text("discovery.currentOnly"), isOn: $currentOnly)
                                .onChange(of: currentOnly) { _, _ in Task { await refresh() } }
                            Toggle(text("discovery.practice"), isOn: $includeSamples)
                                .onChange(of: includeSamples) { _, _ in Task { await refresh() } }
                        }
                        .font(.subheadline)
                        .padding(14)
                        .background(.white, in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(CivicTheme.border))
                    }
                    if area == .nearby {
                        Picker(text("discovery.view"), selection: $mapMode) {
                            Text(text("discovery.list")).tag(false)
                            Text(text("discovery.map")).tag(true)
                        }
                        .pickerStyle(.segmented)
                        .onChange(of: mapMode) { _, showingMap in
                            if showingMap { Task { await loadRemainingNearby() } }
                        }
                    }
                }
                if loading { ProgressView(text("common.loading")) }
                if let error { InlineNotice(message: error, isError: true) }
                if area == .saved && model.accessToken == nil {
                    InlineNotice(message: text("discovery.signIn"))
                    Button(text("auth.signInButton")) { Task { await model.signIn() } }
                        .buttonStyle(.bordered)
                } else if area == .nearby && mapMode && !items.isEmpty {
                    NearbyMapView(items: items, onShowList: { mapMode = false })
                }
                let visible = area == .saved ? saved.map(\.item) : items
                if !loading && !visible.isEmpty && !(area == .nearby && mapMode) {
                    HStack {
                        Text(text(area == .saved ? "discovery.savedHeading" : "discovery.sourcesHeading"))
                            .font(.subheadline.weight(.semibold))
                        Spacer()
                        Text(resultCount)
                            .font(.caption).foregroundStyle(CivicTheme.muted)
                    }
                    .padding(.top, 6)
                }
                if !loading && visible.isEmpty && error == nil && !(area == .saved && model.accessToken == nil) {
                    VStack(alignment: .leading, spacing: 8) {
                        Image(systemName: area == .saved ? "bookmark" : "magnifyingglass")
                            .font(.title3).foregroundStyle(CivicTheme.muted)
                        Text(text(area == .saved ? "discovery.noSaved" : "discovery.noResults"))
                            .font(.subheadline.weight(.semibold))
                        if area != .all && area != .saved {
                            Button(text("discovery.showAll")) { area = .all; Task { await refresh() } }
                                .font(.subheadline)
                        }
                    }
                    .padding(.vertical, 24)
                }
                if !(area == .nearby && mapMode) {
                    LazyVStack(spacing: 10) {
                        ForEach(visible) { item in
                            NavigationLink {
                                DiscoveryDetailView(itemID: item.id, includeSamples: includeSamples)
                            } label: {
                                VStack(alignment: .leading, spacing: 6) {
                                    HStack {
                                        Text(item.publisher)
                                        Spacer(minLength: 8)
                                        if item.freshness != "current" {
                                            Label(text("discovery.checkSource"), systemImage: "clock")
                                        }
                                    }
                                    .font(.caption).foregroundStyle(CivicTheme.muted)
                                    HStack(alignment: .top) {
                                        Text(item.title).font(.headline).foregroundStyle(CivicTheme.ink)
                                        Spacer(minLength: 6)
                                        Image(systemName: "chevron.right").font(.caption).foregroundStyle(CivicTheme.muted)
                                    }
                                    Text(item.summary).font(.subheadline).foregroundStyle(CivicTheme.muted).lineLimit(2)
                                    Text(item.jurisdiction.name)
                                        .font(.caption).foregroundStyle(CivicTheme.muted)
                                    if item.origin == "sample" {
                                        Label(text("discovery.practiceLabel"), systemImage: "info.circle")
                                            .font(.caption).foregroundStyle(CivicTheme.warning)
                                    }
                                }
                                .padding(14)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(.white, in: RoundedRectangle(cornerRadius: 14))
                                .overlay(RoundedRectangle(cornerRadius: 14).stroke(CivicTheme.border))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    if area != .saved && items.count < total {
                        Button(text("discovery.more")) { Task { await loadMore() } }
                            .buttonStyle(.bordered)
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: 720, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .background(CivicTheme.canvas)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            #if DEBUG
            let arguments = ProcessInfo.processInfo.arguments
            if let index = arguments.firstIndex(of: "-envoy-area"), arguments.indices.contains(index + 1) {
                area = DiscoveryArea(rawValue: arguments[index + 1]) ?? .all
            }
            mapMode = arguments.contains("-envoy-map")
            #endif
            await refresh()
        }
        .onChange(of: model.accessToken) { _, _ in Task { await refresh() } }
    }

    private func refresh() async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            if area == .saved {
                items = []
                if let token = model.accessToken {
                    saved = try await api.savedDiscovery(token: token, includeSamples: includeSamples)
                } else {
                    saved = []
                }
            } else {
                let response = try await api.discovery(area: area.apiValue, query: query, jurisdiction: jurisdiction, currentOnly: currentOnly, includeSamples: includeSamples)
                items = response.items
                total = response.total
                if area == .nearby && mapMode { await loadRemainingNearby() }
            }
        } catch { self.error = error.localizedDescription }
    }

    private func loadMore() async {
        guard !loading else { return }
        loading = true
        defer { loading = false }
        do {
            let response = try await api.discovery(area: area.apiValue, query: query, jurisdiction: jurisdiction, currentOnly: currentOnly, includeSamples: includeSamples, offset: items.count)
            items += response.items
            total = response.total
        } catch { self.error = error.localizedDescription }
    }

    private func loadRemainingNearby() async {
        guard area == .nearby, !loadingNearbyPages else { return }
        loadingNearbyPages = true
        defer { loadingNearbyPages = false }
        do {
            while items.count < total {
                let response = try await api.discovery(area: area.apiValue, query: query, jurisdiction: jurisdiction, currentOnly: currentOnly, includeSamples: includeSamples, offset: items.count)
                guard !response.items.isEmpty else { break }
                items += response.items
            }
        } catch { self.error = error.localizedDescription }
    }

    private func text(_ key: String) -> String { model.copy(key) }

    private var locationLabel: String {
        let location = DiscoveryLocation.all.first { $0.code == jurisdiction } ?? DiscoveryLocation.all[0]
        return text("discovery.location.\(location.key)")
    }

    private var resultCount: String {
        if area == .saved {
            return "\(saved.count) \(text(saved.count == 1 ? "discovery.savedOne" : "discovery.savedMany"))"
        }
        if items.count < total {
            return "\(items.count) \(text("discovery.of")) \(total)"
        }
        return "\(total) \(text(total == 1 ? "discovery.sourceOne" : "discovery.sourceMany"))"
    }
}

struct DiscoveryDetailView: View {
    @EnvironmentObject private var model: CivicResolveModel
    let itemID: String
    let includeSamples: Bool
    @State private var item: DiscoveryItem?
    @State private var saved = false
    @State private var checklist: [DiscoveryChecklistEntry] = []
    @State private var newStep = ""
    @State private var error: String?
    @State private var busy = false
    @State private var handoffURL: URL?
    private let api = WorkerAPI()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let item {
                    Text(item.title).font(.title2.weight(.semibold))
                    Text(item.summary).foregroundStyle(CivicTheme.ink)
                    if item.origin == "sample" {
                        InlineNotice(message: text("discovery.practiceNote"))
                    }
                    if item.freshness != "current" {
                        InlineNotice(message: text("discovery.staleNote"))
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        detail(text("discovery.publisher"), item.publisher)
                        detail(text("discovery.jurisdiction"), item.jurisdiction.name)
                        detail(text("discovery.status"), sourceStatus(item))
                        detail(text("discovery.freshness"), text("discovery.freshness.\(item.freshness)"))
                        detail(text("discovery.language"), text("discovery.language.\(item.language)"))
                        if let verifiedAt = item.verifiedAt { detail(text("discovery.verified"), String(verifiedAt.prefix(10))) }
                        if let url = URL(string: item.evidenceUrl ?? "") {
                            Link(destination: url) { Label(text("discovery.evidence"), systemImage: "doc.text") }
                        }
                        if let url = URL(string: item.termsUrl ?? "") {
                            Link(destination: url) { Label(text("discovery.terms"), systemImage: "doc.text") }
                        }
                    }
                    .padding(15)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.white, in: RoundedRectangle(cornerRadius: 14))
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(CivicTheme.border))

                    if item.handoff != nil {
                        InlineNotice(message: text("discovery.handoffNote"))
                        Button { Task { await openOfficial() } } label: {
                            Label(text("discovery.openOfficial"), systemImage: "arrow.up.right.square")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(CivicTheme.ink)
                    } else {
                        InlineNotice(message: text("discovery.noHandoff"))
                    }

                    if model.accessToken != nil {
                        Button(saved ? text("discovery.removeSaved") : text("discovery.save")) {
                            Task { await toggleSaved() }
                        }
                        .buttonStyle(.bordered)
                        .disabled(busy)
                        if saved { checklistSection }
                    } else {
                        Text(text("discovery.signIn")).font(.subheadline).foregroundStyle(CivicTheme.muted)
                    }
                } else if error == nil { ProgressView(text("common.loading")) }
                if let error { InlineNotice(message: error, isError: true) }
            }
            .padding(16)
            .frame(maxWidth: 720, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .background(CivicTheme.canvas)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .onChange(of: model.accessToken) { _, _ in Task { await loadSaved() } }
        .confirmationDialog(text("discovery.openOfficial"), isPresented: Binding(get: { handoffURL != nil }, set: { if !$0 { handoffURL = nil } })) {
            if let handoffURL {
                Link(text("discovery.continueOfficial"), destination: handoffURL)
            }
        } message: { Text(text("discovery.handoffNote")) }
    }

    private var checklistSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(text("discovery.checklist")).font(.headline)
            ForEach(checklist.indices, id: \.self) { index in
                Button {
                    checklist[index].done.toggle()
                    Task { await updateChecklist() }
                } label: {
                    Label(checklist[index].text, systemImage: checklist[index].done ? "checkmark.square.fill" : "square")
                        .foregroundStyle(CivicTheme.ink)
                }
                .buttonStyle(.plain)
            }
            HStack {
                TextField(text("discovery.stepHint"), text: $newStep)
                    .textFieldStyle(.roundedBorder)
                Button { Task { await addStep() } } label: { Image(systemName: "plus") }
                    .disabled(newStep.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || checklist.count >= 12)
                    .accessibilityLabel(text("discovery.addStep"))
            }
        }
        .padding(15)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.white, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(CivicTheme.border))
    }

    private func detail(_ label: String, _ value: String) -> some View {
        HStack(alignment: .top) {
            Text(label).foregroundStyle(CivicTheme.muted).frame(width: 94, alignment: .leading)
            Text(value)
        }
        .font(.subheadline)
    }

    private func load() async {
        do {
            item = try await api.discoveryDetail(id: itemID, includeSamples: includeSamples)
            await loadSaved()
        } catch { self.error = error.localizedDescription }
    }

    private func loadSaved() async {
        guard let token = model.accessToken else { saved = false; checklist = []; return }
        do {
            let match = try await api.savedDiscovery(token: token, includeSamples: includeSamples).first { $0.id == itemID }
            saved = match != nil
            checklist = match?.checklist ?? []
        } catch { self.error = error.localizedDescription }
    }

    private func toggleSaved() async {
        guard let token = model.accessToken else { return }
        busy = true
        defer { busy = false }
        do {
            if saved {
                try await api.removeSavedDiscovery(id: itemID, token: token)
                saved = false
                checklist = []
            } else {
                checklist = try await api.saveDiscovery(id: itemID, token: token, includeSamples: includeSamples)
                saved = true
            }
        } catch { self.error = error.localizedDescription }
    }

    private func addStep() async {
        let value = newStep.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty, value.count <= 140, checklist.count < 12 else { return }
        checklist.append(.init(id: UUID().uuidString, text: value, done: false))
        newStep = ""
        await updateChecklist()
    }

    private func updateChecklist() async {
        guard let token = model.accessToken else { return }
        do {
            checklist = try await api.saveDiscovery(id: itemID, token: token, includeSamples: includeSamples, checklist: checklist)
        } catch { self.error = error.localizedDescription }
    }

    private func openOfficial() async {
        do {
            let handoff = try await api.discoveryHandoff(id: itemID)
            guard !handoff.externalSubmissionRecorded, let url = URL(string: handoff.url), url.scheme == "https" else { return }
            handoffURL = url
        } catch { self.error = error.localizedDescription }
    }

    private func text(_ key: String) -> String { model.copy(key) }

    private func sourceStatus(_ item: DiscoveryItem) -> String {
        switch item.origin {
        case "sample": text("discovery.practiceLabel")
        case "official_external": text("discovery.officialSource")
        default: text("discovery.participatingSource")
        }
    }
}
