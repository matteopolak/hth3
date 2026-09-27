import type { Locale } from "@civicresolve/contracts/v1";
import { translate } from "@civicresolve/i18n";
import type { WebAuthSnapshot } from "./auth0.js";

/** Compact account identity used in the signed-in rail and phone drawer. */
export function createSidebarAccount(
  auth: WebAuthSnapshot,
  locale: Locale,
): HTMLElement {
  const name = auth.displayName ?? translate(locale, "auth.account");
  const role = translate(
    locale,
    auth.mode === "employee" ? "auth.staff" : "auth.personal",
  );
  const account = element("div", "sidebar-account");
  account.setAttribute("role", "group");
  account.setAttribute(
    "aria-label",
    `${translate(locale, "auth.account")}: ${name.includes("@") ? (auth.email ?? name) : [name, auth.email].filter(Boolean).join(", ")}`,
  );
  account.title = auth.email ?? name;

  const avatarName = name.includes("@") ? name.split("@")[0]! : name;
  const parts = avatarName
    .replace(/[._-]+/g, " ")
    .trim()
    .split(/\s+/);
  const initials = [parts[0]?.[0], parts.length > 1 ? parts.at(-1)?.[0] : ""]
    .filter(Boolean)
    .join("")
    .toLocaleUpperCase(locale);
  const avatar = element("span", "sidebar-account-avatar", initials || "E");
  avatar.setAttribute("aria-hidden", "true");
  if (auth.pictureUrl) {
    const picture = element("img", "sidebar-account-picture");
    picture.src = auth.pictureUrl;
    picture.alt = "";
    picture.loading = "lazy";
    picture.decoding = "async";
    picture.referrerPolicy = "no-referrer";
    picture.addEventListener("error", () => picture.remove());
    avatar.append(picture);
  }

  const details = element("span", "sidebar-account-details");
  details.append(
    element("strong", "sidebar-account-name", name),
    element(
      "small",
      "sidebar-account-secondary",
      auth.email && !name.includes("@") ? auth.email : role,
    ),
  );
  account.append(avatar, details);
  return account;
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
