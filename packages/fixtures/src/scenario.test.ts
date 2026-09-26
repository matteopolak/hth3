import { describe, expect, it } from "vitest";
import { makeScenario, projectedValue, scenarioMetrics } from "./scenario";

describe("synthetic Northwind scenario", () => {
  it("replays the same 600 cases and Saturday water surge", () => {
    const first = makeScenario();
    expect(makeScenario()).toEqual(first);
    expect(first).toHaveLength(600);
    expect(
      first.filter(
        (item) =>
          item.phase === "saturday_update" && item.categoryId === "water",
      ).length,
    ).toBeGreaterThan(80);
    expect(
      new Set(first.map((item) => item.department)).size,
    ).toBeGreaterThanOrEqual(4);
  });
  it("calculates traceable operational and value metrics", () => {
    const metrics = scenarioMetrics(makeScenario());
    expect(metrics.unresolvedBacklog).toBe(120);
    expect(metrics.wrongDepartmentPercent).toBe(10);
    expect(metrics.humanReviewPercent).toBeCloseTo(16.67, 1);
    expect(projectedValue(600).staffHoursSaved).toBe(63);
  });
});
