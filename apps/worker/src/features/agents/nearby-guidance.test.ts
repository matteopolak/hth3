import { describe, expect, it } from "vitest";
import {
  nearbyOfficeAnswer,
  nearbyOfficeTool,
  unsupportedOttawaFeedbackAnswer,
} from "./nearby-guidance.js";

describe("grounded Nearby guidance", () => {
  it("answers the Ottawa prompt from Ottawa location fields only", () => {
    const prompt =
      "Where can I find a public service office near Ottawa, Ontario? Show official sources and how to check the location.";
    expect(nearbyOfficeTool(prompt)).toEqual({
      name: "search_nearby",
      args: { location: "Ottawa", limit: 12 },
    });
    const answer = nearbyOfficeAnswer(
      {
        items: [
          {
            title: "Service BC",
            jurisdiction: {
              name: "British Columbia",
              municipality: { name: "Victoria" },
            },
            handoff: { url: "https://www2.gov.bc.ca/servicebc" },
          },
          {
            title: "ServiceOntario — St. Joseph, Ottawa",
            jurisdiction: {
              name: "Ottawa, Ontario",
              municipality: { name: "Ottawa" },
            },
            handoff: {
              publisher: "Government of Ontario",
              url: "https://www.ontario.ca/locations/serviceontario/st-joseph-ottawa",
            },
            service: {
              address: "2864 St. Joseph Boulevard, Ottawa, Ontario K1C 1G7",
            },
          },
        ],
      },
      "en",
      "Ottawa",
      "Ontario",
    );
    expect(answer).toContain("ServiceOntario");
    expect(answer).toContain("2864 St. Joseph Boulevard");
    expect(answer).toContain("ontario.ca/locations/serviceontario");
    expect(answer).not.toContain("Service BC");
    expect(answer).not.toContain("gov.bc.ca");
  });

  it("returns no result for another province and does not draft Ottawa feedback", () => {
    const answer = nearbyOfficeAnswer(
      {
        items: [
          {
            title: "Service BC",
            jurisdiction: {
              name: "Victoria, British Columbia",
              municipality: { name: "Victoria" },
            },
          },
        ],
      },
      "en",
      "Ottawa",
      "Ontario",
    );
    expect(answer).toContain("no confirmed public service office in Ottawa");
    expect(answer).not.toContain("Service BC");
    expect(
      unsupportedOttawaFeedbackAnswer(
        "How can I report a damaged bench in Confederation Park in Ottawa?",
        "en",
      ),
    ).toContain("no Ottawa destination");
  });
});
