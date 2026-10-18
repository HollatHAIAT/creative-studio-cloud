import { describe, expect, it } from "vitest";
import { pageEn, pageAr, fill } from "@/lib/i18n-pages";

describe("editable page texts", () => {
  it("every About/Licensing/FAQ text has both languages", () => {
    for (const k of Object.keys(pageEn)) { expect(pageEn[k]).toBeTruthy(); expect(pageAr[k]).toBeTruthy(); }
  });
  it("FAQ return answer fills the admin-set return window", () => {
    expect(fill(pageEn["faq.a3"]!, { n: "14" })).toContain("within 14 days");
  });
});
