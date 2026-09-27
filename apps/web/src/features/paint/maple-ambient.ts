import "./maple-ambient.css";

const mapleLeaf =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M12 1.2 10.5 5.5 8.1 4.6l.5 3.1-3.5-.5 1.2 2.7-3 1.7 4.1 1.6-.6 2.4 4.5-1.1.1 7.3h1.2l.1-7.3 4.5 1.1-.6-2.4 4.1-1.6-3-1.7 1.2-2.7-3.5.5.5-3.1-2.4.9L12 1.2Z"/></svg>';

/** Adds a sparse, non-interactive decorative layer inside a page container. */
export function addMapleAmbient(page: HTMLElement): void {
  if (page.querySelector(":scope > .envoy-maple-ambient")) return;
  const layer = document.createElement("div");
  layer.className = "envoy-maple-ambient";
  layer.setAttribute("aria-hidden", "true");
  layer.innerHTML = Array.from(
    { length: 5 },
    () => `<span class="envoy-maple-leaf">${mapleLeaf}</span>`,
  ).join("");
  page.classList.add("has-maple-ambient");
  page.prepend(layer);
}
