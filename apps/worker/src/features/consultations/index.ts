import { API_VERSION } from "@civicresolve/contracts/v1";
import {
  toConsultation,
  type ConsultationRow,
} from "@civicresolve/sources/adapters/consultations";
import { featureError, featureJson, type FeatureContext } from "../shared.js";

const ROOT = "/api/v1/consultations";
const ITEM = /^\/api\/v1\/consultations\/([a-z0-9-]+)(?:\/(handoff))?$/;

export async function handleConsultationRequest(
  request: Request,
  url: URL,
  context: FeatureContext,
): Promise<Response | null> {
  if (url.pathname !== ROOT && !url.pathname.startsWith(`${ROOT}/`)) return null;
  if (request.method !== "GET")
    return featureError(context, "METHOD_NOT_ALLOWED", "Use GET.", 405);

  if (url.pathname === ROOT) {
    const jurisdiction = url.searchParams.get("jurisdiction");
    if (jurisdiction && !["CA", "CA-BC", "CA-ON"].includes(jurisdiction))
      return featureError(context, "INVALID_FILTER", "Unknown jurisdiction.", 400);
    const query = jurisdiction
      ? context.env.DB.prepare(
          `SELECT * FROM consultations WHERE jurisdiction_code = ?
           ORDER BY CASE WHEN kind = 'consultation' THEN 0 ELSE 1 END,
             deadline_date ASC, title ASC`,
        ).bind(jurisdiction)
      : context.env.DB.prepare(
          `SELECT * FROM consultations
           ORDER BY CASE WHEN kind = 'consultation' THEN 0 ELSE 1 END,
             deadline_date ASC, title ASC`,
        );
    const rows = await query.all<ConsultationRow>();
    return featureJson(context, {
      apiVersion: API_VERSION,
      consultations: (rows.results ?? []).map((row) => toConsultation(row)),
      policy: { externalParticipationOnly: true, inAppSubmissions: false },
      requestId: context.requestId,
    });
  }

  const match = url.pathname.match(ITEM);
  if (!match)
    return featureError(context, "NOT_FOUND", "Consultation not found.", 404);
  const row = await context.env.DB.prepare("SELECT * FROM consultations WHERE id = ?")
    .bind(match[1]!)
    .first<ConsultationRow>();
  if (!row)
    return featureError(context, "NOT_FOUND", "Consultation not found.", 404);
  const consultation = toConsultation(row);
  if (match[2] === "handoff")
    return featureJson(context, {
      apiVersion: API_VERSION,
      consultationId: row.id,
      officialUrl: consultation.officialUrl,
      sourceState: consultation.sourceState,
      deadlineDate: consultation.deadlineDate,
      participationStatus: consultation.participationStatus,
      instruction: "Continue on the official site. Envoy has not recorded a contribution.",
      externalOnly: true,
      inAppSubmission: false,
      requestId: context.requestId,
    });
  return featureJson(context, {
    apiVersion: API_VERSION,
    consultation,
    requestId: context.requestId,
  });
}
