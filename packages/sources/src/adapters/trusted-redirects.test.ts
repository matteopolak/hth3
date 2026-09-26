import { describe, expect, it } from "vitest";
import { fetchBcOfficialRecords } from "./bc/index.js";
import { fetchOntarioOfficialRecords } from "./ontario/index.js";

function responseAt(body: string, url: string): Response {
  const response = new Response(body, {
    headers: { "Content-Type": "text/html" },
  });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

describe("official source redirect checks", () => {
  it("rejects B.C. pages that finish outside their requested official host", async () => {
    const result = await fetchBcOfficialRecords(async (input) => {
      const url = String(input);
      const body = url.includes("/query?")
        ? JSON.stringify({
            features: [
              { attributes: { OFFICE_NAME: "Sample", OFFICE_CODE: "S1" } },
            ],
          })
        : "<h1>Expected source heading</h1>";
      return responseAt(body, "https://source-mirror.example/unofficial");
    });

    expect(result.records).toHaveLength(0);
    expect(result.failedSources.length).toBeGreaterThan(0);
    expect(
      result.failedSources.every(
        (failure) => failure.code === "SOURCE_REDIRECTED_OFFICIAL_HOST",
      ),
    ).toBe(true);
  });

  it("rejects Ontario pages that finish outside the requested provincial host", async () => {
    const result = await fetchOntarioOfficialRecords(async () =>
      responseAt(
        "<html><h1>Careers: Ontario Public Service</h1></html>",
        "https://source-mirror.example/unofficial",
      ),
    );

    expect(result.records).toHaveLength(0);
    expect(result.failedSources).toHaveLength(4);
    expect(
      result.failedSources.every(
        (failure) => failure.code === "SOURCE_REDIRECTED_OFFICIAL_HOST",
      ),
    ).toBe(true);
  });
});
