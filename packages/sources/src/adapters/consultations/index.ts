/** A curated consultation is a link to the publisher, never an Envoy intake. */
export interface ConsultationRow {
  id: string;
  kind: "consultation" | "directory";
  title: string;
  summary: string;
  publisher: string;
  jurisdiction_level: "federal" | "provincial";
  jurisdiction_code: "CA" | "CA-BC" | "CA-ON";
  jurisdiction_name: string;
  official_url: string;
  evidence_url: string;
  deadline_date: string | null;
  verified_at: string;
  expires_at: string;
  source_state: "current" | "stale" | "error";
  last_error: string | null;
}

export interface Consultation {
  id: string;
  kind: ConsultationRow["kind"];
  title: string;
  summary: string;
  publisher: string;
  jurisdiction: {
    level: ConsultationRow["jurisdiction_level"];
    code: ConsultationRow["jurisdiction_code"];
    name: string;
  };
  deadlineDate: string | null;
  officialUrl: string;
  evidenceUrl: string;
  sourceState: ConsultationRow["source_state"];
  verifiedAt: string;
  expiresAt: string;
  lastError: string | null;
  participationStatus: "open" | "closed" | "directory" | "check_official_source";
  externalOnly: true;
  inAppSubmission: false;
}

/** Date-only deadlines remain date-only; the official site controls its closing time. */
export function toConsultation(
  row: ConsultationRow,
  now = new Date(),
): Consultation {
  const today = now.toISOString().slice(0, 10);
  const sourceState =
    row.source_state === "current" && Date.parse(row.expires_at) <= now.getTime()
      ? "stale"
      : row.source_state;
  const participationStatus =
    row.kind === "directory"
      ? "directory"
      : sourceState !== "current"
        ? "check_official_source"
        : row.deadline_date && row.deadline_date < today
          ? "closed"
          : "open";
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    summary: row.summary,
    publisher: row.publisher,
    jurisdiction: {
      level: row.jurisdiction_level,
      code: row.jurisdiction_code,
      name: row.jurisdiction_name,
    },
    deadlineDate: row.deadline_date,
    officialUrl: row.official_url,
    evidenceUrl: row.evidence_url,
    sourceState,
    verifiedAt: row.verified_at,
    expiresAt: row.expires_at,
    lastError: row.last_error,
    participationStatus,
    externalOnly: true,
    inAppSubmission: false,
  };
}
