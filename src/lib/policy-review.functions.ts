import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readText } from "./advisor.functions";

async function assertStaff(sb: { rpc: (f: "is_staff", a: { _uid: string }) => PromiseLike<{ data: unknown }> }, uid: string) {
  const { data } = await sb.rpc("is_staff", { _uid: uid });
  if (!data) throw new Error("Staff only.");
}

export type SubmittedDraft = {
  id: string; title: string; title_ar: string; description: string; description_ar: string;
  alt_text: string; alt_text_ar: string; tags: string[]; medium: string; submitted_at: string | null; imageUrl: string | null;
};

/** Staff-only: lists listings sellers have submitted for review, with a short-lived image link. */
export const listSubmittedDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SubmittedDraft[]> => {
    await assertStaff(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("listing_drafts")
      .select("id,title,title_ar,description,description_ar,alt_text,alt_text_ar,tags,medium,submitted_at,image_path")
      .eq("status", "submitted").order("submitted_at", { ascending: false }).limit(50);
    return Promise.all((data ?? []).map(async ({ image_path, ...d }) => {
      let imageUrl: string | null = null;
      if (image_path) imageUrl = (await supabaseAdmin.storage.from("artwork-images").createSignedUrl(image_path, 600)).data?.signedUrl ?? null;
      return { ...d, imageUrl };
    }));
  });

const Review = z.object({
  risk: z.enum(["low", "medium", "high"]),
  recommendation: z.enum(["approve", "request_changes", "reject"]),
  summary: z.string(), summaryAr: z.string(),
  issues: z.array(z.object({
    area: z.enum(["image", "title", "description", "altText", "tags"]),
    policy: z.string(), severity: z.enum(["low", "medium", "high"]),
    detail: z.string(), detailAr: z.string(),
  })).max(15),
});
export type PolicyReview = z.infer<typeof Review>;

/** Staff-only: AI screens a submitted listing (image + copy) for policy issues. Advisory — staff decide. */
export const reviewListingPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ draftId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ review?: PolicyReview; error?: string }> => {
    try { await assertStaff(context.supabase as never, context.userId); } catch { return { error: "Staff only." }; }
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: d } = await supabaseAdmin.from("listing_drafts").select("*").eq("id", data.draftId).maybeSingle();
    if (!d) return { error: "Listing not found." };
    const content: Array<Record<string, string>> = [];
    const copy = { title: d.title, titleAr: d.title_ar, description: d.description, descriptionAr: d.description_ar, altText: d.alt_text, altTextAr: d.alt_text_ar, tags: d.tags, medium: d.medium };
    const prompt = `You are a trust & safety reviewer for Arwiqa, a Saudi-based global art marketplace. Screen this submitted listing (image and copy) for policy issues. Consider: explicit/sexual content or nudity, violence/gore, hate or extremist symbols, content offensive to religion or Saudi public decency, political propaganda, counterfeit/copied or AI-traced work presented as original, trademarked logos or brands (e.g. bank logos) without authorization, real people's likeness without consent, prohibited items, misleading claims (fake certificates, unverifiable provenance, "museum-grade", investment guarantees), contact details/links/off-platform payment requests, spam or keyword stuffing, mismatch between image and copy, English/Arabic copy that disagree, and inaccurate alt text. Do not invent issues; if clean, return an empty issues array and risk "low".
Return: risk (overall), recommendation, summary (English, 2-3 sentences of review risks) and summaryAr (Arabic), issues [{area, policy (short name), severity, detail (English), detailAr (Arabic)}].
Listing copy: ${JSON.stringify(copy)}
${d.image_path ? "" : "No image was provided — note that as an issue."}
Reply with ONLY JSON: {"risk":"","recommendation":"","summary":"","summaryAr":"","issues":[]}`;
    content.push({ type: "input_text", text: prompt });
    if (d.image_path) {
      const { data: blob } = await supabaseAdmin.storage.from("artwork-images").download(d.image_path);
      if (blob && blob.size > 0) {
        const mime = blob.type || "image/jpeg";
        content.push({ type: "input_image", image_url: `data:${mime};base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}` });
      }
    }
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", stream: true, store: false,
        reasoning: { effort: "medium", summary: "auto" }, include: ["reasoning.encrypted_content"],
        input: [{ role: "user", content }],
      }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      console.error(`Policy review AI failed [${res.status}]: ${msg}`);
      if (res.status === 429) return { error: "Too many requests — please try again shortly." };
      if (res.status === 403 && msg.includes("credit_limit")) return { error: "The workspace AI spending limit has been reached. A workspace admin can raise it in workspace settings." };
      if (res.status === 402) return { error: "AI credits are used up for this workspace." };
      return { error: `AI request failed (${res.status}).` };
    }
    let text = "";
    try { text = await readText(res); } catch (e) { return { error: e instanceof Error ? e.message : "AI error" }; }
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { error: "The AI returned no review." };
    try { return { review: Review.parse(JSON.parse(json)) }; } catch { return { error: "The AI returned an unreadable answer." }; }
  });
