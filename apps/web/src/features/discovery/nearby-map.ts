import type { Locale } from "@civicresolve/contracts/v1";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
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

  function updateSelection(id: string | null, pan = true): void {
    selectedId = id;
    for (const [pointId, marker] of markerButtons) {
      const active = pointId === id;
      marker.classList.toggle("is-selected", active);
      marker.setAttribute("aria-pressed", String(active));
    }
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

  function updateMarkers(fit = false): void {
    if (!map || !loaded) return;
    for (const marker of markers) marker.remove();
    markers = [];
    markerButtons.clear();
    for (const point of points) {
      const element = markerElement(point);
      markerButtons.set(point.id, element);
      const marker = new maplibreMarker({ element, anchor: "bottom" })
        .setLngLat([point.longitude, point.latitude])
        .addTo(map);
      markers.push(marker);
    }
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
    updateSelection(selectedId, !fit);
  }

  // The constructor is loaded lazily; only a user opening Nearby loads MapLibre.
  let maplibreMarker: typeof Marker;
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
      map?.remove();
      map = null;
    },
  };
}
