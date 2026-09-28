import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readText } from "./advisor.functions";

const Checklist = z.object({
  summary: z.string().default(""), summaryAr: z.string().default(""),
  items: z.array(z.object({
    priority: z.string().default("medium"),
    field: z.string().default("general"),
    action: z.string(), actionAr: z.string().default(""),
    why: z.string().default(""), whyAr: z.string().default(""),
  })).max(12).default([]),
});
export type ReviewerChecklist = z.infer<typeof Checklist>;

/** Invited reviewers only: turns their free-text comments into a prioritised, seller-friendly revision checklist. */
export const draftReviewerChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ draftId: z.string().uuid(), comments: z.string().trim().min(10).max(5000) }).parse(d))
  .handler(async ({ data, context }): Promise<{ checklist?: ReviewerChecklist; error?: string }> => {
    const sb = context.supabase as any;
    const { data: perm } = await sb.rpc("active_reviewer", { _draft: data.draftId, _uid: context.userId });
    if (!perm) return { error: "Only invited reviewers with an open invitation can use this." };
    const { data: d } = await sb.from("listing_drafts").select("title,title_ar,description,description_ar,alt_text,alt_text_ar,medium,tags,category,price").eq("id", data.draftId).maybeSingle();
    if (!d) return { error: "Listing not found." };
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };
    const prompt = `You help an invited reviewer on Arwiqa, a Saudi-based art marketplace, turn their free-text comments into a revision checklist for the artist/seller.
Rules:
- Use ONLY what the reviewer wrote. Don't add new criticisms, rules or praise. Merge duplicates. Skip remarks with nothing to act on.
- Each item: a short, kind, concrete action the seller can do (start with a verb), and "why" in one sentence. English + natural Arabic (actionAr, whyAr).
- priority: "high" (blocks a good listing: wrong facts, misleading, missing key info, image problems), "medium" (clarity, accessibility, consistency), "low" (polish).
- field: one of image, title, description, altText, tags, price, medium, general.
- Order high → low. Max 12 items.
- summary/summaryAr: one encouraging sentence on the overall direction.
LISTING: ${JSON.stringify(d)}
REVIEWER COMMENTS: ${JSON.stringify(data.comments)}
Reply with ONLY JSON: {"summary":"","summaryAr":"","items":[{"priority":"","field":"","action":"","actionAr":"","why":"","whyAr":""}]}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({ model: "openai/gpt-6-astra", stream: true, store: false,
        reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"],
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }] }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      console.error(`Reviewer checklist AI failed [${res.status}]: ${msg}`);
      if (res.status === 429) return { error: "Too many requests — please try again shortly." };
      if (res.status === 403 && msg.includes("credit_limit")) return { error: "The workspace AI spending limit has been reached. A workspace admin can raise it in workspace settings." };
      if (res.status === 402) return { error: "AI credits are used up for this workspace." };
      return { error: `AI request failed (${res.status}).` };
    }
    let text = "";
    try { text = await readText(res); } catch (e) { return { error: e instanceof Error ? e.message : "AI error" }; }
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { error: "The AI returned no checklist." };
    try {
      const c = Checklist.parse(JSON.parse(json));
      const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
      c.items.sort((a, b) => (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1));
      return { checklist: c };
    } catch { return { error: "The AI returned an unreadable answer." }; }
  });
