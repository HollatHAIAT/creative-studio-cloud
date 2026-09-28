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

const Guidance = z.object({
  summary: z.string(), summaryAr: z.string(),
  steps: z.array(z.object({
    area: z.enum(["image", "title", "description", "altText", "tags", "pricing", "other"]),
    action: z.string(), actionAr: z.string(),
    example: z.string().nullable(), exampleAr: z.string().nullable(),
  })).min(1).max(10),
  message: z.string(), messageAr: z.string(),
});
export type RevisionGuidance = z.infer<typeof Guidance>;

/** Staff-only: turns a rejected listing + decision notes into clear, actionable seller guidance. */
export const draftRevisionGuidance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ draftId: z.string().uuid(), notes: z.string().trim().min(5).max(2000) }).parse(d))
  .handler(async ({ data, context }): Promise<{ guidance?: RevisionGuidance; error?: string }> => {
    try { await assertStaff(context.supabase as never, context.userId); } catch { return { error: "Staff only." }; }
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: d } = await supabaseAdmin.from("listing_drafts").select("*").eq("id", data.draftId).maybeSingle();
    if (!d) return { error: "Listing not found." };
    if (d.status !== "rejected") return { error: "Guidance can only be drafted for rejected listings." };
    const copy = { title: d.title, titleAr: d.title_ar, description: d.description, descriptionAr: d.description_ar, altText: d.alt_text, altTextAr: d.alt_text_ar, tags: d.tags, medium: d.medium, hasImage: !!d.image_path };
    const prompt = `You help moderators at Arwiqa, a Saudi-based global art marketplace, explain listing rejections to sellers.
Using ONLY the moderator's decision notes and the listing below, draft revision guidance the seller can act on. Be respectful, specific and encouraging. Do not add new reasons the moderator didn't give, do not invent policies, and do not promise approval.
Return:
- summary / summaryAr: one or two sentences on why it was rejected.
- steps: ordered, concrete fixes, each tied to an area (image, title, description, altText, tags, pricing, other), with action (English) and actionAr (Arabic), and an optional short rewritten example (example/exampleAr, null if not useful). Examples must stay factual to the listing.
- message / messageAr: a short, friendly note to the seller (under 120 words) that summarises the steps and invites them to edit and resubmit.
Moderator notes: ${JSON.stringify(data.notes)}
Listing: ${JSON.stringify(copy)}
Reply with ONLY JSON: {"summary":"","summaryAr":"","steps":[{"area":"","action":"","actionAr":"","example":null,"exampleAr":null}],"message":"","messageAr":""}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", stream: true, store: false,
        reasoning: { effort: "medium", summary: "auto" }, include: ["reasoning.encrypted_content"],
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
      }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      console.error(`Revision guidance AI failed [${res.status}]: ${msg}`);
      if (res.status === 429) return { error: "Too many requests — please try again shortly." };
      if (res.status === 403 && msg.includes("credit_limit")) return { error: "The workspace AI spending limit has been reached. A workspace admin can raise it in workspace settings." };
      if (res.status === 402) return { error: "AI credits are used up for this workspace." };
      return { error: `AI request failed (${res.status}).` };
    }
    let text = "";
    try { text = await readText(res); } catch (e) { return { error: e instanceof Error ? e.message : "AI error" }; }
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { error: "The AI returned no guidance." };
    try { return { guidance: Guidance.parse(JSON.parse(json)) }; } catch { return { error: "The AI returned an unreadable answer." }; }
  });

/** Staff-only: saves the (edited) guidance on the listing and notifies the seller. */
export const sendRevisionGuidance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ draftId: z.string().uuid(), message: z.string().trim().min(5).max(3000), messageAr: z.string().trim().min(5).max(3000) }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok?: true; error?: string }> => {
    try { await assertStaff(context.supabase as never, context.userId); } catch { return { error: "Staff only." }; }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: d } = await supabaseAdmin.from("listing_drafts").select("id,user_id,status,title,title_ar").eq("id", data.draftId).maybeSingle();
    if (!d || d.status !== "rejected") return { error: "Only rejected listings can get revision guidance." };
    const note = `${data.message}\n\n${data.messageAr}`.slice(0, 6000);
    // Staff-only flag lets the publish guard accept a note change on a reviewed draft.
    const { error } = await supabaseAdmin.rpc("admin_set_listing_guidance" as never, { _id: d.id, _note: note, _actor: context.userId } as never);
    if (error) { console.error(error); return { error: "Couldn't save the guidance." }; }
    await supabaseAdmin.rpc("push_notification", { _uid: d.user_id, _kind: "order", _t: "How to fix your listing", _tar: "كيف تعدّل إعلانك", _b: `${d.title}: ${data.message}`.slice(0, 500), _bar: `${d.title_ar}: ${data.messageAr}`.slice(0, 500), _link: "/listing-writer" });
    return { ok: true };
  });

const RevisionCheck = z.object({
  verdict: z.enum(["addressed", "partly", "not_addressed"]),
  summary: z.string(), summaryAr: z.string(),
  requests: z.array(z.object({
    request: z.string(), requestAr: z.string(),
    status: z.enum(["done", "partly", "missing"]),
    note: z.string(), noteAr: z.string(),
  })).max(12),
  remaining: z.array(z.object({
    area: z.enum(["image", "title", "description", "altText", "tags", "other"]),
    edit: z.string(), editAr: z.string(),
  })).max(10),
});
export type RevisionCheckResult = z.infer<typeof RevisionCheck>;

/** Seller: AI checks whether a revised listing addresses the moderator's notes. Advisory only. */
export const checkRevisionAgainstNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    notes: z.string().trim().min(5).max(6000),
    title: z.string().max(200), titleAr: z.string().max(200),
    description: z.string().max(4000), descriptionAr: z.string().max(4000),
    altText: z.string().max(300), altTextAr: z.string().max(300),
    tags: z.array(z.string().max(60)).max(20),
  }).parse(d))
  .handler(async ({ data }): Promise<{ result?: RevisionCheckResult; error?: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };
    const { notes, ...copy } = data;
    const prompt = `You help sellers on Arwiqa, a Saudi-based global art marketplace, fix a listing a moderator rejected.
Split the moderator's notes into the individual changes requested. For each, judge from the revised listing whether it is done, partly done or missing, with a short note (English + Arabic). Then list any remaining concrete edits, tied to an area. Only use the requests in the notes — do not invent new policy requirements. If you can't judge something from text alone (e.g. the image), say so and mark it partly.
verdict: "addressed" if all done, "partly" if some are, "not_addressed" if none.
Moderator notes: ${JSON.stringify(notes)}
Revised listing: ${JSON.stringify(copy)}
Reply with ONLY JSON: {"verdict":"","summary":"","summaryAr":"","requests":[{"request":"","requestAr":"","status":"","note":"","noteAr":""}],"remaining":[{"area":"","edit":"","editAr":""}]}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", stream: true, store: false,
        reasoning: { effort: "medium", summary: "auto" }, include: ["reasoning.encrypted_content"],
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
      }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      console.error(`Revision check AI failed [${res.status}]: ${msg}`);
      if (res.status === 429) return { error: "Too many requests — please try again shortly." };
      if (res.status === 403 && msg.includes("credit_limit")) return { error: "The workspace AI spending limit has been reached. A workspace admin can raise it in workspace settings." };
      if (res.status === 402) return { error: "AI credits are used up for this workspace." };
      return { error: `AI request failed (${res.status}).` };
    }
    let text = "";
    try { text = await readText(res); } catch (e) { return { error: e instanceof Error ? e.message : "AI error" }; }
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { error: "The AI returned no assessment." };
    try { return { result: RevisionCheck.parse(JSON.parse(json)) }; } catch { return { error: "The AI returned an unreadable answer." }; }
  });

const VersionCompare = z.object({
  verdict: z.enum(["addressed", "partly", "not_addressed"]),
  summary: z.string(), summaryAr: z.string(),
  requests: z.array(z.object({
    request: z.string(), requestAr: z.string(),
    status: z.enum(["addressed", "partly", "not_addressed", "unclear"]),
    evidence: z.string(), evidenceAr: z.string(),
  })).max(12),
  flags: z.array(z.object({
    area: z.enum(["image", "title", "description", "altText", "tags", "medium", "other"]),
    reason: z.string(), reasonAr: z.string(),
    severity: z.enum(["low", "medium", "high"]),
  })).max(10),
});
export type VersionCompareResult = z.infer<typeof VersionCompare>;

/** Staff-only: AI compares a resubmitted version with the previous one against the decision notes. Advisory. */
export const compareResubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ draftId: z.string().uuid(), version: z.number().int().min(2), notes: z.string().trim().min(5).max(6000) }).parse(d))
  .handler(async ({ data, context }): Promise<{ result?: VersionCompareResult; error?: string }> => {
    try { await assertStaff(context.supabase as never, context.userId); } catch { return { error: "Staff only." }; }
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin.from("listing_draft_versions" as never).select("*")
      .eq("draft_id", data.draftId).in("version", [data.version - 1, data.version]);
    type Row = { version: number; title: string; title_ar: string; description: string; description_ar: string; alt_text: string; alt_text_ar: string; tags: string[]; medium: string; image_path: string | null };
    const list = (rows ?? []) as unknown as Row[];
    const pick = (n: number) => list.find((r) => r.version === n);
    const prev = pick(data.version - 1), cur = pick(data.version);
    if (!prev || !cur) return { error: "Both versions are needed to compare." };
    const shape = (r: Row) => ({ title: r.title, titleAr: r.title_ar, description: r.description, descriptionAr: r.description_ar, altText: r.alt_text, altTextAr: r.alt_text_ar, tags: r.tags, medium: r.medium });
    const imageChanged = prev.image_path !== cur.image_path;
    const prompt = `You assist moderators at Arwiqa, a Saudi-based global art marketplace, reviewing a seller's resubmission of a rejected listing.
Split the moderator's decision notes into the individual changes requested. For each, compare the PREVIOUS and RESUBMITTED versions and judge: addressed, partly, not_addressed, or unclear (e.g. image content can't be judged from text; only whether the image file changed is known). Give short evidence quoting what changed (English + Arabic).
Then list flags: anything that still needs a human look — requests not addressed, new problems introduced by the edits (new claims, contact details, English/Arabic mismatch, removed required info), or changes you can't verify. Do not invent new policy requirements. If nothing needs flagging, return an empty array.
verdict: "addressed" if all requests addressed, "partly" if some, "not_addressed" if none.
Decision notes: ${JSON.stringify(data.notes)}
PREVIOUS (v${data.version - 1}): ${JSON.stringify(shape(prev))}
RESUBMITTED (v${data.version}): ${JSON.stringify(shape(cur))}
Image file changed: ${imageChanged}
Reply with ONLY JSON: {"verdict":"","summary":"","summaryAr":"","requests":[{"request":"","requestAr":"","status":"","evidence":"","evidenceAr":""}],"flags":[{"area":"","reason":"","reasonAr":"","severity":""}]}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", stream: true, store: false,
        reasoning: { effort: "medium", summary: "auto" }, include: ["reasoning.encrypted_content"],
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
      }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      console.error(`Resubmission compare AI failed [${res.status}]: ${msg}`);
      if (res.status === 429) return { error: "Too many requests — please try again shortly." };
      if (res.status === 403 && msg.includes("credit_limit")) return { error: "The workspace AI spending limit has been reached. A workspace admin can raise it in workspace settings." };
      if (res.status === 402) return { error: "AI credits are used up for this workspace." };
      return { error: `AI request failed (${res.status}).` };
    }
    let text = "";
    try { text = await readText(res); } catch (e) { return { error: e instanceof Error ? e.message : "AI error" }; }
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { error: "The AI returned no assessment." };
    try { return { result: VersionCompare.parse(JSON.parse(json)) }; } catch { return { error: "The AI returned an unreadable answer." }; }
  });

const RecurringResult = z.object({
  summary: z.string().default(""), summaryAr: z.string().default(""),
  issues: z.array(z.object({ issue: z.string(), issueAr: z.string().default(""), field: z.string().default("other"),
    versions: z.array(z.number()).default([]), status: z.string().default("unresolved"), evidence: z.string().default(""), evidenceAr: z.string().default("") })).default([]),
  checks: z.array(z.object({ check: z.string(), checkAr: z.string().default(""), field: z.string().default("other"), priority: z.string().default("medium") })).default([]),
});
export type RecurringIssuesResult = z.infer<typeof RecurringResult>;

/** Staff-only: reads every version, reviewer note and private field comment, and asks the AI which issues keep coming back. */
export const findRecurringIssues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ draftId: z.string().uuid(), extra: z.string().trim().max(3000).default("") }).parse(d))
  .handler(async ({ data, context }): Promise<{ result?: RecurringIssuesResult; error?: string }> => {
    try { await assertStaff(context.supabase as never, context.userId); } catch { return { error: "Staff only." }; }
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };
    const sb = context.supabase as any;
    const [{ data: vs }, { data: cs }] = await Promise.all([
      sb.from("listing_draft_versions").select("version,title,title_ar,description,description_ar,alt_text,alt_text_ar,tags,medium,image_path,previous_review_note").eq("draft_id", data.draftId).order("version").limit(20),
      sb.from("listing_version_comments").select("version,field,body,created_at").eq("draft_id", data.draftId).order("created_at").limit(200),
    ]);
    const versions = (vs ?? []) as any[];
    if (!versions.length) return { error: "This listing has no revision history yet." };
    const history = versions.map((v, i) => ({ version: v.version, reviewerNoteBeforeThis: v.previous_review_note, title: v.title, titleAr: v.title_ar,
      description: v.description, descriptionAr: v.description_ar, altText: v.alt_text, altTextAr: v.alt_text_ar, tags: v.tags, medium: v.medium,
      imageChanged: i > 0 ? v.image_path !== versions[i - 1].image_path : null }));
    const prompt = `You assist moderators at Arwiqa, a Saudi-based global art marketplace. Below is a listing's full revision history (each version, the reviewer note that preceded it) and moderators' PRIVATE field comments.
Find RECURRING issues: problems raised in more than one note/comment or that reappear across versions. For each give: issue (EN) + issueAr, field (title|description|alt_text|tags|medium|image|price|other), versions where it appears, status ("unresolved" if still present in the latest version, "resolved" if fixed, "unclear" if it can't be judged from text, e.g. image content), short evidence quoting the text (EN + AR).
Then suggest 3–6 focused checks for the NEXT review, highest risk first, each with field and priority (high|medium|low). Base everything only on the provided material; do not invent new policy requirements. If nothing recurs, return an empty issues array and still suggest checks for any unresolved notes.
Give a 1–2 sentence summary (EN + AR).
${data.extra ? `Moderator's extra context: ${JSON.stringify(data.extra)}\n` : ""}HISTORY: ${JSON.stringify(history)}
PRIVATE COMMENTS: ${JSON.stringify(cs ?? [])}
Reply with ONLY JSON: {"summary":"","summaryAr":"","issues":[{"issue":"","issueAr":"","field":"","versions":[1],"status":"","evidence":"","evidenceAr":""}],"checks":[{"check":"","checkAr":"","field":"","priority":""}]}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({ model: "openai/gpt-6-astra", stream: true, store: false,
        reasoning: { effort: "medium", summary: "auto" }, include: ["reasoning.encrypted_content"],
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }] }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      console.error(`Recurring issues AI failed [${res.status}]: ${msg}`);
      if (res.status === 429) return { error: "Too many requests — please try again shortly." };
      if (res.status === 403 && msg.includes("credit_limit")) return { error: "The workspace AI spending limit has been reached. A workspace admin can raise it in workspace settings." };
      if (res.status === 402) return { error: "AI credits are used up for this workspace." };
      return { error: `AI request failed (${res.status}).` };
    }
    let text = "";
    try { text = await readText(res); } catch (e) { return { error: e instanceof Error ? e.message : "AI error" }; }
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { error: "The AI returned no analysis." };
    try { const r = RecurringResult.parse(JSON.parse(json)); return { result: { ...r, checks: r.checks.slice(0, 6) } }; } catch { return { error: "The AI returned an unreadable answer." }; }
  });

const EvidenceResult = z.object({
  risk: z.string().default("medium"),
  summary: z.string().default(""), summaryAr: z.string().default(""),
  inconsistencies: z.array(z.object({ issue: z.string(), issueAr: z.string().default(""), photo: z.string().default("all"), severity: z.string().default("medium") })).default([]),
  missingEvidence: z.array(z.object({ item: z.string(), itemAr: z.string().default(""), why: z.string().default(""), whyAr: z.string().default("") })).default([]),
  checks: z.array(z.object({ check: z.string(), checkAr: z.string().default("") })).default([]),
});
export type EvidenceCheckResult = z.infer<typeof EvidenceResult>;

/** Staff-only: compares a listing's photos (its main image + up to 5 staff-uploaded ones) against its description and flags visual inconsistencies and missing evidence. */
export const checkListingEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    draftId: z.string().uuid(),
    extraPaths: z.array(z.string().min(3).max(300)).max(5).default([]),
    description: z.string().trim().max(6000).default(""),
  }).parse(d))
  .handler(async ({ data, context }): Promise<{ result?: EvidenceCheckResult; error?: string }> => {
    try { await assertStaff(context.supabase as never, context.userId); } catch { return { error: "Staff only." }; }
    if (data.extraPaths.some((p) => !p.startsWith(`${context.userId}/`))) return { error: "Extra photos must be ones you uploaded." };
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: d } = await supabaseAdmin.from("listing_drafts").select("title,title_ar,description,description_ar,alt_text,medium,tags,category,price,image_path").eq("id", data.draftId).single();
    if (!d) return { error: "Listing not found." };
    const paths = [...(d.image_path ? [d.image_path] : []), ...data.extraPaths];
    if (!paths.length) return { error: "Add at least one photo to check." };
    const images: { type: "input_image"; image_url: string }[] = [];
    for (const p of paths) {
      const { data: blob } = await supabaseAdmin.storage.from("artwork-images").download(p);
      if (!blob) continue;
      const mime = blob.type || "image/jpeg";
      if (!/^image\/(png|jpeg|webp|gif)$/.test(mime)) continue;
      images.push({ type: "input_image", image_url: `data:${mime};base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}` });
    }
    if (!images.length) return { error: "The photos couldn't be read." };
    const desc = data.description || `${d.description}\n\n${d.description_ar}`;
    const prompt = `You help moderators at Arwiqa, a Saudi-based global art & heritage marketplace, review a listing's photos against its written claims.
Photos are numbered in order: photo 1 is the seller's main image${data.extraPaths.length ? `, photos 2–${images.length} were added by the moderator (e.g. back, signature, detail, certificate)` : ""}.
1) inconsistencies: things in the photos that contradict the text or each other — different medium, size cues, colours, subject, signature/date mismatch, signs of a print sold as an original, digital mock-up, stock/watermarked image, other artwork or brand logos, damage not disclosed. Give "photo" as "1", "2"… or "all", severity high|medium|low.
2) missingEvidence: evidence a reviewer would expect but can't see, based on the claims (e.g. signature close-up, back of canvas, certificate of authenticity, edition number for prints, provenance for heritage/antique claims, condition detail, scale reference, export permit for cultural objects). Include why it's needed.
3) checks: 2–5 concrete things the moderator should verify next.
risk: low|medium|high overall. summary 1–2 sentences.
Only flag what the photos and text actually support; say "can't tell from the photos" rather than guessing. Don't invent policy. English + Arabic for every text field.
LISTING: ${JSON.stringify({ title: d.title, titleAr: d.title_ar, medium: d.medium, category: d.category, price: d.price, tags: d.tags, altText: d.alt_text, description: desc })}
Reply with ONLY JSON: {"risk":"","summary":"","summaryAr":"","inconsistencies":[{"issue":"","issueAr":"","photo":"","severity":""}],"missingEvidence":[{"item":"","itemAr":"","why":"","whyAr":""}],"checks":[{"check":"","checkAr":""}]}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({ model: "openai/gpt-6-astra", stream: true, store: false,
        reasoning: { effort: "medium", summary: "auto" }, include: ["reasoning.encrypted_content"],
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }, ...images] }] }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      console.error(`Evidence check AI failed [${res.status}]: ${msg}`);
      if (res.status === 429) return { error: "Too many requests — please try again shortly." };
      if (res.status === 403 && msg.includes("credit_limit")) return { error: "The workspace AI spending limit has been reached. A workspace admin can raise it in workspace settings." };
      if (res.status === 402) return { error: "AI credits are used up for this workspace." };
      return { error: `AI request failed (${res.status}).` };
    }
    let text = "";
    try { text = await readText(res); } catch (e) { return { error: e instanceof Error ? e.message : "AI error" }; }
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { error: "The AI returned no assessment." };
    try { return { result: EvidenceResult.parse(JSON.parse(json)) }; } catch { return { error: "The AI returned an unreadable answer." }; }
  });
