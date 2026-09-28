// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScreenReaderPreview } from "@/components/ScreenReaderPreview";

describe("screen-reader preview", () => {
  it("lists the listing in screen-reader order", () => {
    render(<ScreenReaderPreview lang="en" alt="Gold calligraphy on black" title="The Line" medium="Ink" description={"First.\nSecond."} tags={["gold"]} hasImage />);
    const items = screen.getByRole("list", { name: "Transcript" }).querySelectorAll("li");
    expect([...items].map((li) => li.textContent)).toEqual([
      "Image · Gold calligraphy on black", "Text · Ink", "Heading level 3 · The Line",
      "Paragraph · First.", "Paragraph · Second.", "Text · #gold", "Button · Buy now",
    ]);
  });
});
