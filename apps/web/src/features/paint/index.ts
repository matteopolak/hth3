import { tokens } from "@civicresolve/design-tokens";
import "./styles.css";

export type PaintTone = keyof typeof tokens.color.paint;

/** A solid status glyph for places where the icon needs to carry meaning. */
export const filledCheckIcon =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="m7.5 12.2 3 3 6-6.2" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** Celebrate a confirmed write after the server responds, never on a pending click. */
export function playPaintSplash(
  anchor: Element | DOMRect,
  tone: PaintTone = "blue",
): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const bounds =
    anchor instanceof Element ? anchor.getBoundingClientRect() : anchor;
  const mark = document.createElement("span");
  mark.className = "envoy-paint-splash";
  mark.setAttribute("aria-hidden", "true");
  mark.style.left = `${bounds.left + bounds.width / 2}px`;
  mark.style.top = `${bounds.top + bounds.height / 2}px`;
  mark.style.setProperty("--paint-color", tokens.color.paint[tone]);
  mark.innerHTML = "<i></i><i></i><i></i><i></i><i></i>";
  document.body.append(mark);
  window.setTimeout(() => mark.remove(), 850);
}
