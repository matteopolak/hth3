import MapKit
import SwiftUI

struct NearbyMapView: View {
    @EnvironmentObject private var model: CivicResolveModel
    let items: [DiscoveryItem]
    let onShowList: () -> Void
    @State private var position: MapCameraPosition = .automatic

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if mappable.isEmpty {
                Text(model.copy("discovery.mapEmpty"))
                    .foregroundStyle(CivicTheme.muted)
            } else {
                Text("\(mappable.count) \(model.copy(mappable.count == 1 ? "discovery.mapLocationOne" : "discovery.mapLocationMany"))")
                    .font(.caption).foregroundStyle(CivicTheme.muted)
                Map(position: $position) {
                    ForEach(mappable) { item in
                        if let coordinate = item.coordinates {
                            Annotation(item.title, coordinate: CLLocationCoordinate2D(latitude: coordinate.latitude, longitude: coordinate.longitude)) {
                                NavigationLink {
                                    DiscoveryDetailView(itemID: item.id, includeSamples: item.origin == "sample")
                                } label: {
                                    Image(systemName: item.origin == "sample" ? "mappin.circle" : "mappin.circle.fill")
                                        .font(.title2)
                                        .foregroundStyle(CivicTheme.ink)
                                        .background(.white, in: Circle())
                                }
                                .accessibilityLabel(item.origin == "sample" ? "\(item.title), \(model.copy("discovery.practiceLabel"))" : item.title)
                            }
                        }
                    }
                }
                .frame(height: 350)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(CivicTheme.border))
                Text(model.copy("discovery.mapNote"))
                    .font(.caption).foregroundStyle(CivicTheme.muted)
            }
            Button(action: onShowList) {
                Label(model.copy("discovery.showList"), systemImage: "list.bullet")
            }
            .font(.subheadline)
            .buttonStyle(.plain)
        }
    }

    private var mappable: [DiscoveryItem] { items.filter { $0.coordinates != nil } }
}
