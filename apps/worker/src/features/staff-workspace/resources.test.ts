import { describe, expect, it } from "vitest";
import { stableWorkspaceItemId } from "./resources.js";

describe("saved workspace create idempotency", () => {
  it("uses one owner-scoped item ID for a repeated key", async () => {
    const key = "workspace:views:org-1:staff-1:repeated-request-key";
    const first = await stableWorkspaceItemId("views", key);
    expect(await stableWorkspaceItemId("views", key)).toBe(first);
    expect(await stableWorkspaceItemId("views", `${key}-other`)).not.toBe(
      first,
    );
    expect(await stableWorkspaceItemId("reports", key)).toMatch(
      /^sreport_[0-9a-f]{32}$/,
    );
  });
});
