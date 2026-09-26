import type { Locale } from "@civicresolve/contracts/v1";
import {
  ArrowRight,
  BriefcaseBusiness,
  FileCheck2,
  HandHeart,
  MapPin,
  Search,
  Wallet,
} from "lucide-static";
import "./area-structures.css";

export type StructuredDiscoveryArea = "jobs" | "support" | "funding";

export interface DiscoveryAreaStructureOptions {
  area: StructuredDiscoveryArea;
  locale: Locale;
  onBrowse: () => void;
  onSearchLocation: (location: string) => void;
}

const copy = {
  en: {
    jobs: {
      heading: "Find your next role",
      body: "Browse reviewed job finders, then check current openings with the publisher.",
      browse: "Browse job sources",
      region: "Search sources by region",
    },
    support: {
      heading: "Find support where you live",
      body: "Choose a jurisdiction to find official benefits and program sources.",
      region: "Choose a jurisdiction",
      browse: "Browse all support sources",
    },
    funding: {
      heading: "Find funding and prepare",
      browse: "Browse funding sources",
      region: "Narrow by jurisdiction",
      steps: [
        ["Find a source", "Browse reviewed funding finders."],
        [
          "Check the terms",
          "Confirm eligibility and deadlines on the official site.",
        ],
        [
          "Prepare your application",
          "Keep notes and continue with the publisher.",
        ],
      ],
    },
    regions: [
      ["All regions", ""],
      ["Federal", "CA"],
      ["Ontario", "Ontario"],
      ["British Columbia", "British Columbia"],
    ],
    choose: "Browse sources for",
  },
  fr: {
    jobs: {
      heading: "Trouvez votre prochain emploi",
      body: "Parcourez les sources d'emplois examinées, puis vérifiez les offres auprès de l'éditeur.",
      browse: "Parcourir les sources d'emplois",
      region: "Chercher des sources par région",
    },
    support: {
      heading: "Trouvez de l'aide près de chez vous",
      body: "Choisissez un territoire pour trouver les sources officielles de prestations et de programmes.",
      region: "Choisir un territoire",
      browse: "Parcourir toutes les sources d'aide",
    },
    funding: {
      heading: "Trouvez du financement et préparez-vous",
      browse: "Parcourir les sources de financement",
      region: "Préciser par territoire",
      steps: [
        [
          "Trouver une source",
          "Parcourez les sources de financement examinées.",
        ],
        [
          "Vérifier les critères",
          "Confirmez l'admissibilité et les dates sur le site officiel.",
        ],
        [
          "Préparer la demande",
          "Conservez vos notes et poursuivez auprès de l'éditeur.",
        ],
      ],
    },
    regions: [
      ["Toutes les régions", ""],
      ["Fédéral", "CA"],
      ["Ontario", "Ontario"],
      ["Colombie-Britannique", "British Columbia"],
    ],
    choose: "Parcourir les sources pour",
  },
} as const;

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  label?: string,
): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag);
  result.className = className;
  if (label) result.textContent = label;
  return result;
}

function icon(svg: string): HTMLElement {
  const span = element("span", "discovery-structure-icon");
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = svg;
  return span;
}

function button(
  label: string,
  className: string,
  onClick: () => void,
): HTMLButtonElement {
  const result = element("button", className, label);
  result.type = "button";
  result.addEventListener("click", onClick);
  return result;
}

function regionButtons(
  locale: Locale,
  onSearchLocation: (location: string) => void,
  className: string,
  groupLabel: string,
): HTMLElement {
  const group = element("div", className);
  const text = copy[locale];
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", groupLabel);
  for (const [label, location] of text.regions) {
    const region = button(label, "discovery-structure-region", () =>
      onSearchLocation(location),
    );
    region.setAttribute("aria-label", `${text.choose} ${label}`);
    group.append(region);
  }
  return group;
}

export function createDiscoveryAreaStructure({
  area,
  locale,
  onBrowse,
  onSearchLocation,
}: DiscoveryAreaStructureOptions): HTMLElement {
  const text = copy[locale];
  const section = element(
    "section",
    `discovery-structure discovery-structure-${area}`,
  );

  if (area === "jobs") {
    const intro = element("div", "discovery-structure-jobs-intro");
    intro.append(icon(BriefcaseBusiness));
    const words = element("div", "discovery-structure-jobs-words");
    words.append(
      element("h2", "", text.jobs.heading),
      element("p", "", text.jobs.body),
    );
    intro.append(words);
    const browse = button(
      text.jobs.browse,
      "discovery-structure-primary",
      onBrowse,
    );
    browse.append(icon(ArrowRight));
    section.append(intro, browse);
    const regions = element("div", "discovery-structure-jobs-regions");
    regions.append(
      element("span", "discovery-structure-overline", text.jobs.region),
      regionButtons(
        locale,
        onSearchLocation,
        "discovery-structure-region-list",
        text.jobs.region,
      ),
    );
    section.append(regions);
  } else if (area === "support") {
    const intro = element("div", "discovery-structure-support-intro");
    intro.append(icon(HandHeart));
    const words = element("div", "discovery-structure-support-words");
    words.append(
      element("h2", "", text.support.heading),
      element("p", "", text.support.body),
    );
    intro.append(words);
    section.append(intro);
    section.append(
      element("h3", "discovery-structure-overline", text.support.region),
    );
    const regions = regionButtons(
      locale,
      onSearchLocation,
      "discovery-structure-support-regions",
      text.support.region,
    );
    for (const region of regions.children) {
      region.prepend(icon(MapPin));
      region.append(icon(ArrowRight));
    }
    section.append(regions);
    const browse = button(
      text.support.browse,
      "discovery-structure-text-action",
      () => onSearchLocation(""),
    );
    browse.append(icon(ArrowRight));
    section.append(browse);
  } else {
    const top = element("div", "discovery-structure-funding-top");
    const heading = element("div", "discovery-structure-funding-heading");
    heading.append(icon(Wallet), element("h2", "", text.funding.heading));
    const browse = button(
      text.funding.browse,
      "discovery-structure-primary",
      onBrowse,
    );
    browse.append(icon(ArrowRight));
    top.append(heading, browse);
    section.append(top);
    const steps = element("ol", "discovery-structure-funding-steps");
    const stepIcons = [Search, FileCheck2, Wallet];
    for (const [index, [headingText, detail]] of text.funding.steps.entries()) {
      const item = element("li", "discovery-structure-funding-step");
      item.append(icon(stepIcons[index] ?? Search));
      const words = element("div", "");
      words.append(
        element("strong", "", headingText),
        element("span", "", detail),
      );
      item.append(words);
      steps.append(item);
    }
    section.append(steps);
    const regions = element("div", "discovery-structure-funding-regions");
    regions.append(
      element("span", "discovery-structure-overline", text.funding.region),
      regionButtons(
        locale,
        onSearchLocation,
        "discovery-structure-region-list",
        text.funding.region,
      ),
    );
    section.append(regions);
  }

  return section;
}
