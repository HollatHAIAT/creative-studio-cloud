import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { seedListings, variantsOf, minPrice, creatorOf } from "./data";

export type Pick = { id: string; reason: string; reasonAr: string };
export type AdvisorResult = { picks: Pick[]; error?: string };

/** Reads the streamed Responses SSE and returns the final output text. */
async function readText(res: Response) {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "", done = "";
  for (;;) {
    const { value, done: end } = await reader.read();
    if (end) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;
      try {
        const ev = JSON.parse(raw);
        if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
        else if (ev.type === "response.output_text.done") done = ev.text ?? done;
        else if (ev.type === "error" || ev.type === "response.failed") throw new Error(ev.error?.message ?? ev.response?.error?.message ?? "AI error");
      } catch (e) { if (e instanceof Error && e.message !== "Unexpected end of JSON input" && !(e instanceof SyntaxError)) throw e; }
    }
  }
  return done || text;
}

export const recommendArtworks = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ need: z.string().trim().min(3).max(1000) }).parse(d))
  .handler(async ({ data }): Promise<AdvisorResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { picks: [], error: "AI is not configured." };

    // Live listings: only what's currently published in the database.
    const sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, { auth: { persistSession: false } });
    const { data: rows } = await sb.from("listings").select("id, status").eq("status", "published");
    const live = new Set((rows ?? []).map((r) => r.id));
    const catalog = seedListings.filter((l) => live.has(l.id)).map((l) => ({
      id: l.id, title: l.title, artist: creatorOf(l.creatorId)?.name, category: l.category, medium: l.medium, year: l.year,
      description: l.description, fromPrice: minPrice(l), options: [...new Set(variantsOf(l).map((v) => v.kind))], inAuction: !!l.auction,
    }));
    if (!catalog.length) return { picks: [] };

    const prompt = `You are an art advisor for the Arwiqa marketplace. Recommend up to 4 artworks from the catalog that best match the buyer's need. Only use ids from the catalog. Reply with ONLY JSON: {"picks":[{"id":"...","reason":"one short English sentence","reasonAr":"the same sentence in Arabic"}]}. If nothing fits, return {"picks":[]}.

Catalog:
${JSON.stringify(catalog)}

Buyer need:
${data.need}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", input: prompt, stream: true, store: false,
        reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"],
      }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      if (res.status === 429) return { picks: [], error: "Too many requests — please try again shortly." };
      if (res.status === 402) return { picks: [], error: "AI credits are used up for this workspace." };
      return { picks: [], error: `AI request failed (${res.status}). ${msg.slice(0, 200)}` };
    }
    const text = await readText(res);
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { picks: [], error: "The advisor returned no answer." };
    try {
      const parsed = JSON.parse(json) as { picks?: Pick[] };
      return { picks: (parsed.picks ?? []).filter((p) => live.has(p.id)).slice(0, 4) };
    } catch { return { picks: [], error: "The advisor returned an unreadable answer." }; }
  });
