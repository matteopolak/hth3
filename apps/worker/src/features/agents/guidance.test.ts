import { expect, it } from "vitest";
import {
  capabilityAnswer,
  currentJobPostingsAnswer,
  currentJobPostingsTool,
  isCapabilityQuestion,
  publicOpportunityAnswer,
  publicOpportunityTool,
  publicProgramResult,
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

it("grounds support, funding, and Envoy program questions in read-only APIs", () => {
  const support = publicOpportunityTool(
    "What official support programs in Ontario could help someone retrain for work? Show the source and how to continue.",
  );
  expect(support).toEqual({
    name: "search_discovery",
    args: { area: "support", location: "Ontario", q: "training", limit: 12 },
  });
  expect(prepareTool(support!.name, support!.args, "resident", null).path).toBe(
    "/api/v1/discovery?area=support&location=Ontario&q=training&limit=12",
  );
  const funding = publicOpportunityTool(
    "What student grants are available in British Columbia? Show official sources and where the application happens.",
  );
  expect(prepareTool(funding!.name, funding!.args, "resident", null).path).toBe(
    "/api/v1/discovery?area=funding&location=British+Columbia&limit=12",
  );
  const answer = publicOpportunityAnswer(
    {
      items: [
        {
          title: "Better Jobs Ontario",
          publisher: "Government of Ontario",
          summary: "Explore training support.",
          handoff: { url: "https://www.ontario.ca/page/better-jobs-ontario" },
        },
      ],
    },
    "en",
    support!,
  );
  expect(answer).toContain(
    "[Better Jobs Ontario](https://www.ontario.ca/page/better-jobs-ontario)",
  );
  expect(answer).toContain("I found 1 support program from official sources.");
  expect(answer).toContain("continue on the publisher's site");
  const programs = publicOpportunityTool(
    "Which programs can I apply to through Envoy? Please distinguish practice programs from official programs.",
  );
  expect(
    prepareTool(programs!.name, programs!.args, "resident", null).path,
  ).toBe("/api/v1/programs");
  const filtered = publicProgramResult("list_programs", {
    status: 200,
    data: {
      programs: [
        {
          id: "sample-intake",
          title: "Community support intake",
          sample: true,
        },
        { id: "official-intake", title: "Official intake", sample: false },
      ],
    },
  });
  expect(filtered.data).toEqual({
    programs: [
      { id: "official-intake", title: "Official intake", sample: false },
    ],
  });
  expect(
    publicProgramResult("read_program", {
      status: 200,
      data: { program: { title: "Community support intake", sample: true } },
    }),
  ).toEqual({ status: 404, data: { error: { code: "PROGRAM_NOT_FOUND" } } });
  const guestAnswer = publicOpportunityAnswer(
    { programs: [{ title: "Community support intake", sample: true }] },
    "en",
    programs!,
  );
  expect(guestAnswer).toContain("No direct-intake programs");
  expect(guestAnswer).not.toContain("Community support intake");
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
