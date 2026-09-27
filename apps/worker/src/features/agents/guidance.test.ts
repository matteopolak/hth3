import { expect, it } from "vitest";
import {
  capabilityAnswer,
  currentOttawaVacanciesAnswer,
  currentOttawaVacanciesTool,
  isCapabilityQuestion,
  relevantToolForMessage,
} from "./guidance.js";
import { prepareTool } from "./tools.js";

it("routes a specific Ottawa jobs question to bounded sourced discovery", () => {
  const selected = relevantToolForMessage(
    "Where can I find public-sector jobs in Ottawa?",
    { name: "list_source_records", args: {} },
  );
  expect(selected).toEqual({
    name: "search_discovery",
    args: { area: "jobs", location: "Ottawa", limit: 8 },
  });
  expect(
    prepareTool(selected!.name, selected!.args, "resident", null).path,
  ).toBe("/api/v1/discovery?area=jobs&location=Ottawa&limit=8");
  expect(
    relevantToolForMessage("List all source records", {
      name: "list_source_records",
      args: {},
    }),
  ).toEqual({ name: "list_source_records", args: {} });
});

it("finds current City of Ottawa roles and their closing dates without a model-selected tool", () => {
  const tool = currentOttawaVacanciesTool(
    "Find current City of Ottawa job postings and include closing dates.",
  );
  expect(tool).toEqual({
    name: "search_discovery",
    args: {
      area: "jobs",
      type: "job_posting",
      source: "city-ottawa-open-jobs",
      applicationStatus: "open",
      limit: 12,
    },
  });
  expect(prepareTool(tool!.name, tool!.args, "resident", null).path).toBe(
    "/api/v1/discovery?area=jobs&type=job_posting&source=city-ottawa-open-jobs&applicationStatus=open&limit=12",
  );
  expect(
    currentOttawaVacanciesAnswer(
      {
        total: 2,
        items: [
          { title: "Planner", listing: { closingDate: "2026-10-12" } },
          { title: "Inspector", listing: { closingDate: "2026-10-18" } },
        ],
      },
      "en",
    ),
  ).toContain("Planner (2026-10-12); Inspector (2026-10-18)");
  expect(
    currentOttawaVacanciesTool("Apply for a saved Ottawa role"),
  ).toBeUndefined();
  expect(
    currentOttawaVacanciesTool(
      "Trouver les offres d'emploi actuelles de la Ville d'Ottawa et leurs dates de clôture.",
    )?.args,
  ).toEqual(tool?.args);
});

it("answers capability questions in natural language within the caller's role", () => {
  expect(isCapabilityQuestion("What can you do? ")).toBe(true);
  expect(isCapabilityQuestion("What can you do to find jobs in Ottawa?")).toBe(
    false,
  );
  const resident = capabilityAnswer("resident", "en", null);
  const staff = capabilityAnswer("employee", "en", "org_123");
  const curator = capabilityAnswer("employee", "fr", null);
  expect(resident).toContain("jobs");
  expect(resident).not.toContain("staff");
  expect(staff).toContain("organization permissions");
  expect(curator).toContain("sources publiques");
  for (const answer of [resident, staff, curator])
    expect(answer).not.toMatch(/\b(?:list_|search_|staff_)[a-z_]+\b/);
});
