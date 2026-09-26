import MapKit
import SwiftUI

struct NearbyMapView: View {
    @EnvironmentObject private var model: CivicResolveModel
    let items: [DiscoveryItem]
    let onShowList: () -> Void
    @State private var selectedID: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if mappable.isEmpty {
                Text(model.copy("discovery.mapEmpty"))
                    .foregroundStyle(CivicTheme.muted)
            } else {
                Text("\(mappable.count) \(model.copy(mappable.count == 1 ? "discovery.mapLocationOne" : "discovery.mapLocationMany"))")
                    .font(.caption).foregroundStyle(CivicTheme.muted)
                ClusteredNearbyMap(items: mappable, onSelect: { selectedID = $0 })
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
        .navigationDestination(item: $selectedID) { id in
            DiscoveryDetailView(itemID: id, includeSamples: items.first(where: { $0.id == id })?.origin == "sample")
        }
    }

    private var mappable: [DiscoveryItem] { items.filter { $0.coordinates != nil } }
}

private final class NearbyAnnotation: NSObject, MKAnnotation {
    let itemID: String
    let practice: Bool
    let title: String?
    dynamic var coordinate: CLLocationCoordinate2D

    init(item: DiscoveryItem) {
        itemID = item.id
        practice = item.origin == "sample"
        title = item.title
        coordinate = CLLocationCoordinate2D(latitude: item.coordinates!.latitude, longitude: item.coordinates!.longitude)
    }
}

private struct ClusteredNearbyMap: UIViewRepresentable {
    let items: [DiscoveryItem]
    let onSelect: (String) -> Void

    func makeUIView(context: Context) -> MKMapView {
        let map = MKMapView()
        map.delegate = context.coordinator
        map.register(MKMarkerAnnotationView.self, forAnnotationViewWithReuseIdentifier: "source")
        map.register(MKMarkerAnnotationView.self, forAnnotationViewWithReuseIdentifier: "cluster")
        return map
    }

    func updateUIView(_ map: MKMapView, context: Context) {
        context.coordinator.onSelect = onSelect
        let fingerprint = items.map { item in
            "\(item.id):\(item.coordinates!.latitude):\(item.coordinates!.longitude):\(item.origin)"
        }
        if context.coordinator.fingerprint == fingerprint { return }
        context.coordinator.fingerprint = fingerprint
        let existing = map.annotations.compactMap { $0 as? NearbyAnnotation }
        map.removeAnnotations(existing)
        let annotations = items.map(NearbyAnnotation.init)
        map.addAnnotations(annotations)
        if !annotations.isEmpty { map.showAnnotations(annotations, animated: false) }
    }

    func makeCoordinator() -> Coordinator { Coordinator(onSelect: onSelect) }

    final class Coordinator: NSObject, MKMapViewDelegate {
        var onSelect: (String) -> Void
        var fingerprint: [String] = []

        init(onSelect: @escaping (String) -> Void) { self.onSelect = onSelect }

        func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
            if let source = annotation as? NearbyAnnotation {
                let marker = mapView.dequeueReusableAnnotationView(withIdentifier: "source", for: source) as! MKMarkerAnnotationView
                marker.markerTintColor = source.practice ? .systemGray : .black
                marker.glyphImage = UIImage(systemName: source.practice ? "circle.dotted" : "mappin")
                marker.clusteringIdentifier = "envoy-source"
                marker.canShowCallout = true
                return marker
            }
            if annotation is MKClusterAnnotation {
                let marker = mapView.dequeueReusableAnnotationView(withIdentifier: "cluster", for: annotation) as! MKMarkerAnnotationView
                marker.markerTintColor = .black
                marker.canShowCallout = false
                return marker
            }
            return nil
        }

        func mapView(_ mapView: MKMapView, didSelect view: MKAnnotationView) {
            if let cluster = view.annotation as? MKClusterAnnotation {
                mapView.showAnnotations(cluster.memberAnnotations, animated: true)
                mapView.deselectAnnotation(cluster, animated: false)
                return
            }
            guard let source = view.annotation as? NearbyAnnotation else { return }
            onSelect(source.itemID)
            mapView.deselectAnnotation(source, animated: false)
        }
    }
}
