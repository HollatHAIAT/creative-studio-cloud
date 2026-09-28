import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readText } from "./advisor.functions";

const Consensus = z.object({
  summary: z.string().default(""), summaryAr: z.string().default(""),
  shared: z.array(z.object({
    concern: z.string(), concernAr: z.string().default(""),
    reviewers: z.number().default(1),
    field: z.string().default("general"),
    quote: z.string().default(""),
  })).max(10).default([]),
  disagreements: z.array(z.object({ topic: z.string(), topicAr: z.string().default("") })).max(6).default([]),
  changes: z.array(z.object({
    priority: z.string().default("medium"),
    field: z.string().default("general"),
    action: z.string(), actionAr: z.string().default(""),
    why: z.string().default(""), whyAr: z.string().default(""),
  })).max(12).default([]),
});
export type ReviewerConsensus = z.infer<typeof Consensus>;

/** Staff only: finds concerns shared across reviewers' written responses and turns them into prioritised changes. */
export const analyseReviewerResponses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ draftId: z.string().uuid(), responses: z.array(z.string().trim().min(3).max(3000)).min(1).max(20) }).parse(d))
  .handler(async ({ data, context }): Promise<{ result?: ReviewerConsensus; error?: string }> => {
    const sb = context.supabase as any;
    const { data: staff } = await sb.rpc("is_staff", { _uid: context.userId });
    if (!staff) return { error: "Only moderators and admins can use this." };
    const { data: d } = await sb.from("listing_drafts").select("title,title_ar,description,description_ar,alt_text,medium,tags,category,price").eq("id", data.draftId).maybeSingle();
    if (!d) return { error: "Listing not found." };
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };
    const numbered = data.responses.map((r, i) => `Reviewer ${i + 1}: ${r}`).join("\n\n");
    const prompt = `You help a moderator on Arwiqa, a Saudi-based art marketplace, combine several reviewers' written responses about one listing.
Rules:
- Use ONLY what reviewers wrote. Don't invent concerns or rules.
- shared: concerns raised by 2+ reviewers (or 1 if clearly serious), with how many reviewers raised it, the listing part (image, title, description, altText, tags, price, medium, provenance, general) and a short quote.
- disagreements: where reviewers contradict each other.
- changes: concrete, kind actions for the seller (start with a verb). priority "high" = several reviewers or blocks a good listing (wrong facts, misleading, missing key info, image problems); "medium" = clarity/accessibility; "low" = polish. Order high→low, max 12.
- English + natural Arabic for every text.
LISTING: ${JSON.stringify(d)}
RESPONSES:
${numbered}
Reply with ONLY JSON: {"summary":"","summaryAr":"","shared":[{"concern":"","concernAr":"","reviewers":0,"field":"","quote":""}],"disagreements":[{"topic":"","topicAr":""}],"changes":[{"priority":"","field":"","action":"","actionAr":"","why":"","whyAr":""}]}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({ model: "openai/gpt-6-astra", stream: true, store: false,
        reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"],
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }] }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      console.error(`Reviewer consensus AI failed [${res.status}]: ${msg}`);
      if (res.status === 429) return { error: "Too many requests — please try again shortly." };
      if (res.status === 403 && msg.includes("credit_limit")) return { error: "The workspace AI spending limit has been reached. A workspace admin can raise it in workspace settings." };
      if (res.status === 402) return { error: "AI credits are used up for this workspace." };
      return { error: `AI request failed (${res.status}).` };
    }
    let text = "";
    try { text = await readText(res); } catch (e) { return { error: e instanceof Error ? e.message : "AI error" }; }
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { error: "The AI returned no analysis." };
    try {
      const c = Consensus.parse(JSON.parse(json));
      const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
      c.changes.sort((a, b) => (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1));
      c.shared.sort((a, b) => b.reviewers - a.reviewers);
      return { result: c };
    } catch { return { error: "The AI returned an unreadable answer." }; }
  });
