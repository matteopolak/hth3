import "./styles.css";

// Small, local filled symbols for destination icons. Utility controls keep Lucide.
const shapes: Record<string, string> = {
  chat: '<path d="M5 3h14a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-8l-5.7 3.4A1 1 0 0 1 3 20.5V6a3 3 0 0 1 2-3Z"/><circle cx="8" cy="10.5" r="1.2" fill="white"/><circle cx="12" cy="10.5" r="1.2" fill="white"/><circle cx="16" cy="10.5" r="1.2" fill="white"/>',
  briefcase:
    '<path d="M9 3h6a2 2 0 0 1 2 2v2h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3V5a2 2 0 0 1 2-2Zm0 4h6V5H9v2Z" fill-rule="evenodd"/><path d="M2 12h20v2H2z" fill="white" opacity=".65"/>',
  support:
    '<path d="M12 21.2 3.8 13A5.7 5.7 0 0 1 12 5.1 5.7 5.7 0 0 1 20.2 13L12 21.2Z"/>',
  funding:
    '<ellipse cx="10" cy="6" rx="7" ry="3"/><path d="M3 6v8c0 1.7 3.1 3 7 3 3.9 0 7-1.3 7-3V6c0 1.7-3.1 3-7 3-3.9 0-7-1.3-7-3Z"/><path d="M18 9c2.4.4 4 1.4 4 2.7V18c0 1.6-2.5 2.8-6 3-2.3.1-4.4-.5-5.4-1.5 4.6-.1 7.4-1.8 7.4-4V9Z"/>',
  landmark:
    '<path d="m12 2 10 5v2H2V7L12 2ZM3 19h18v3H3v-3ZM4 10h3v8H4v-8Zm6 0h4v8h-4v-8Zm7 0h3v8h-3v-8Z"/>',
  map: '<path d="M12 2a8 8 0 0 0-8 8c0 5.2 8 12 8 12s8-6.8 8-12a8 8 0 0 0-8-8Zm0 11.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4Z" fill-rule="evenodd"/>',
  participation:
    '<path d="M4 4h11a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H9l-5 3v-3a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"/><path d="M18 7h2a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3v2l-4-2h-4v-2h3a5 5 0 0 0 5-5v-3a5 5 0 0 0-2-3Z" opacity=".65"/>',
  feedback:
    '<path d="M5 2h10l5 5v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm9 1v5h5" fill-rule="evenodd"/><path d="M7 12h10v1.5H7zm0 4h8v1.5H7z" fill="white"/>',
  clipboard:
    '<path d="M9 2h6a2 2 0 0 1 2 2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2-2Zm0 3v2h6V5H9Z" fill-rule="evenodd"/><path d="M7 11h10v1.5H7zm0 4h8v1.5H7z" fill="white"/>',
  files:
    '<path d="M7 2h10l4 4v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path d="M3 6v15a2 2 0 0 0 2 2h11v-2H7a2 2 0 0 1-2-2V6H3Z" opacity=".6"/><path d="M10 11h7v1.5h-7zm0 4h7v1.5h-7z" fill="white"/>',
  bookmark: '<path d="M6 2h12a2 2 0 0 1 2 2v18l-8-5-8 5V4a2 2 0 0 1 2-2Z"/>',
  user: '<circle cx="12" cy="7.5" r="4.5"/><path d="M3 21a9 9 0 0 1 18 0v1H3v-1Z"/>',
  users:
    '<circle cx="9" cy="8" r="4"/><path d="M1.5 21a7.5 7.5 0 0 1 15 0v1h-15v-1ZM17 4a3.5 3.5 0 0 1 0 7 3.5 3.5 0 0 1 0-7Zm1 9a6 6 0 0 1 5 9h-4.5a9.5 9.5 0 0 0-3.1-7.7A6 6 0 0 1 18 13Z"/>',
  inbox:
    '<path d="M5 3h14l3 10v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7L5 3Zm1.5 3L4 14h4l1 2h6l1-2h4l-2.5-8h-11Z" fill-rule="evenodd"/>',
  dashboard:
    '<rect x="2" y="2" width="9" height="9" rx="2"/><rect x="13" y="2" width="9" height="6" rx="2"/><rect x="2" y="13" width="9" height="9" rx="2"/><rect x="13" y="10" width="9" height="12" rx="2"/>',
  chart:
    '<rect x="2" y="13" width="5" height="9" rx="1"/><rect x="9.5" y="8" width="5" height="14" rx="1"/><rect x="17" y="3" width="5" height="19" rx="1"/>',
  tags: '<path d="M2 4a2 2 0 0 1 2-2h8l10 10a2 2 0 0 1 0 2.8L14.8 22a2 2 0 0 1-2.8 0L2 12V4Zm5.5 2A1.5 1.5 0 1 0 7.5 9a1.5 1.5 0 0 0 0-3Z" fill-rule="evenodd"/>',
  taxonomy:
    '<rect x="2" y="2" width="7" height="5" rx="1"/><rect x="15" y="9" width="7" height="5" rx="1"/><rect x="15" y="17" width="7" height="5" rx="1"/><path d="M10 4h3v15h2v2h-4V6h-1V4Z"/>',
  activity:
    '<path d="M2 13h4l3-7 4 12 3-6 2 1h4v3h-5l-2-1-2.5 6-4-11-2 5H2v-2Z"/>',
  building:
    '<path d="M4 2h12a2 2 0 0 1 2 2v18H2V4a2 2 0 0 1 2-2Zm16 7h2v13h-2V9Z"/><path d="M6 5h3v3H6zm5 0h3v3h-3zM6 10h3v3H6zm5 0h3v3h-3zM6 15h3v3H6zm5 0h3v3h-3z" fill="white"/>',
};

const aliases: Record<string, string> = {
  assistant: "chat",
  jobs: "briefcase",
  applications: "clipboard",
  programs: "landmark",
  nearby: "map",
  saved: "bookmark",
  profile: "user",
  sources: "files",
  staff: "dashboard",
};

/** Returns filled SVG markup for destination icons, or null for utility icons. */
export function solidNavIcon(kind: string): string | null {
  const name = aliases[kind] ?? kind;
  const shape = shapes[name];
  if (!shape) return null;
  return `<svg class="envoy-solid-icon envoy-solid-icon--${name}" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" focusable="false">${shape}</svg>`;
}
