import { describe, expect, it } from "vitest";
import {
  canPublishTaxonomy,
  canTransition,
  fixtureClassify,
  requiresReview,
} from "./index";
import { taxonomy } from "@civicresolve/fixtures";

describe("case rules", () => {
  it("prevents skipping review and reopening closed cases", () => {
    expect(canTransition("needs_review", "resolved")).toBe(false);
    expect(canTransition("resolved", "reopened")).toBe(true);
    expect(canTransition("closed", "reopened")).toBe(false);
  });
  it("routes a sidewalk report and reviews ambiguous reports", () => {
    expect(
      fixtureClassify("The sidewalk pavement is lifted", taxonomy).categoryId,
    ).toBe("sidewalk");
    expect(
      requiresReview(fixtureClassify("Something is wrong nearby", taxonomy)),
    ).toBe(true);
  });
  it("uses a newly published category definition", () => {
    const updated = taxonomy.map((category) => ({ ...category, version: 2 }));
    updated.push({
      id: "crosswalk",
      name: "Crosswalk signal",
      description: "Pedestrian crossing beacon malfunction",
      examples: ["crosswalk signal is dark"],
      exclusions: [],
      requiredFields: ["location"],
      routingTeam: "Electrical",
      publicExplanation: "Electrical will review the crossing signal.",
      version: 2,
      status: "published",
    });
    expect(
      fixtureClassify("The crosswalk signal is dark", updated).categoryId,
    ).toBe("crosswalk");
  });
  it("limits publication to the owner", () => {
    expect(canPublishTaxonomy("reviewer")).toBe(false);
    expect(canPublishTaxonomy("organization_owner")).toBe(true);
  });
});
