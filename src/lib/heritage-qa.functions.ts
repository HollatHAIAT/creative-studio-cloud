import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { seedListings, creatorOf, minPrice } from "./data";
import { readText } from "./advisor.functions";

const HERITAGE_CATS = new Set(["Sadu", "Qatt", "Pottery", "Calligraphy"]);

const Answer = z.object({
  answer: z.string().default(""), answerAr: z.string().default(""),
  facts: z.array(z.object({ id: z.string(), fact: z.string(), factAr: z.string().default("") })).max(8).default([]),
  unknowns: z.array(z.object({ note: z.string(), noteAr: z.string().default("") })).max(5).default([]),
  picks: z.array(z.object({ id: z.string(), reason: z.string(), reasonAr: z.string().default("") })).max(4).default([]),
});
export type HeritagePick = { id: string; reason: string; reasonAr: string; title: string; titleAr: string; href: string; kind: "artwork" | "listing"; price: number };
export type HeritageAnswer = Omit<z.infer<typeof Answer>, "picks"> & { picks: HeritagePick[] };

/** Public: answers shoppers' questions about heritage works from recorded provenance, condition and region; recommends live matches. */
export const askHeritage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ question: z.string().trim().min(5).max(1000) }).parse(d))
  .handler(async ({ data }): Promise<{ result?: HeritageAnswer; error?: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };
    const sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, { auth: { persistSession: false } });
    const { data: rows } = await sb.from("listings").select("id,title,title_ar,category,price,status").eq("status", "published");
    const live = new Map((rows ?? []).map((r: any) => [r.id as string, r]));

    type Item = { id: string; kind: "artwork" | "listing"; title: string; titleAr: string; price: number; [k: string]: unknown };
    const catalog: Item[] = seedListings.filter((l) => live.has(l.id) && HERITAGE_CATS.has(l.category)).map((l) => ({
      id: l.id, kind: "artwork", title: l.title, titleAr: l.titleAr ?? l.title, price: minPrice(l), category: l.category,
      artist: creatorOf(l.creatorId)?.name, medium: l.medium, year: l.year, description: l.description,
      provenance: "not recorded", condition: "not recorded", region: "not recorded",
    }));

    // Seller heritage listings that are live: only public-safe heritage fields (no owner names or holder identities).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: drafts } = await (supabaseAdmin as any).from("listing_drafts")
      .select("published_listing_id,title,title_ar,description,medium,category,price,heritage_type,origin_region,era,provenance,condition_grade,condition_report,export_permit_ref")
      .eq("is_heritage", true).eq("status", "published").not("published_listing_id", "is", null).limit(60);
    for (const d of drafts ?? []) {
      if (!live.has(d.published_listing_id)) continue;
      catalog.push({
        id: d.published_listing_id, kind: "listing", title: d.title, titleAr: d.title_ar || d.title, price: Number(d.price ?? live.get(d.published_listing_id)?.price ?? 0),
        category: d.category, medium: d.medium, description: String(d.description ?? "").slice(0, 600), heritageType: d.heritage_type, region: d.origin_region || "not recorded", era: d.era,
        provenance: Array.isArray(d.provenance) && d.provenance.length ? d.provenance.map((p: any) => ({ period: p.period, evidence: p.evidence ? "documented" : "no document" })) : "not recorded",
        condition: d.condition_grade ? { grade: d.condition_grade, report: String(d.condition_report ?? "").slice(0, 400) } : "not recorded",
        exportPermit: d.export_permit_ref ? "on file" : "none recorded",
      });
    }
    if (!catalog.length) return { error: "No heritage works are live right now." };

    const prompt = `You answer shoppers' questions about heritage artworks on Arwiqa, a Saudi art marketplace.
Rules:
- Answer ONLY from the catalog below (provenance, condition, region, era, medium, description). If something is "not recorded", say so plainly — never guess dates, owners, authenticity or value.
- Don't give legal, valuation or authentication guarantees; suggest asking the seller for documents when relevant.
- facts: short facts you used, each tied to an item id.
- unknowns: what the shopper should ask the seller because it isn't recorded.
- picks: up to 4 catalog ids that best match the question, each with a one-sentence reason. Only ids from the catalog.
- English + natural Arabic for all text.
CATALOG: ${JSON.stringify(catalog)}
QUESTION: ${JSON.stringify(data.question)}
Reply with ONLY JSON: {"answer":"","answerAr":"","facts":[{"id":"","fact":"","factAr":""}],"unknowns":[{"note":"","noteAr":""}],"picks":[{"id":"","reason":"","reasonAr":""}]}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({ model: "openai/gpt-6-astra", stream: true, store: false,
        reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"],
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }] }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      console.error(`Heritage Q&A AI failed [${res.status}]: ${msg}`);
      if (res.status === 429) return { error: "Too many requests — please try again shortly." };
      if (res.status === 402 || res.status === 403) return { error: "The heritage assistant is unavailable right now. Please try again later." };
      return { error: `AI request failed (${res.status}).` };
    }
    let text = "";
    try { text = await readText(res); } catch (e) { return { error: e instanceof Error ? e.message : "AI error" }; }
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { error: "The assistant returned no answer." };
    try {
      const a = Answer.parse(JSON.parse(json));
      const byId = new Map(catalog.map((c) => [c.id, c]));
      const picks: HeritagePick[] = a.picks.filter((p) => byId.has(p.id)).map((p) => {
        const c = byId.get(p.id)!;
        return { ...p, title: c.title, titleAr: c.titleAr, price: c.price, kind: c.kind, href: c.kind === "artwork" ? `/artwork/${c.id}` : `/listing/${c.id}` };
      });
      return { result: { ...a, facts: a.facts.filter((f) => byId.has(f.id)), picks } };
    } catch { return { error: "The assistant returned an unreadable answer." }; }
  });
