import { describe, expect, it } from "vitest";
import { missingInfo } from "@/lib/supplier-review.functions";

const full = { name: "Najd Colours", name_ar: "ألوان نجد", city: "Riyadh", phone: "0500000000", email: "", about: "Hand-ground pigments and brushes for artists.", about_ar: "أصباغ مطحونة يدويًا وفرش للفنانين والخطاطين." };
const prod = { description: "Acrylic set", description_ar: "طقم أكريليك", stock: 5 };

describe("supplier application gaps", () => {
  it("a complete application has no gaps", () => expect(missingInfo(full, [prod])).toEqual([]));
  it("flags an application with no products", () => expect(missingInfo(full, []).map((m) => m.en)).toContain("At least one product"));
  it("flags missing Arabic name and contact", () => {
    const m = missingInfo({ ...full, name_ar: "", phone: "", email: "" }, [prod]).map((x) => x.en);
    expect(m).toEqual(["Arabic shop name", "Contact phone or email"]);
  });
});
