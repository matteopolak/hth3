import MapKit
import SwiftUI

struct NearbyMapView: View {
    @EnvironmentObject private var model: CivicResolveModel
    let items: [DiscoveryItem]
    @State private var position: MapCameraPosition = .automatic

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if mappable.isEmpty {
                Text(model.copy("discovery.mapEmpty"))
                    .foregroundStyle(CivicTheme.muted)
            } else {
                Map(position: $position) {
                    ForEach(mappable) { item in
                        if let coordinate = item.coordinates {
                            Annotation(item.title, coordinate: CLLocationCoordinate2D(latitude: coordinate.latitude, longitude: coordinate.longitude)) {
                                NavigationLink {
                                    DiscoveryDetailView(itemID: item.id, includeSamples: item.origin == "sample")
                                } label: {
                                    Image(systemName: "mappin.circle.fill")
                                        .font(.title2)
                                        .foregroundStyle(CivicTheme.ink)
                                        .background(.white, in: Circle())
                                }
                                .accessibilityLabel(item.title)
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
        }
    }

    private var mappable: [DiscoveryItem] { items.filter { $0.coordinates != nil } }
}
