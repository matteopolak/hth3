export type ScenarioCase = {
  id: string;
  categoryId: string;
  department: string;
  openedAt: string;
  firstTriagedAt: string;
  assignedAt: string;
  resolvedAt: string | null;
  wrongDepartment: boolean;
  humanReview: boolean;
  phase: "baseline" | "saturday_update";
};

const departments: Record<string, string> = {
  sidewalk: "Roads",
  road: "Roads",
  water: "Utilities",
  lighting: "Electrical",
  waste: "Sanitation",
  other: "General Services",
};
const categories = Object.keys(departments);
const start = Date.UTC(2026, 7, 20, 8);
const saturdayUpdate = Date.UTC(2026, 8, 26, 8);
const hour = 3_600_000;
const iso = (time: number) => new Date(time).toISOString();

/** Fully synthetic operations fixture. Values are deterministic, not observed CGI outcomes. */
export function makeScenario(count = 600): ScenarioCase[] {
  return Array.from({ length: count }, (_, index) => {
    const phase =
      index >= Math.floor(count * 0.8) ? "saturday_update" : "baseline";
    const categoryId =
      phase === "saturday_update" && index % 4 !== 0
        ? "water"
        : categories[(index * 7 + Math.floor(index / 17)) % categories.length];
    const opened =
      phase === "saturday_update"
        ? saturdayUpdate + (index - Math.floor(count * 0.8)) * hour
        : start + index * 1.7 * hour;
    const wrongDepartment = index % 10 === 0;
    const resolved = index % 5 !== 0;
    return {
      id: `NW-${String(index + 1).padStart(4, "0")}`,
      categoryId,
      department: wrongDepartment
        ? "General Services"
        : departments[categoryId],
      openedAt: iso(opened),
      firstTriagedAt: iso(opened + (12 + (index % 31)) * hour),
      assignedAt: iso(opened + (27 + (index % 48)) * hour),
      resolvedAt: resolved
        ? iso(opened + (4 + (index % 36)) * 24 * hour)
        : null,
      wrongDepartment,
      humanReview: index % 6 === 0,
      phase,
    };
  });
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const center = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[center]
    : (sorted[center - 1] + sorted[center]) / 2;
}

export function scenarioMetrics(cases: ScenarioCase[]) {
  const elapsedHours = (start: string, end: string) =>
    (Date.parse(end) - Date.parse(start)) / hour;
  const resolved = cases.filter((item) => item.resolvedAt);
  return {
    totalCases: cases.length,
    unresolvedBacklog: cases.length - resolved.length,
    medianFirstTriageHours: median(
      cases.map((item) => elapsedHours(item.openedAt, item.firstTriagedAt)),
    ),
    medianAssignmentHours: median(
      cases.map((item) => elapsedHours(item.openedAt, item.assignedAt)),
    ),
    wrongDepartmentPercent:
      (100 * cases.filter((item) => item.wrongDepartment).length) /
      cases.length,
    humanReviewPercent:
      (100 * cases.filter((item) => item.humanReview).length) / cases.length,
    medianResolutionDays: median(
      resolved.map(
        (item) => elapsedHours(item.openedAt, item.resolvedAt!) / 24,
      ),
    ),
  };
}

export function projectedValue(
  casesPerMonth: number,
  assumptions = {
    manualTriageMinutes: 12,
    automatedTriageMinutes: 3,
    automationRate: 0.7,
    hourlyStaffCost: 35,
    implementationCost: 12_000,
    monthlyOperatingCost: 600,
  },
) {
  const staffHoursSaved =
    (casesPerMonth *
      assumptions.automationRate *
      (assumptions.manualTriageMinutes - assumptions.automatedTriageMinutes)) /
    60;
  const monthlyBenefit = staffHoursSaved * assumptions.hourlyStaffCost;
  const monthlyNet = monthlyBenefit - assumptions.monthlyOperatingCost;
  return {
    assumptions,
    staffHoursSaved,
    monthlyBenefit,
    monthlyNet,
    estimatedCostPerCase: assumptions.monthlyOperatingCost / casesPerMonth,
    paybackMonths:
      monthlyNet > 0 ? assumptions.implementationCost / monthlyNet : null,
  };
}
