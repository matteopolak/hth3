import type { Locale } from "@civicresolve/contracts/v1";
import DOMPurify from "dompurify";
import { Marked } from "marked";
import { ChevronDown } from "lucide-static";
import "./styles.css";

type SourceRecord = Record<string, unknown>;

const markdown = new Marked({
  async: false,
  gfm: true,
  breaks: true,
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
  },
});

const markdownTags = [
  "a",
  "blockquote",
  "br",
  "code",
  "del",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
];

export function assistantMarkdown(content: string): HTMLElement {
  const container = element("div", "chat-rich-markdown");
  try {
    const rendered = markdown.parse(content, { async: false }) as string;
    const clean = DOMPurify.sanitize(rendered, {
      ALLOWED_TAGS: markdownTags,
      ALLOWED_ATTR: ["href", "title"],
      ALLOW_DATA_ATTR: false,
      RETURN_DOM_FRAGMENT: true,
    });
    for (const link of clean.querySelectorAll("a")) {
      const href = safeHttpUrl(link.getAttribute("href"));
      if (!href) {
        link.replaceWith(document.createTextNode(link.textContent ?? ""));
        continue;
      }
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    container.append(clean);
  } catch {
    container.textContent = content;
  }
  return container;
}

export function sourceAttribution(
  value: unknown,
  locale: Locale,
): HTMLElement | null {
  const envelope = record(parse(value));
  if (
    !envelope ||
    (typeof envelope.status === "number" && envelope.status >= 400)
  )
    return null;
  const data = record(envelope.data) ?? envelope;
  const raw = data.sources ?? data.records ?? data.items ?? data.source;
  const entries = (Array.isArray(raw) ? raw : raw ? [raw] : [])
    .map(record)
    .filter((item): item is SourceRecord => item !== null);
  if (
    !entries.length ||
    !entries.some((item) =>
      Boolean(item.sourceUrl || item.evidenceUrl || item.publisher),
    )
  )
    return null;

  const details = element("details", "chat-rich-sources");
  const summary = element("summary", "chat-rich-sources-summary");
  summary.append(
    element(
      "span",
      "chat-rich-sources-label",
      locale === "fr"
        ? `Selon ${entries.length} source${entries.length === 1 ? "" : "s"}`
        : `From ${entries.length} source${entries.length === 1 ? "" : "s"}`,
    ),
  );
  const favicons = element("span", "chat-rich-favicons");
  favicons.setAttribute("aria-hidden", "true");
  const shownPublishers = new Set<string>();
  for (const item of entries) {
    const sourceUrl = safeHttpUrl(item.sourceUrl ?? item.evidenceUrl);
    const publisher = sourceUrl
      ? new URL(sourceUrl).hostname.replace(/^www\./, "")
      : (string(item.publisher) ?? sourceTitle(item)).toLocaleLowerCase();
    if (shownPublishers.has(publisher)) continue;
    shownPublishers.add(publisher);
    favicons.append(sourceFavicon(item, shownPublishers.size - 1));
    if (shownPublishers.size === 5) break;
  }
  summary.append(favicons);
  const chevron = element("span", "chat-rich-sources-chevron");
  chevron.setAttribute("aria-hidden", "true");
  chevron.innerHTML = ChevronDown;
  summary.append(chevron);
  details.append(summary);

  const list = element("ol", "chat-rich-source-list");
  for (const item of entries) {
    const entry = element("li", "chat-rich-source-item");
    const title = sourceTitle(item);
    const url = safeHttpUrl(item.sourceUrl ?? item.evidenceUrl);
    if (url && item.origin !== "sample" && item.sample !== true) {
      const link = element("a", "", title);
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      entry.append(link);
    } else entry.append(element("span", "", title));
    const publisher = string(item.publisher);
    if (publisher && publisher !== title)
      entry.append(element("small", "", publisher));
    if (item.origin === "sample" || item.sample === true)
      entry.append(
        element(
          "small",
          "chat-rich-source-sample",
          locale === "fr" ? "Dossier d’exercice" : "Practice record",
        ),
      );
    list.append(entry);
  }
  details.append(list);
  const total = Number(data.total);
  if (Number.isFinite(total) && total > entries.length)
    details.append(
      element(
        "p",
        "chat-rich-source-partial",
        locale === "fr"
          ? `${entries.length} sur ${total} sources affichées`
          : `Showing ${entries.length} of ${total} sources`,
      ),
    );
  return details;
}

function sourceFavicon(item: SourceRecord, position: number): HTMLElement {
  const publisher = string(item.publisher) ?? sourceTitle(item);
  const words = publisher.match(/[\p{L}\p{N}]+/gu) ?? [];
  const initials =
    words.length > 1
      ? `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`
      : (words[0]?.slice(0, 2) ?? "S");
  const fallback = element(
    "span",
    "chat-rich-favicon-fallback",
    initials.toLocaleUpperCase(),
  );
  const circle = element("span", `chat-rich-favicon chat-rich-favicon-${position % 5}`);
  circle.append(fallback);
  return circle;
}

function sourceTitle(item: SourceRecord): string {
  return (
    string(item.title) ??
    string(item.name) ??
    string(item.publisher) ??
    "Source"
  );
}

function safeHttpUrl(value: unknown): string | null {
  const raw = string(value);
  if (!raw) return null;
  try {
    const url = new URL(raw, window.location.origin);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const escaped: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return escaped[character] ?? character;
  });
}

function parse(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function record(value: unknown): SourceRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as SourceRecord)
    : null;
}

function string(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
