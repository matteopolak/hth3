export * from "./document-text.js";

export const PROFILE_FIELDS = [
  "name",
  "email",
  "phone",
  "location",
  "summary",
  "skills",
  "education",
  "experience",
] as const;

export interface ApplicantProfile {
  name: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  skills: string[];
  education: EducationEntry[];
  experience: ExperienceEntry[];
}

export interface EducationEntry {
  institution: string;
  credential: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface ExperienceEntry {
  organization: string;
  title: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface ResumeSourceSpan {
  start: number;
  end: number;
  text: string;
}

export interface ResumeSuggestion {
  field: (typeof PROFILE_FIELDS)[number];
  value: string | string[];
  source: ResumeSourceSpan;
}

export interface ResumeExtraction {
  text: string;
  suggestions: ResumeSuggestion[];
  suggestionsTruncated: boolean;
}

export const EMPTY_APPLICANT_PROFILE: ApplicantProfile = {
  name: "",
  email: "",
  phone: "",
  location: "",
  summary: "",
  skills: [],
  education: [],
  experience: [],
};

const SECTION_HEADINGS = new Map<string, ResumeSuggestion["field"]>([
  ["education", "education"],
  ["academic background", "education"],
  ["experience", "experience"],
  ["work experience", "experience"],
  ["professional experience", "experience"],
  ["employment", "experience"],
  ["skills", "skills"],
  ["technical skills", "skills"],
  ["core skills", "skills"],
]);

export function validateApplicantProfile(
  value: unknown,
): ApplicantProfile | null {
  if (!isRecord(value)) return null;
  const allowed = new Set<string>(Object.keys(EMPTY_APPLICANT_PROFILE));
  if (Object.keys(value).some((key) => !allowed.has(key))) return null;

  const name = boundedText(value.name, 160);
  const email = boundedText(value.email, 254);
  const phone = boundedText(value.phone, 80);
  const location = boundedText(value.location, 180);
  const summary = boundedText(value.summary, 4_000);
  const skills = boundedList(value.skills, 40, 120);
  const education = boundedEntries<EducationEntry>(value.education, {
    institution: 180,
    credential: 180,
    fieldOfStudy: 180,
    startDate: 40,
    endDate: 40,
    description: 1_000,
  });
  const experience = boundedEntries<ExperienceEntry>(value.experience, {
    organization: 180,
    title: 180,
    startDate: 40,
    endDate: 40,
    description: 1_000,
  });

  if (
    name === null ||
    email === null ||
    phone === null ||
    location === null ||
    summary === null ||
    skills === null ||
    education === null ||
    experience === null
  )
    return null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;

  return {
    name,
    email,
    phone,
    location,
    summary,
    skills,
    education,
    experience,
  };
}

/**
 * Suggests only literal resume text under explicit, user-authored section labels.
 * Each returned value points back to the exact range of text that supplied it.
 */
export function suggestResumeFields(
  input: string,
  maxSuggestions = Number.POSITIVE_INFINITY,
): ResumeSuggestion[] {
  const text = normalizeResumeText(input);
  const lines = lineRanges(text);
  const suggestions: ResumeSuggestion[] = [];
  let activeSection: ResumeSuggestion["field"] | null = null;
  const maximum = Math.max(0, Math.floor(maxSuggestions));

  suggestionLines: for (const line of lines) {
    if (suggestions.length >= maximum) break;
    const trimmed = line.text.trim();
    if (!trimmed) continue;
    const heading = normalizedHeading(trimmed);
    if (
      heading === "summary" ||
      heading === "objective" ||
      heading === "profile"
    ) {
      activeSection = "summary";
      continue;
    }
    const section = SECTION_HEADINGS.get(heading);
    if (section) {
      activeSection = section;
      continue;
    }
    if (
      /^[A-Z][A-Z\s/&-]{1,38}:?$/.test(trimmed) &&
      trimmed === trimmed.toUpperCase()
    ) {
      activeSection = null;
    }

    const explicit =
      /^(name|email|e-mail|phone|telephone|location|city|summary|objective|profile)\s*:\s*(.+)$/i.exec(
        trimmed,
      );
    if (explicit) {
      const key = explicit[1]!.toLowerCase();
      const field: ResumeSuggestion["field"] =
        key === "name"
          ? "name"
          : key === "email" || key === "e-mail"
            ? "email"
            : key === "phone" || key === "telephone"
              ? "phone"
              : key === "location" || key === "city"
                ? "location"
                : "summary";
      const valueOffset = line.text.indexOf(explicit[2]!);
      pushSuggestion(
        suggestions,
        field,
        explicit[2]!,
        text,
        line.start + valueOffset,
        line.start + valueOffset + explicit[2]!.length,
      );
      if (suggestions.length >= maximum) break;
      continue;
    }

    const emailMatch =
      /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+/i.exec(
        trimmed,
      );
    if (emailMatch) {
      const offset = line.text.indexOf(emailMatch[0]);
      pushSuggestion(
        suggestions,
        "email",
        emailMatch[0],
        text,
        line.start + offset,
        line.start + offset + emailMatch[0].length,
      );
    }
    const phoneMatch = /(?:\+?\d[\d ()./-]{7,}\d)/.exec(trimmed);
    if (phoneMatch) {
      const value = phoneMatch[0].trim();
      const offset = line.start + line.text.indexOf(value);
      pushSuggestion(
        suggestions,
        "phone",
        value,
        text,
        offset,
        offset + value.length,
      );
    }
    if (suggestions.length >= maximum) break;

    if (!activeSection) continue;
    const content = cleanSectionLine(trimmed);
    if (!content) continue;
    const offset = line.start + line.text.indexOf(content);
    if (activeSection === "skills") {
      for (const item of content
        .split(/[,;|•]/)
        .map((part) => part.trim())
        .filter(Boolean)) {
        const itemOffset =
          line.start +
          line.text.indexOf(item, Math.max(0, line.text.indexOf(content)));
        pushSuggestion(
          suggestions,
          "skills",
          item,
          text,
          itemOffset,
          itemOffset + item.length,
        );
        if (suggestions.length >= maximum) break suggestionLines;
      }
    } else if (activeSection === "summary") {
      pushSuggestion(
        suggestions,
        "summary",
        content,
        text,
        offset,
        offset + content.length,
      );
    } else {
      pushSuggestion(
        suggestions,
        activeSection,
        content,
        text,
        offset,
        offset + content.length,
      );
    }
    if (suggestions.length >= maximum) break;
  }

  return deduplicateSuggestions(suggestions).slice(0, maximum);
}

export function normalizeResumeText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .join("\n")
    .trim();
}

function lineRanges(text: string): Array<{ text: string; start: number }> {
  const result: Array<{ text: string; start: number }> = [];
  let start = 0;
  for (const line of text.split("\n")) {
    result.push({ text: line, start });
    start += line.length + 1;
  }
  return result;
}

function normalizedHeading(value: string): string {
  return value
    .replace(/[:\s]+$/, "")
    .trim()
    .toLowerCase();
}

function cleanSectionLine(value: string): string {
  return value.replace(/^[•*\-–—\s]+/, "").replace(/[\s•]+$/, "");
}

function pushSuggestion(
  into: ResumeSuggestion[],
  field: ResumeSuggestion["field"],
  value: string,
  text: string,
  start: number,
  end: number,
): void {
  if (!value.trim() || start < 0 || end <= start) return;
  into.push({
    field,
    value: value.trim(),
    source: { start, end, text: text.slice(start, end) },
  });
}

function deduplicateSuggestions(items: ResumeSuggestion[]): ResumeSuggestion[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.field}:${item.source.start}:${item.source.end}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function boundedText(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length <= maximum ? trimmed : null;
}

function boundedList(
  value: unknown,
  count: number,
  itemLength: number,
): string[] | null {
  if (!Array.isArray(value) || value.length > count) return null;
  const list: string[] = [];
  for (const item of value) {
    const text = boundedText(item, itemLength);
    if (text === null) return null;
    if (text) list.push(text);
  }
  return list;
}

function boundedEntries<T extends object>(
  value: unknown,
  fields: Record<keyof T & string, number>,
): T[] | null {
  if (!Array.isArray(value) || value.length > 20) return null;
  const entries: T[] = [];
  for (const item of value) {
    if (!isRecord(item) || Object.keys(item).some((key) => !(key in fields)))
      return null;
    const entry: Record<string, string> = {};
    for (const field of Object.keys(fields) as (keyof T & string)[]) {
      const max = fields[field];
      const text = boundedText(item[field] ?? "", max);
      if (text === null) return null;
      entry[field] = text;
    }
    entries.push(entry as T);
  }
  return entries;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
