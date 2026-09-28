import { expect, test } from "vitest";
import { wordDiff } from "@/components/ListingVersionHistory";
test("diff", () => {
  const d = wordDiff("A red sunset over dunes", "A golden sunset over dunes");
  expect(d.filter(x=>x.k==="del").map(x=>x.t)).toEqual(["red"]);
  expect(d.filter(x=>x.k==="add").map(x=>x.t)).toEqual(["golden"]);
});
