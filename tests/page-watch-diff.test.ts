import { describe, expect, it } from "vitest";
import { diffLines } from "@/lib/page-watch.server";

describe("page watch diff", () => {
  it("reports only lines that were added or removed", () => {
    const d = diffLines("# Fees\nCommission 10%\nShipping free", "# Fees\nCommission 12%\nShipping free");
    expect(d.added).toEqual(["Commission 12%"]);
    expect(d.removed).toEqual(["Commission 10%"]);
  });
  it("ignores whitespace-only differences", () => {
    const d = diffLines("Same   line", "Same line\n\n");
    expect(d.added).toEqual([]); expect(d.removed).toEqual([]);
  });
});
