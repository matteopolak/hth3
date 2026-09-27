import { expect, it } from "vitest";
import {
  capabilityAnswer,
  currentJobPostingsAnswer,
  currentJobPostingsTool,
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
  const tool = currentJobPostingsTool(
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
    currentJobPostingsAnswer(
      {
        total: 2,
        items: [
          { title: "Planner", listing: { closingDate: "2026-10-12" } },
          { title: "Inspector", listing: { closingDate: "2026-10-18" } },
        ],
      },
      "en",
      tool!.args,
    ),
  ).toContain("- Planner — closes 2026-10-12\n- Inspector — closes 2026-10-18");
  expect(
    currentJobPostingsTool("Apply for a saved Ottawa role"),
  ).toBeUndefined();
  expect(
    currentJobPostingsTool(
      "Trouver les offres d'emploi actuelles de la Ville d'Ottawa et leurs dates de clôture.",
    )?.args,
  ).toEqual(tool?.args);
});

it("lists every returned vacancy and deadline in the grounded reply", () => {
  const items = Array.from({ length: 10 }, (_, index) => ({
    title: `Role ${index + 1}`,
    listing: { closingDate: `2026-10-${String(index + 10).padStart(2, "0")}` },
  }));
  const answer = currentJobPostingsAnswer({ items, total: 10 }, "en", {
    source: "city-ottawa-open-jobs",
  });
  for (let index = 0; index < 10; index++)
    expect(answer).toContain(
      `- Role ${index + 1} — closes 2026-10-${String(index + 10).padStart(2, "0")}`,
    );
  expect(answer).not.toContain("below");
  expect(
    currentJobPostingsAnswer({ items: items.slice(0, 2), total: 10 }, "en", {}),
  ).toContain("Showing 2 of 10:");
});

it("grounds generic and Toronto or BC current-job requests in individual postings", () => {
  const cases = [
    {
      query: "Show current government jobs",
      path: "/api/v1/discovery?area=jobs&type=job_posting&applicationStatus=open&limit=12",
    },
    {
      query: "Find open jobs in Toronto",
      path: "/api/v1/discovery?area=jobs&type=job_posting&location=Toronto&applicationStatus=open&limit=12",
    },
    {
      query: "Find current City of Toronto vacancies",
      path: "/api/v1/discovery?area=jobs&type=job_posting&source=city-toronto-open-jobs&applicationStatus=open&limit=12",
    },
    {
      query: "Show current jobs in BC",
      path: "/api/v1/discovery?area=jobs&type=job_posting&location=British+Columbia&applicationStatus=open&limit=12",
    },
    {
      query: "List open BC Public Service jobs",
      path: "/api/v1/discovery?area=jobs&type=job_posting&source=bc-public-service-vacancies&applicationStatus=open&limit=12",
    },
  ];
  for (const { query, path } of cases) {
    const tool = currentJobPostingsTool(query);
    expect(tool, query).toBeDefined();
    expect(prepareTool(tool!.name, tool!.args, "resident", null).path).toBe(
      path,
    );
  }
  expect(currentJobPostingsAnswer({ items: [], total: 0 }, "en", {})).toContain(
    "no matching open job postings",
  );
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
