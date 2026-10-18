import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { seedListings, variantsOf, minPrice, creatorOf } from "./data";
import { readText } from "./advisor.functions";

export type CompareRow = { id: string; fit: number; style: string; styleAr: string; budget: string; budgetAr: string; room: string; roomAr: string; pros: string; prosAr: string; cons: string; consAr: string };
export type CompareResult = { rows?: CompareRow[]; verdict?: string; verdictAr?: string; bestId?: string | null; error?: string };

const str = { type: "string" } as const;
const schema = {
  type: "object", additionalProperties: false, required: ["rows", "verdict", "verdictAr", "bestId"],
  properties: {
    verdict: str, verdictAr: str, bestId: { type: ["string", "null"] },
    rows: { type: "array", items: { type: "object", additionalProperties: false,
      required: ["id", "fit", "style", "styleAr", "budget", "budgetAr", "room", "roomAr", "pros", "prosAr", "cons", "consAr"],
      properties: { id: str, fit: { type: "integer" }, style: str, styleAr: str, budget: str, budgetAr: str, room: str, roomAr: str, pros: str, prosAr: str, cons: str, consAr: str } } },
  },
};

/** Personalized side-by-side comparison of 2–4 selected artworks against the buyer's style, budget and room. */
export const compareArtworks = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    ids: z.array(z.string().max(80)).min(2).max(4),
    style: z.string().trim().max(500).default(""),
    budget: z.number().min(0).max(10_000_000).optional(),
    room: z.string().trim().max(500).default(""),
  }).refine((v) => v.style || v.room || v.budget != null, "Add your style, budget or room.").parse(d))
  .handler(async ({ data }): Promise<CompareResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };
    // Facts come from the catalog on the server, never from the browser.
    const works = data.ids.map((id) => seedListings.find((l) => l.id === id)).filter(Boolean).map((l) => ({
      id: l!.id, title: l!.title, artist: creatorOf(l!.creatorId)?.name, category: l!.category, medium: l!.medium, year: l!.year,
      description: l!.description.slice(0, 500), fromPriceUSD: minPrice(l!),
      options: variantsOf(l!).map((v) => ({ kind: v.kind, priceUSD: v.price, size: v.size, material: v.material, license: v.license })),
    }));
    if (works.length < 2) return { error: "Choose at least two artworks." };

    const prompt = `You are an art advisor for the Arwiqa marketplace. Compare these artworks for this buyer, side by side.
For each artwork give: fit (0-100 match score), and one short sentence each for style match, budget (cite real prices/options from the data; budget is in USD), room fit (scale, palette, light, use of space), main pro and main con. Give every sentence in English and natural Arabic (…Ar fields).
Use only facts in the data; never invent sizes, provenance or prices. If the room details are missing, say what to check. Then a 2-3 sentence verdict (English + Arabic) and bestId (an id from the list, or null if none fits).

Artworks: ${JSON.stringify(works)}
Buyer style: ${data.style || "not given"}
Budget (USD): ${data.budget ?? "not given"}
Room: ${data.room || "not given"}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", input: prompt, stream: true, store: false,
        reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"],
        text: { format: { type: "json_schema", name: "comparison", strict: true, schema } },
      }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      if (res.status === 429) return { error: "Too many requests — please try again shortly." };
      if (res.status === 403 && msg.includes("credit_limit")) return { error: "The workspace AI spending limit has been reached. A workspace admin can raise it in workspace settings." };
      if (res.status === 402) return { error: "AI credits are used up for this workspace." };
      return { error: `AI request failed (${res.status}).` };
    }
    try {
      const out = JSON.parse(await readText(res)) as Required<Omit<CompareResult, "error">>;
      const ids = new Set(works.map((w) => w.id));
      const rows = out.rows.filter((r) => ids.has(r.id)).map((r) => ({ ...r, fit: Math.max(0, Math.min(100, Math.round(r.fit))) }));
      if (!rows.length) return { error: "The advisor returned no comparison." };
      return { rows, verdict: out.verdict, verdictAr: out.verdictAr, bestId: out.bestId && ids.has(out.bestId) ? out.bestId : null };
    } catch (e) { return { error: e instanceof Error && e.message !== "Unexpected end of JSON input" ? e.message : "The advisor returned an unreadable answer." }; }
  });
