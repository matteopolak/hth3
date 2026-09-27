import type { ToolArguments } from "./types.js";

interface NearbyChoice {
  name: "search_nearby";
  args: ToolArguments;
}

interface NearbyItem {
  title?: unknown;
  jurisdiction?: {
    name?: unknown;
    municipality?: { name?: unknown };
  };
  handoff?: { url?: unknown; publisher?: unknown };
  service?: { address?: unknown };
}

/** Route a named service-office question to location-scoped source records. */
export function nearbyOfficeTool(message: string): NearbyChoice | undefined {
  if (
    !/\b(?:public service office|government service office|service office|service centre|service center|serviceontario|nearby public services?|nearby government services?)\b/iu.test(
      message,
    )
  )
    return undefined;
  const place = message.match(
    /\b(?:near|in|around|at)\s+([A-ZÀ-ÖØ-Þ][\p{L}’'-]{2,})(?:,\s*([A-ZÀ-ÖØ-Þ][\p{L}’'-]{2,}))?/u,
  );
  if (!place) return undefined;
  return {
    name: "search_nearby",
    args: { location: place[1], limit: 12 },
  };
}

/** Answer only from service locations whose structured municipality matches. */
export function nearbyOfficeAnswer(
  data: unknown,
  locale: "en" | "fr",
  requestedCity: string,
  requestedProvince?: string,
): string {
  const payload = data as { items?: NearbyItem[] } | null;
  const city = requestedCity.toLocaleLowerCase();
  const province = requestedProvince?.toLocaleLowerCase();
  const matches = (Array.isArray(payload?.items) ? payload.items : [])
    .filter((item) => {
      const municipality = item.jurisdiction?.municipality?.name;
      const jurisdiction = item.jurisdiction?.name;
      return (
        typeof municipality === "string" &&
        municipality.toLocaleLowerCase() === city &&
        (!province ||
          (typeof jurisdiction === "string" &&
            jurisdiction.toLocaleLowerCase().includes(province)))
      );
    })
    .slice(0, 3);
  if (matches.length === 0)
    return locale === "fr"
      ? `Je n'ai trouvé aucun bureau de service public confirmé à ${requestedCity} dans les sources publiées d'Envoy.`
      : `I found no confirmed public service office in ${requestedCity} among Envoy's published sources.`;
  const lines = matches.map((item) => {
    const title = safeText(item.title);
    const address = safeText(item.service?.address);
    const publisher = safeText(item.handoff?.publisher);
    const url = officialUrl(item.handoff?.url);
    return locale === "fr"
      ? `- ${title}${address ? ` — ${address}` : ""}${url ? `. [Page officielle${publisher ? ` (${publisher})` : ""}](${url})` : ""}`
      : `- ${title}${address ? ` — ${address}` : ""}${url ? `. [Official location page${publisher ? ` (${publisher})` : ""}](${url})` : ""}`;
  });
  const intro =
    locale === "fr"
      ? `J'ai trouvé ${matches.length} bureau${matches.length === 1 ? "" : "x"} de service à ${requestedCity} :`
      : `I found ${matches.length} public service office${matches.length === 1 ? "" : "s"} in ${requestedCity}:`;
  const verification =
    locale === "fr"
      ? "Vérifiez les heures et les services sur la page officielle avant de vous déplacer."
      : "Check the official location page for current hours and services before visiting.";
  return `${intro}\n${lines.join("\n")}\n${verification}`;
}

/** Ottawa is a real municipality, but Envoy has no intake or duplicate data there. */
export function unsupportedOttawaFeedbackAnswer(
  message: string,
  locale: "en" | "fr",
): string | undefined {
  if (!/\bOttawa\b/iu.test(message) || /\bToronto\b/iu.test(message))
    return undefined;
  if (
    !/\b(?:broken|damaged|unsafe|complaint|report|feedback|not working|pothole|missed garbage|streetlight|bench|défectueux|endommagé|endommagée|signalement|plainte)\b/iu.test(
      message,
    )
  )
    return undefined;
  const parks = /\b(?:park|bench|parc|banc)\b/iu.test(message);
  const link = parks
    ? "https://ottawa.ca/en/3-1-1/report-or-request/park-maintenance/parks-and-green-spaces"
    : "https://ottawa.ca/en/3-1-1/report-or-request";
  return locale === "fr"
    ? `Envoy ne peut pas vérifier les signalements semblables ni préparer un envoi pour Ottawa, car aucune destination n'y est configurée. Consultez la [page officielle de la Ville d'Ottawa](${link}); rien n'a été envoyé.`
    : `Envoy cannot check matching reports or prepare a submission for Ottawa because no Ottawa destination is configured. Use the [City of Ottawa's official reporting page](${link}); nothing was submitted.`;
}

function safeText(value: unknown): string {
  return typeof value === "string"
    ? value
        .replace(/[\[\]<>]/g, "")
        .trim()
        .slice(0, 240)
    : "";
}

function officialUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
