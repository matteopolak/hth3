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
  participationStatus:
    | "open"
    | "closed"
    | "directory"
    | "check_official_source";
  externalOnly: true;
  inAppSubmission: false;
}

/** Date-only deadlines remain date-only; unknown cut-off times go to the publisher. */
export function toConsultation(
  row: ConsultationRow,
  now = new Date(),
): Consultation {
  const sourceState =
    row.source_state === "current" &&
    Date.parse(row.expires_at) <= now.getTime()
      ? "stale"
      : row.source_state;
  const participationStatus =
    row.kind === "directory"
      ? "directory"
      : sourceState !== "current"
        ? "check_official_source"
        : deadlineStatus(row, now);
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

function deadlineStatus(
  row: ConsultationRow,
  now: Date,
): "open" | "closed" | "check_official_source" {
  const deadline = row.deadline_date;
  if (!deadline || !isValidDateOnly(deadline)) return "check_official_source";

  const timeZone =
    row.jurisdiction_code === "CA-BC"
      ? "America/Vancouver"
      : row.jurisdiction_code === "CA-ON"
        ? "America/Toronto"
        : "America/St_Johns";
  const today = dateInTimeZone(now, timeZone);

  if (deadline > today) return "open";
  // The publisher's cutoff time is not stored. Do not claim open or closed on
  // the deadline date; federal opportunities also span multiple time zones.
  if (deadline === today || row.jurisdiction_code === "CA")
    return "check_official_source";
  return "closed";
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function dateInTimeZone(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}
