import en from "./en.js";
import fr from "./fr.js";
import type { Locale } from "@civicresolve/contracts/v1";

export type MessageKey = keyof typeof en;
export type MessageValues = Record<string, string | number>;
export type Catalogue = { [Key in MessageKey]: string };

const catalogues: Record<Locale, Catalogue> = { en, fr };

export function translate(
  locale: Locale,
  key: MessageKey,
  values: MessageValues = {},
): string {
  const template = catalogues[locale][key];
  return template.replace(
    /\{([a-zA-Z][a-zA-Z0-9]*)\}/g,
    (placeholder, name: string) => {
      const value = values[name];
      return value === undefined ? placeholder : String(value);
    },
  );
}

export function getCatalogue(locale: Locale): Catalogue {
  return catalogues[locale];
}

export { en, fr };
