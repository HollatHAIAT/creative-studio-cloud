import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { seedListings, creatorOf, minPrice } from "./data";
import { readText } from "./advisor.functions";

const Answer = z.object({
  answer: z.string().default(""), answerAr: z.string().default(""),
  sources: z.array(z.object({ source: z.string(), fact: z.string(), factAr: z.string().default("") })).max(8).default([]),
  askSeller: z.array(z.object({ note: z.string(), noteAr: z.string().default("") })).max(5).default([]),
});
export type ArtworkAnswer = z.infer<typeof Answer>;

/** Public: answers a buyer's question about one live artwork using only its description, creator record and condition/provenance. */
export const askArtwork = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ listingId: z.string().min(1).max(80), question: z.string().trim().min(3).max(800) }).parse(d))
  .handler(async ({ data }): Promise<{ result?: ArtworkAnswer; error?: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data: live } = await sb.from("listings").select("id,title,title_ar,category,price").eq("id", data.listingId).eq("status", "published").maybeSingle();
    if (!live) return { error: "This artwork isn't available." };

    const seed = seedListings.find((l) => l.id === data.listingId);
    const creator = seed ? creatorOf(seed.creatorId) : undefined;
    const { data: d } = await sb.from("listing_drafts")
      .select("title,description,medium,category,is_heritage,heritage_type,origin_region,era,provenance,condition_grade,condition_report,export_permit_ref,seller_role,owner_approved_at")
      .eq("published_listing_id", data.listingId).eq("status", "published").maybeSingle();

    // Public-safe facts only: no owner names, emails or previous-holder identities.
    const facts = {
      title: seed?.title ?? d?.title ?? live.title,
      category: seed?.category ?? d?.category ?? live.category,
      medium: seed?.medium ?? d?.medium ?? "not recorded",
      year: seed?.year ?? "not recorded",
      description: String(seed?.description ?? d?.description ?? "not recorded").slice(0, 1500),
      priceFromUSD: seed ? minPrice(seed) : Number(live.price),
      formats: seed?.variants?.map((v) => v.kind) ?? "not recorded",
      creator: creator ? { name: creator.name, discipline: creator.discipline, city: creator.city, bio: creator.bio,
        otherWorks: seedListings.filter((l) => l.creatorId === creator.id && l.id !== data.listingId).map((l) => `${l.title} (${l.year}, ${l.medium})`).slice(0, 8) } : "not recorded",
      provenance: Array.isArray(d?.provenance) && d.provenance.length ? d.provenance.map((p: any) => ({ period: p.period, documented: !!p.evidence })) : "not recorded",
      condition: d?.condition_grade ? { grade: d.condition_grade, report: String(d.condition_report ?? "").slice(0, 600) } : "not recorded",
      heritage: d?.is_heritage ? { type: d.heritage_type, region: d.origin_region || "not recorded", era: d.era || "not recorded", exportPermit: d.export_permit_ref ? "on file" : "none recorded" } : "not a heritage listing",
      seller: d ? { role: d.seller_role, ownerApproved: !!d.owner_approved_at } : "not recorded",
    };

    const prompt = `You answer a buyer's question about ONE artwork on Arwiqa, a Saudi art marketplace.
Rules:
- Use ONLY the facts below (description, creator record, provenance, condition). If the answer isn't there or is "not recorded", say so plainly — never invent dates, owners, dimensions, authenticity, condition or value.
- No legal, valuation or authentication guarantees. Keep the answer under 120 words.
- sources: each fact you relied on, with source one of "description", "creator", "provenance", "condition", "heritage", "listing".
- askSeller: questions the buyer should send the seller because the record doesn't cover them.
- Write English and natural Arabic for every text field.
FACTS: ${JSON.stringify(facts)}
QUESTION: ${JSON.stringify(data.question)}
Reply with ONLY JSON: {"answer":"","answerAr":"","sources":[{"source":"","fact":"","factAr":""}],"askSeller":[{"note":"","noteAr":""}]}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({ model: "openai/gpt-6-astra", stream: true, store: false,
        reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"],
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }] }),
    });
    if (!res.ok) {
      console.error(`Artwork Q&A AI failed [${res.status}]: ${await res.text().catch(() => "")}`);
      if (res.status === 429) return { error: "Too many requests — please try again shortly." };
      if (res.status === 402 || res.status === 403) return { error: "The artwork assistant is unavailable right now. Please try again later." };
      return { error: `AI request failed (${res.status}).` };
    }
    let text = "";
    try { text = await readText(res); } catch (e) { return { error: e instanceof Error ? e.message : "AI error" }; }
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { error: "The assistant returned no answer." };
    try { return { result: Answer.parse(JSON.parse(json)) }; } catch { return { error: "The assistant returned an unreadable answer." }; }
  });
