import type { Locale } from "@civicresolve/contracts/v1";
import type { Map as MapLibreMap, Marker, Popup } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import "./nearby-map.css";

type Category = "government" | "library" | "community" | "transit" | "other";

export interface NearbyMapPoint {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  category?: Category;
}

export interface NearbyMapOptions {
  locale: Locale;
  points: readonly NearbyMapPoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onFallback: () => void;
}

export interface NearbyMapView {
  element: HTMLElement;
  setSelected: (id: string | null) => void;
  setPoints: (
    points: readonly NearbyMapPoint[],
    selectedId: string | null,
  ) => void;
  resize: () => void;
  destroy: () => void;
}

const DEFAULT_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const copy = {
  en: {
    region: "Map of sourced places",
    loading: "Loading map…",
    unavailable: "The map is unavailable. You can still use the list.",
    noCoordinates: "These sources have no verified map locations.",
    list: "View list",
    marker: "Show details for",
    cluster: "locations together. Zoom in to separate them.",
    clusterList: "Locations in this area",
    moreLocations: "View all locations in the list",
  },
  fr: {
    region: "Carte des lieux provenant de sources",
    loading: "Chargement de la carte…",
    unavailable:
      "La carte n'est pas disponible. Vous pouvez utiliser la liste.",
    noCoordinates:
      "Ces sources n'ont aucun emplacement cartographique vérifié.",
    list: "Voir la liste",
    marker: "Afficher les détails de",
    cluster: "lieux regroupés. Zoomez pour les séparer.",
    clusterList: "Lieux dans cette zone",
    moreLocations: "Voir tous les lieux dans la liste",
  },
} as const;

function verifiedPoints(points: readonly NearbyMapPoint[]): NearbyMapPoint[] {
  return points.filter(
    (point) =>
      point.id.trim().length > 0 &&
      point.title.trim().length > 0 &&
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude) &&
      Math.abs(point.latitude) <= 90 &&
      Math.abs(point.longitude) <= 180,
  );
}

function button(
  label: string,
  className: string,
  onClick: () => void,
): HTMLButtonElement {
  const result = document.createElement("button");
  result.type = "button";
  result.className = className;
  result.textContent = label;
  result.addEventListener("click", onClick);
  return result;
}

function styleUrl(): string {
  const configured = import.meta.env.VITE_MAP_STYLE_URL?.trim();
  return configured && /^https:\/\//i.test(configured)
    ? configured
    : DEFAULT_STYLE;
}

/** Mounts a real tiled map only after its element is attached to the document. */
export function createNearbyMap(options: NearbyMapOptions): NearbyMapView {
  const text = copy[options.locale];
  const element = document.createElement("section");
  element.className = "nearby-map-view";
  element.setAttribute("aria-label", text.region);
  const mapElement = document.createElement("div");
  mapElement.className = "nearby-map-canvas";
  mapElement.setAttribute("aria-label", text.region);
  const status = document.createElement("p");
  status.className = "nearby-map-status";
  status.setAttribute("role", "status");
  status.textContent = text.loading;
  const listButton = button(
    text.list,
    "nearby-map-list-button",
    options.onFallback,
  );
  const overlay = document.createElement("div");
  overlay.className = "nearby-map-overlay";
  overlay.append(status, listButton);
  element.append(mapElement, overlay);

  let map: MapLibreMap | null = null;
  let markers: Marker[] = [];
  let markerButtons = new globalThis.Map<string, HTMLButtonElement>();
  let points = verifiedPoints(options.points);
  let selectedId = options.selectedId;
  let disposed = false;
  let loaded = false;
  let loadTimeout: number | undefined;
  let resizeObserver: ResizeObserver | null = null;
  let fallbackQueued = false;
  let clusterPopup: Popup | null = null;

  function unavailable(message: string): void {
    if (disposed) return;
    if (!status.isConnected) overlay.prepend(status);
    status.textContent = message;
    element.classList.add("is-unavailable");
    element.classList.remove("is-ready");
    if (loadTimeout) window.clearTimeout(loadTimeout);
    loaded = false;
    for (const marker of markers) marker.remove();
    markers = [];
    markerButtons.clear();
    clusterPopup?.remove();
    clusterPopup = null;
    const previous = map;
    map = null;
    previous?.remove();
    if (!fallbackQueued) {
      fallbackQueued = true;
      queueMicrotask(() => {
        if (!disposed) options.onFallback();
      });
    }
  }

  function markerElement(point: NearbyMapPoint): HTMLButtonElement {
    const marker = button("", "nearby-map-marker", () =>
      options.onSelect(point.id),
    );
    marker.setAttribute("aria-label", `${text.marker} ${point.title}`);
    marker.title = point.title;
    marker.dataset.category = point.category ?? "other";
    marker.dataset.id = point.id;
    const dot = document.createElement("span");
    dot.setAttribute("aria-hidden", "true");
    marker.append(dot);
    return marker;
  }

  function clusterElement(group: NearbyMapPoint[]): HTMLButtonElement {
    const cluster = button(String(group.length), "nearby-map-cluster", () => {
      if (!map) return;
      const center = clusterCenter(group);
      if (map.getZoom() < 15) {
        map.easeTo({
          center,
          zoom: Math.min(map.getZoom() + 2, 16),
          duration: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? 0
            : 350,
        });
      } else {
        const content = document.createElement("div");
        content.className = "nearby-map-cluster-list";
        const heading = document.createElement("strong");
        heading.textContent = text.clusterList;
        content.append(heading);
        for (const point of group.slice(0, 12)) {
          content.append(
            button(point.title, "nearby-map-cluster-item", () => {
              clusterPopup?.remove();
              options.onSelect(point.id);
            }),
          );
        }
        if (group.length > 12)
          content.append(
            button(
              text.moreLocations,
              "nearby-map-cluster-item",
              options.onFallback,
            ),
          );
        clusterPopup?.remove();
        clusterPopup = new maplibrePopup({
          closeButton: true,
          maxWidth: "260px",
        })
          .setLngLat(center)
          .setDOMContent(content)
          .addTo(map);
        content.querySelector<HTMLButtonElement>("button")?.focus();
      }
    });
    cluster.setAttribute("aria-label", `${group.length} ${text.cluster}`);
    cluster.title = `${group.length} ${text.clusterList}`;
    return cluster;
  }

  function clusterCenter(group: NearbyMapPoint[]): [number, number] {
    const sum = group.reduce<[number, number]>(
      (position, point) => [
        position[0] + point.longitude,
        position[1] + point.latitude,
      ],
      [0, 0],
    );
    return [sum[0] / group.length, sum[1] / group.length];
  }

  function groupedPoints(): NearbyMapPoint[][] {
    if (!map) return [];
    const unselected = points.filter((point) => point.id !== selectedId);
    const pixels = unselected.map((point) =>
      map!.project([point.longitude, point.latitude]),
    );
    const parents = unselected.map((_, index) => index);
    const find = (index: number): number => {
      while (parents[index] !== index) {
        parents[index] = parents[parents[index]!]!;
        index = parents[index]!;
      }
      return index;
    };
    const spacing = window.matchMedia("(pointer: coarse)").matches ? 56 : 46;
    for (let first = 0; first < pixels.length; first++) {
      for (let second = first + 1; second < pixels.length; second++) {
        if (
          Math.hypot(
            pixels[first]!.x - pixels[second]!.x,
            pixels[first]!.y - pixels[second]!.y,
          ) < spacing
        )
          parents[find(second)] = find(first);
      }
    }
    const groups = new globalThis.Map<number, NearbyMapPoint[]>();
    for (const [index, point] of unselected.entries()) {
      const root = find(index);
      const group = groups.get(root) ?? [];
      group.push(point);
      groups.set(root, group);
    }
    return [...groups.values()];
  }

  function updateSelection(id: string | null, pan = true): void {
    selectedId = id;
    renderMarkers();
    const selected = points.find((point) => point.id === id);
    if (pan && map && selected) {
      map.easeTo({
        center: [selected.longitude, selected.latitude],
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 350,
      });
    }
  }

  function renderMarkers(): void {
    if (!map || !loaded) return;
    clusterPopup?.remove();
    clusterPopup = null;
    for (const marker of markers) marker.remove();
    markers = [];
    markerButtons.clear();
    for (const group of groupedPoints()) {
      const point = group[0]!;
      const element =
        group.length === 1 ? markerElement(point) : clusterElement(group);
      if (group.length === 1) markerButtons.set(point.id, element);
      markers.push(
        new maplibreMarker({ element, anchor: "center" })
          .setLngLat(
            group.length === 1
              ? [point.longitude, point.latitude]
              : clusterCenter(group),
          )
          .addTo(map),
      );
    }
    const selected = points.find((point) => point.id === selectedId);
    if (selected) {
      const element = markerElement(selected);
      element.classList.add("is-selected");
      element.setAttribute("aria-pressed", "true");
      element.style.zIndex = "10";
      markerButtons.set(selected.id, element);
      markers.push(
        new maplibreMarker({ element, anchor: "center" })
          .setLngLat([selected.longitude, selected.latitude])
          .addTo(map),
      );
    }
  }

  function updateMarkers(fit = false): void {
    if (!map || !loaded) return;
    if (fit && points.length > 0) {
      if (points.length === 1) {
        const point = points[0]!;
        map.jumpTo({ center: [point.longitude, point.latitude], zoom: 11 });
      } else {
        const bounds = points.reduce(
          (range, point) => {
            range[0][0] = Math.min(range[0][0], point.longitude);
            range[0][1] = Math.min(range[0][1], point.latitude);
            range[1][0] = Math.max(range[1][0], point.longitude);
            range[1][1] = Math.max(range[1][1], point.latitude);
            return range;
          },
          [
            [180, 90],
            [-180, -90],
          ] as [[number, number], [number, number]],
        );
        map.fitBounds(bounds, { padding: 55, maxZoom: 12, duration: 0 });
      }
    }
    renderMarkers();
  }

  // The constructor is loaded lazily; only a user opening Nearby loads MapLibre.
  let maplibreMarker: typeof Marker;
  let maplibrePopup: typeof Popup;
  async function mount(): Promise<void> {
    if (disposed || !element.isConnected || map) return;
    if (points.length === 0) {
      unavailable(text.noCoordinates);
      return;
    }
    if (!status.isConnected) overlay.prepend(status);
    status.textContent = text.loading;
    element.classList.remove("is-unavailable", "is-ready");
    fallbackQueued = false;
    try {
      const maplibre = await import("maplibre-gl");
      if (disposed || !element.isConnected) return;
      maplibre.setWorkerUrl(workerUrl);
      maplibreMarker = maplibre.Marker;
      maplibrePopup = maplibre.Popup;
      map = new maplibre.Map({
        container: mapElement,
        style: styleUrl(),
        center: [points[0]!.longitude, points[0]!.latitude],
        zoom: 10,
        attributionControl: { compact: false },
        scrollZoom: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
      map.addControl(
        new maplibre.NavigationControl({ showCompass: false }),
        "top-right",
      );
      map.on("load", () => {
        if (disposed) return;
        loaded = true;
        if (loadTimeout) window.clearTimeout(loadTimeout);
        status.remove();
        element.classList.add("is-ready");
        updateMarkers(true);
      });
      map.on("moveend", renderMarkers);
      map.on("error", () => {
        if (!loaded) unavailable(text.unavailable);
      });
      loadTimeout = window.setTimeout(() => {
        if (!loaded) unavailable(text.unavailable);
      }, 15_000);
      resizeObserver = new ResizeObserver(() => map?.resize());
      resizeObserver.observe(element);
    } catch {
      unavailable(text.unavailable);
    }
  }

  const frame = requestAnimationFrame(() => void mount());
  return {
    element,
    setSelected: updateSelection,
    setPoints(nextPoints, nextSelectedId) {
      points = verifiedPoints(nextPoints);
      selectedId = nextSelectedId;
      if (points.length === 0) unavailable(text.noCoordinates);
      else if (!map) void mount();
      else updateMarkers(true);
    },
    resize() {
      map?.resize();
    },
    destroy() {
      disposed = true;
      cancelAnimationFrame(frame);
      if (loadTimeout) window.clearTimeout(loadTimeout);
      resizeObserver?.disconnect();
      for (const marker of markers) marker.remove();
      markers = [];
      markerButtons.clear();
      clusterPopup?.remove();
      clusterPopup = null;
      map?.remove();
      map = null;
    },
  };
}
