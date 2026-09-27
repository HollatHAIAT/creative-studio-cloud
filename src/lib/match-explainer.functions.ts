import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readText } from "./advisor.functions";

export type MatchExplanation = {
  fit?: "strong" | "partial" | "weak";
  summary?: string; summaryAr?: string;
  matches?: { en: string; ar: string }[];
  gaps?: { en: string; ar: string }[];
  error?: string;
};

const s = (n: number) => z.string().trim().max(n);

/** Explains, in both languages, why a newly listed artwork fits a buyer's saved-search criteria. */
export const explainMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    criteria: z.object({
      keywords: s(200).default(""),
      categories: z.array(s(40)).max(10).default([]),
      minPrice: z.number().min(0).max(10_000_000).nullable().default(null),
      maxPrice: z.number().min(0).max(10_000_000).nullable().default(null),
      notes: s(500).default(""),
    }),
    artwork: z.object({
      title: s(160).min(1), artist: s(120).default(""), category: s(40).default(""),
      medium: s(160).default(""), price: z.number().min(0).max(10_000_000).nullable().default(null),
      description: s(2000).default(""),
    }),
  }).parse(d))
  .handler(async ({ data }): Promise<MatchExplanation> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };

    const prompt = `You are an art advisor for the Arwiqa marketplace. A buyer saved search criteria and a new artwork was just listed. Explain honestly why it fits (and where it doesn't). Use only the facts given; never invent details.
Reply with ONLY JSON:
{"fit":"strong"|"partial"|"weak","summary":"2 short English sentences","summaryAr":"same in Arabic","matches":[{"en":"...","ar":"..."}],"gaps":[{"en":"...","ar":"..."}]}
Max 4 matches and 3 gaps, each one short phrase. Price outside the range is a gap.

Buyer criteria:
${JSON.stringify(data.criteria)}

New artwork:
${JSON.stringify(data.artwork)}`;

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
      if (res.status === 429) return { error: "Too many requests — please try again shortly." };
      if (res.status === 403 && msg.includes("credit_limit")) return { error: "The workspace AI spending limit has been reached. A workspace admin can raise it in workspace settings." };
      if (res.status === 402) return { error: "AI credits are used up for this workspace." };
      return { error: `AI request failed (${res.status}).` };
    }
    const json = (await readText(res)).match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { error: "The AI returned no answer." };
    try {
      const p = JSON.parse(json) as MatchExplanation;
      const fit = p.fit === "strong" || p.fit === "partial" || p.fit === "weak" ? p.fit : "partial";
      return { fit, summary: p.summary ?? "", summaryAr: p.summaryAr ?? "", matches: (p.matches ?? []).slice(0, 4), gaps: (p.gaps ?? []).slice(0, 3) };
    } catch { return { error: "The AI returned an unreadable answer." }; }
  });
