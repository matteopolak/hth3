import { expect, it } from "vitest";
import {
  capabilityAnswer,
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
