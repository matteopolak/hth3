import { API_VERSION } from "@civicresolve/contracts/v1";
import {
  serviceBcMetadata,
  serviceLocationView,
  type ServiceCategory,
  type ServiceLocationInput,
  type ServiceLocationMetadata,
} from "@civicresolve/sources/geo";
import { handleDiscoveryRequest } from "../discovery/index.js";
import { featureError, featureJson, type FeatureContext } from "../shared.js";

const ROOT = "/api/v1/nearby";
const CATEGORIES = [
  "government",
  "library",
  "community",
  "transit",
  "other",
] as const;

interface NearbyItem extends ServiceLocationInput {
  type: string;
}

interface DiscoveryPage {
  items: NearbyItem[];
  total: number;
  samplesIncluded: boolean;
}

/** Public, source-backed list and map data for any in-person public service. */
export async function handleNearbyRequest(
  request: Request,
  url: URL,
  context: FeatureContext,
): Promise<Response | null> {
  if (url.pathname !== ROOT) return null;
  if (request.method !== "GET")
    return featureError(context, "METHOD_NOT_ALLOWED", "Method not allowed.", 405);

  const category = url.searchParams.get("category");
  if (category && !isCategory(category))
    return featureError(context, "INVALID_FILTER", "Unknown service category.", 400);
  const limit = boundedInteger(url.searchParams.get("limit"), 30, 1, 100);
  const offset = boundedInteger(url.searchParams.get("offset"), 0, 0, 10000);
  if (limit === null || offset === null)
    return featureError(context, "INVALID_FILTER", "Invalid pagination.", 400);

  const discoveryUrl = new URL(url);
  discoveryUrl.pathname = "/api/v1/discovery";
  discoveryUrl.searchParams.delete("category");
  discoveryUrl.searchParams.set("area", "nearby");
  discoveryUrl.searchParams.set("limit", "100");

  const items: NearbyItem[] = [];
  let total = 0;
  let samplesIncluded = false;
  do {
    discoveryUrl.searchParams.set("offset", String(items.length));
    const response = await handleDiscoveryRequest(request, discoveryUrl, context);
    if (!response || !response.ok) return response;
    const page = (await response.json()) as DiscoveryPage;
    total = page.total;
    samplesIncluded = page.samplesIncluded;
    if (page.items.length === 0) break;
    items.push(...page.items);
  } while (items.length < total);

  const metadata = await loadMetadata(context);
  const enriched = items
    .map((item) => ({
      ...item,
      service: serviceLocationView(
        item,
        metadata.get(item.id) ?? serviceBcMetadata(item),
      ),
    }))
    .filter((item) => !category || item.service.category === category);

  return featureJson(context, {
    apiVersion: API_VERSION,
    items: enriched.slice(offset, offset + limit),
    total: enriched.length,
    limit,
    offset,
    samplesIncluded,
    requestId: context.requestId,
  });
}

async function loadMetadata(
  context: FeatureContext,
): Promise<Map<string, ServiceLocationMetadata>> {
  const rows = await context.env.DB.prepare(
    `SELECT record_id, service_category, address, public_access_summary,
            services_summary, hours_summary, accessibility_summary,
            details_verified_at, details_source_url, coordinates_source_url
     FROM service_location_metadata`,
  ).all<ServiceLocationMetadata>();
  return new Map((rows.results ?? []).map((row) => [row.record_id, row]));
}

function isCategory(value: string): value is ServiceCategory {
  return (CATEGORIES as readonly string[]).includes(value);
}

function boundedInteger(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
): number | null {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max
    ? parsed
    : null;
}
