import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readText } from "./advisor.functions";

export type ListingCopy = {
  title: string; titleAr: string;
  description: string; descriptionAr: string;
  altText: string; altTextAr: string;
  tags: string[];
};
export type ListingCopyResult = { copy?: ListingCopy; error?: string };

const Copy = z.object({
  title: z.string(), titleAr: z.string(), description: z.string(), descriptionAr: z.string(),
  altText: z.string(), altTextAr: z.string(), tags: z.array(z.string()).max(10),
});

export const generateListingCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    path: z.string().min(3).max(300),
    notes: z.string().max(600).default(""),
    medium: z.string().max(100).default(""),
  }).parse(d))
  .handler(async ({ data, context }): Promise<ListingCopyResult> => {
    // Seller can only analyze images in their own folder.
    if (!data.path.startsWith(`${context.userId}/`)) return { error: "You can only describe your own uploads." };
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };

    const { data: blob, error: dlErr } = await context.supabase.storage.from("artwork-images").download(data.path);
    if (dlErr || !blob || blob.size === 0) return { error: "The uploaded image couldn't be read. Please upload it again." };
    const mime = blob.type || "image/jpeg";
    if (!/^image\/(png|jpeg|webp|gif)$/.test(mime)) return { error: "Please upload a PNG, JPG, WEBP or GIF image." };
    const b64 = Buffer.from(await blob.arrayBuffer()).toString("base64");

    const prompt = `You write listing copy for Arwiqa, a Saudi art marketplace. Look at the artwork image and write:
- title: evocative, max 6 words (English) and titleAr (Arabic)
- description: 60-110 words, describe composition, palette, mood, technique; no invented facts about the artist, no prices (English) and descriptionAr (natural Arabic, not literal)
- altText: objective accessibility alt text, max 140 characters, describe what is visible, don't start with "Image of" (English) and altTextAr (Arabic)
- tags: 3-8 short lowercase English tags
Seller medium: ${data.medium || "unknown"}. Seller notes: ${data.notes || "none"}.
Reply with ONLY JSON: {"title":"","titleAr":"","description":"","descriptionAr":"","altText":"","altTextAr":"","tags":[]}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", stream: true, store: false,
        reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"],
        input: [{ role: "user", content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: `data:${mime};base64,${b64}` },
        ] }],
      }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      console.error(`Listing copy AI failed [${res.status}]: ${msg}`);
      if (res.status === 429) return { error: "Too many requests — please try again shortly." };
      if (res.status === 403 && msg.includes("credit_limit")) return { error: "The workspace AI spending limit has been reached. A workspace admin can raise it in workspace settings." };
      if (res.status === 402) return { error: "AI credits are used up for this workspace." };
      return { error: `AI request failed (${res.status}).` };
    }
    let text = "";
    try { text = await readText(res); } catch (e) { return { error: e instanceof Error ? e.message : "AI error" }; }
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { error: "The AI returned no copy for this image." };
    try { return { copy: Copy.parse(JSON.parse(json)) }; }
    catch { return { error: "The AI returned an unreadable answer." }; }
  });

const Revised = z.object({ title: z.string(), titleAr: z.string(), description: z.string(), descriptionAr: z.string() });
export type RevisedCopy = z.infer<typeof Revised>;

/** Rewrites an existing title + description in both languages following the seller's revision instructions. */
export const reviseListingCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    instructions: z.string().trim().min(3).max(1000),
    current: z.object({
      title: z.string().max(200), titleAr: z.string().max(200),
      description: z.string().max(4000), descriptionAr: z.string().max(4000),
    }),
    medium: z.string().max(160).default(""),
  }).parse(d))
  .handler(async ({ data }): Promise<{ copy?: RevisedCopy; error?: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };
    const prompt = `You edit artwork listings for the Arwiqa art marketplace. Rewrite the title and description following the seller's instructions. Keep facts that are already there; never invent sizes, dates, editions or provenance. Titles max 80 characters. The Arabic must be natural Modern Standard Arabic and say the same thing as the English — not a word-for-word translation.
Reply with ONLY JSON: {"title":"...","titleAr":"...","description":"...","descriptionAr":"..."}

Medium: ${data.medium || "unknown"}
Current listing:
${JSON.stringify(data.current)}

Seller's revision instructions:
${data.instructions}`;
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
      console.error(`Listing revise AI failed [${res.status}]: ${msg}`);
      if (res.status === 429) return { error: "Too many requests — please try again shortly." };
      if (res.status === 403 && msg.includes("credit_limit")) return { error: "The workspace AI spending limit has been reached. A workspace admin can raise it in workspace settings." };
      if (res.status === 402) return { error: "AI credits are used up for this workspace." };
      return { error: `AI request failed (${res.status}).` };
    }
    let text = "";
    try { text = await readText(res); } catch (e) { return { error: e instanceof Error ? e.message : "AI error" }; }
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { error: "The AI returned no revision." };
    try { return { copy: Revised.parse(JSON.parse(json)) }; }
    catch { return { error: "The AI returned an unreadable answer." }; }
  });

const AltReview = z.object({
  verdict: z.enum(["accurate", "partly", "inaccurate"]),
  summary: z.string(), summaryAr: z.string(),
  issues: z.array(z.string()).max(8), issuesAr: z.array(z.string()).max(8),
  suggestion: z.string(), suggestionAr: z.string(),
  gaps: z.array(z.object({ gap: z.string(), gapAr: z.string().default(""), severity: z.string().default("medium") })).max(10).default([]),
});
export type AltReview = z.infer<typeof AltReview>;

/** Checks the seller's current alt text against their uploaded image and suggests a clearer bilingual alternative. */
export const reviewAltText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    path: z.string().min(3).max(300),
    altText: z.string().trim().min(1).max(1000),
    details: z.object({ title: z.string().max(200).default(""), medium: z.string().max(100).default(""), description: z.string().max(4000).default("") }).optional(),
  }).parse(d))
  .handler(async ({ data, context }): Promise<{ review?: AltReview; error?: string }> => {
    if (!data.path.startsWith(`${context.userId}/`)) return { error: "You can only check your own uploads." };
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };
    const { data: blob, error: dlErr } = await context.supabase.storage.from("artwork-images").download(data.path);
    if (dlErr || !blob || blob.size === 0) return { error: "The uploaded image couldn't be read. Please upload it again." };
    const mime = blob.type || "image/jpeg";
    if (!/^image\/(png|jpeg|webp|gif)$/.test(mime)) return { error: "Please upload a PNG, JPG, WEBP or GIF image." };
    const b64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
    const prompt = `You are an accessibility reviewer for Arwiqa, a Saudi art marketplace. Compare the seller's current alt text with the artwork image.
- verdict: "accurate" (describes what is visible), "partly" (vague, missing key subject/colours/composition, or contains unverifiable claims), or "inaccurate" (describes things not visible or wrong).
- summary (English, 1-2 sentences) and summaryAr (Arabic).
- issues: short concrete problems (e.g. wrong colour, starts with "image of", too long, subjective praise, missing main subject); issuesAr same in Arabic. Empty arrays if none.
- suggestion: clearer objective alt text, max 140 characters, describe only what is visible, no "image of"; suggestionAr natural Arabic equivalent, max 140 characters.
- gaps: accessibility gaps with severity high|medium|low, e.g. main subject missing, visible text/calligraphy not transcribed, colours or contrast important to meaning not mentioned, alt text contradicts the listing's medium/title, relies on the title alone, over 140 characters, jargon, detail needed for a long description is missing from the listing description. Each with gapAr in Arabic. Empty array if none.
Use the listing details only as context to judge consistency; describe only what is visible.
${data.details ? `Listing details: ${JSON.stringify(data.details)}\n` : ""}Current alt text: ${JSON.stringify(data.altText)}
Reply with ONLY JSON: {"verdict":"","summary":"","summaryAr":"","issues":[],"issuesAr":[],"suggestion":"","suggestionAr":"","gaps":[{"gap":"","gapAr":"","severity":""}]}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", stream: true, store: false,
        reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"],
        input: [{ role: "user", content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: `data:${mime};base64,${b64}` },
        ] }],
      }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      console.error(`Alt review AI failed [${res.status}]: ${msg}`);
      if (res.status === 429) return { error: "Too many requests — please try again shortly." };
      if (res.status === 403 && msg.includes("credit_limit")) return { error: "The workspace AI spending limit has been reached. A workspace admin can raise it in workspace settings." };
      if (res.status === 402) return { error: "AI credits are used up for this workspace." };
      return { error: `AI request failed (${res.status}).` };
    }
    let text = "";
    try { text = await readText(res); } catch (e) { return { error: e instanceof Error ? e.message : "AI error" }; }
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { error: "The AI returned no review." };
    try { return { review: AltReview.parse(JSON.parse(json)) }; }
    catch { return { error: "The AI returned an unreadable answer." }; }
  });

const MobileReview = z.object({
  verdict: z.enum(["clear", "needs_work"]),
  summary: z.string(), summaryAr: z.string(),
  tips: z.array(z.object({ field: z.enum(["title", "description", "altText"]), issue: z.string(), issueAr: z.string() })).max(10),
  title: z.string(), titleAr: z.string(),
  description: z.string(), descriptionAr: z.string(),
  altText: z.string(), altTextAr: z.string(),
});
export type MobileReview = z.infer<typeof MobileReview>;

/** Assesses whether listing copy reads clearly on a phone (with the image for context) and suggests concise bilingual rewrites. */
export const reviewMobileCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    path: z.string().min(3).max(300).nullable(),
    copy: z.object({
      title: z.string().max(200), titleAr: z.string().max(200),
      description: z.string().max(4000), descriptionAr: z.string().max(4000),
      altText: z.string().max(1000), altTextAr: z.string().max(1000),
    }),
  }).parse(d))
  .handler(async ({ data, context }): Promise<{ review?: MobileReview; error?: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };
    const content: unknown[] = [];
    if (data.path) {
      if (!data.path.startsWith(`${context.userId}/`)) return { error: "You can only check your own uploads." };
      const { data: blob } = await context.supabase.storage.from("artwork-images").download(data.path);
      const mime = blob?.type || "image/jpeg";
      if (blob && blob.size > 0 && /^image\/(png|jpeg|webp|gif)$/.test(mime))
        content.push({ type: "input_image", image_url: `data:${mime};base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}` });
    }
    const prompt = `You review artwork listings for Arwiqa, a Saudi art marketplace, for how they read on a phone (about 360px wide, title ~2 lines max, description skimmed in the first 2-3 short sentences, screen-reader alt text).
Assess clarity of the English and Arabic title, description and alt text. Use the image (if provided) only to check the alt text matches what is visible. Never invent facts, sizes, dates or provenance.
- verdict: "clear" or "needs_work"
- summary / summaryAr: 1-2 sentences
- tips: concrete, concise issues, each with field "title" | "description" | "altText", issue (English) and issueAr (Arabic)
- improved versions: title/titleAr max 50 characters; description/descriptionAr max 90 words with short paragraphs, key point first; altText/altTextAr max 140 characters, objective, no "image of". Arabic must be natural Modern Standard Arabic.
Current listing: ${JSON.stringify(data.copy)}
Reply with ONLY JSON: {"verdict":"","summary":"","summaryAr":"","tips":[{"field":"title","issue":"","issueAr":""}],"title":"","titleAr":"","description":"","descriptionAr":"","altText":"","altTextAr":""}`;
    content.unshift({ type: "input_text", text: prompt });
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", stream: true, store: false,
        reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"],
        input: [{ role: "user", content }],
      }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      console.error(`Mobile review AI failed [${res.status}]: ${msg}`);
      if (res.status === 429) return { error: "Too many requests — please try again shortly." };
      if (res.status === 403 && msg.includes("credit_limit")) return { error: "The workspace AI spending limit has been reached. A workspace admin can raise it in workspace settings." };
      if (res.status === 402) return { error: "AI credits are used up for this workspace." };
      return { error: `AI request failed (${res.status}).` };
    }
    let text = "";
    try { text = await readText(res); } catch (e) { return { error: e instanceof Error ? e.message : "AI error" }; }
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { error: "The AI returned no review." };
    try { return { review: MobileReview.parse(JSON.parse(json)) }; }
    catch { return { error: "The AI returned an unreadable answer." }; }
  });

const SearchTerms = z.object({
  summary: z.string(), summaryAr: z.string(),
  terms: z.array(z.object({ term: z.string(), termAr: z.string(), intent: z.string(), intentAr: z.string() })).max(15),
  tags: z.array(z.object({ tag: z.string(), tagAr: z.string(), reason: z.string(), reasonAr: z.string() })).max(15),
});
export type SearchTerms = z.infer<typeof SearchTerms>;

/** Uses the artwork image and listing copy to predict buyer search terms and suggest listing tags. */
export const suggestSearchTerms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    path: z.string().min(3).max(300).nullable(),
    title: z.string().trim().max(200),
    description: z.string().trim().max(4000),
    existingTags: z.array(z.string().max(40)).max(30),
  }).refine((v) => v.path || v.title || v.description, "Add an image or some listing copy.").parse(d))
  .handler(async ({ data, context }): Promise<{ result?: SearchTerms; error?: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };
    const content: Array<Record<string, string>> = [];
    const prompt = `You are a search/SEO specialist for Arwiqa, a Saudi art marketplace with Arabic and English buyers.
From the artwork image (if given) and the listing copy, identify what buyers would likely type to find this artwork, and suggest listing tags.
- summary/summaryAr: 1 sentence on who would search for it.
- terms: 8-12 realistic search phrases (2-5 words) in English with a natural Arabic equivalent termAr, plus intent (e.g. "gift", "majlis decor", "style") and intentAr.
- tags: 8-12 short lowercase single-concept tags (subject, style, colour, medium, room, mood) with Arabic tagAr and a short reason/reasonAr. Don't repeat existing tags. Only describe what is visible or stated; no invented facts.
Title: ${JSON.stringify(data.title)}
Description: ${JSON.stringify(data.description)}
Existing tags: ${JSON.stringify(data.existingTags)}
Reply with ONLY JSON: {"summary":"","summaryAr":"","terms":[{"term":"","termAr":"","intent":"","intentAr":""}],"tags":[{"tag":"","tagAr":"","reason":"","reasonAr":""}]}`;
    content.push({ type: "input_text", text: prompt });
    if (data.path) {
      if (!data.path.startsWith(`${context.userId}/`)) return { error: "You can only use your own uploads." };
      const { data: blob, error } = await context.supabase.storage.from("artwork-images").download(data.path);
      if (error || !blob) return { error: "The uploaded image couldn't be read. Please upload it again." };
      const mime = blob.type || "image/jpeg";
      content.push({ type: "input_image", image_url: `data:${mime};base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}` });
    }
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", stream: true, store: false,
        reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"],
        input: [{ role: "user", content }],
      }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      console.error(`Search terms AI failed [${res.status}]: ${msg}`);
      if (res.status === 429) return { error: "Too many requests — please try again shortly." };
      if (res.status === 403 && msg.includes("credit_limit")) return { error: "The workspace AI spending limit has been reached. A workspace admin can raise it in workspace settings." };
      if (res.status === 402) return { error: "AI credits are used up for this workspace." };
      return { error: `AI request failed (${res.status}).` };
    }
    let text = "";
    try { text = await readText(res); } catch (e) { return { error: e instanceof Error ? e.message : "AI error" }; }
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { error: "The AI returned no suggestions." };
    try { return { result: SearchTerms.parse(JSON.parse(json)) }; }
    catch { return { error: "The AI returned an unreadable answer." }; }
  });

const Focal = z.object({
  focalX: z.number().min(0).max(1), focalY: z.number().min(0).max(1),
  subject: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().min(0).max(1), h: z.number().min(0).max(1) }),
  summary: z.string(), summaryAr: z.string(),
  tips: z.array(z.string()).max(5), tipsAr: z.array(z.string()).max(5),
});
export type FocalResult = z.infer<typeof Focal>;

/** Finds the artwork's focal point and main-subject box so the client can crop to a mobile aspect ratio without losing it. */
export const findFocalPoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ path: z.string().min(3).max(300), ratio: z.enum(["4:5", "1:1", "9:16", "3:4"]) }).parse(d))
  .handler(async ({ data, context }): Promise<{ result?: FocalResult; error?: string }> => {
    if (!data.path.startsWith(`${context.userId}/`)) return { error: "You can only use your own uploads." };
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };
    const { data: blob, error } = await context.supabase.storage.from("artwork-images").download(data.path);
    if (error || !blob) return { error: "The uploaded image couldn't be read. Please upload it again." };
    const mime = blob.type || "image/jpeg";
    const prompt = `You are a photo editor for Arwiqa, an art marketplace. The seller will show this artwork on phones cropped to ${data.ratio} (width:height).
Return coordinates as fractions of the full image (0 = left/top, 1 = right/bottom):
- focalX, focalY: the single most important visual point (main subject, face, signature detail).
- subject: the tightest box {x,y,w,h} containing everything that must stay visible.
- summary/summaryAr: one sentence naming the focal point and how the crop should sit.
- tips/tipsAr: up to 3 short tips (e.g. subject too close to the edge, consider a portrait photo).
Reply with ONLY JSON: {"focalX":0.5,"focalY":0.5,"subject":{"x":0,"y":0,"w":1,"h":1},"summary":"","summaryAr":"","tips":[],"tipsAr":[]}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", stream: true, store: false,
        reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"],
        input: [{ role: "user", content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: `data:${mime};base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}` },
        ] }],
      }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      console.error(`Focal AI failed [${res.status}]: ${msg}`);
      if (res.status === 429) return { error: "Too many requests — please try again shortly." };
      if (res.status === 403 && msg.includes("credit_limit")) return { error: "The workspace AI spending limit has been reached. A workspace admin can raise it in workspace settings." };
      if (res.status === 402) return { error: "AI credits are used up for this workspace." };
      return { error: `AI request failed (${res.status}).` };
    }
    let text = "";
    try { text = await readText(res); } catch (e) { return { error: e instanceof Error ? e.message : "AI error" }; }
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { error: "The AI returned no crop." };
    try { return { result: Focal.parse(JSON.parse(json)) }; }
    catch { return { error: "The AI returned an unreadable answer." }; }
  });

const AltGen = z.object({
  altText: z.string(), altTextAr: z.string(),
  longDescription: z.string().default(""), longDescriptionAr: z.string().default(""),
  notes: z.array(z.string()).default([]), notesAr: z.array(z.string()).default([]),
});
export type AltGen = z.infer<typeof AltGen>;

/** Writes accessible bilingual alt text (≤140 chars) for the seller's own uploaded artwork image. */
export const generateAltText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    path: z.string().min(3).max(300),
    context: z.string().trim().max(500).default(""),
  }).parse(d))
  .handler(async ({ data, context }): Promise<{ alt?: AltGen; error?: string }> => {
    if (!data.path.startsWith(`${context.userId}/`)) return { error: "You can only use your own uploads." };
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };
    const { data: blob, error: dlErr } = await context.supabase.storage.from("artwork-images").download(data.path);
    if (dlErr || !blob || blob.size === 0) return { error: "The uploaded image couldn't be read. Please upload it again." };
    const mime = blob.type || "image/jpeg";
    if (!/^image\/(png|jpeg|webp|gif)$/.test(mime)) return { error: "Please upload a PNG, JPG, WEBP or GIF image." };
    const b64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
    const prompt = `You write accessible alt text for artworks on Arwiqa, a Saudi art marketplace.
Rules for altText (English) and altTextAr (natural Arabic, not a literal translation):
- At most 140 characters each. Describe only what is visible: medium/type if obvious, main subject, key colours, composition.
- Do not start with "image of", "picture of", "photo of" or "صورة". No praise or opinions ("stunning"), no prices, no unverifiable claims (artist, age, value).
- Don't just repeat the title.
longDescription / longDescriptionAr: 2-4 sentences for screen-reader users who want more detail (layout, textures, text or calligraphy visible and what it says if legible). Empty if the image is simple.
notes / notesAr: up to 3 short tips to the seller (e.g. "calligraphy isn't legible — add the text in the description"). Empty arrays if none.
${data.context ? `Seller's context (use only to name things correctly, never to describe what isn't visible): ${JSON.stringify(data.context)}\n` : ""}Reply with ONLY JSON: {"altText":"","altTextAr":"","longDescription":"","longDescriptionAr":"","notes":[],"notesAr":[]}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", stream: true, store: false,
        reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"],
        input: [{ role: "user", content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: `data:${mime};base64,${b64}` },
        ] }],
      }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      console.error(`Alt generate AI failed [${res.status}]: ${msg}`);
      if (res.status === 429) return { error: "Too many requests — please try again shortly." };
      if (res.status === 403 && msg.includes("credit_limit")) return { error: "The workspace AI spending limit has been reached. A workspace admin can raise it in workspace settings." };
      if (res.status === 402) return { error: "AI credits are used up for this workspace." };
      return { error: `AI request failed (${res.status}).` };
    }
    let text = "";
    try { text = await readText(res); } catch (e) { return { error: e instanceof Error ? e.message : "AI error" }; }
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { error: "The AI returned no alt text." };
    try {
      const a = AltGen.parse(JSON.parse(json));
      const clip = (s: string) => s.trim().slice(0, 140);
      return { alt: { ...a, altText: clip(a.altText), altTextAr: clip(a.altTextAr), notes: a.notes.slice(0, 3), notesAr: a.notesAr.slice(0, 3) } };
    } catch { return { error: "The AI returned an unreadable answer." }; }
  });

const AltComplement = z.object({
  revision: z.string(), revisionAr: z.string().default(""),
  repeats: z.array(z.string()).max(10).default([]), repeatsAr: z.array(z.string()).max(10).default([]),
  adds: z.array(z.string()).max(8).default([]), addsAr: z.array(z.string()).max(8).default([]),
  rationale: z.string().default(""), rationaleAr: z.string().default(""),
});
export type AltComplement = z.infer<typeof AltComplement>;

/** Suggests a concise, accurate alt-text revision that complements (doesn't repeat) the listing title and description. */
export const complementAltText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    path: z.string().min(3).max(300),
    altText: z.string().trim().max(1000).default(""),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(4000).default(""),
  }).parse(d))
  .handler(async ({ data, context }): Promise<{ result?: AltComplement; error?: string }> => {
    if (!data.path.startsWith(`${context.userId}/`)) return { error: "You can only use your own uploads." };
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };
    const { data: blob, error: dlErr } = await context.supabase.storage.from("artwork-images").download(data.path);
    if (dlErr || !blob || blob.size === 0) return { error: "The uploaded image couldn't be read. Please upload it again." };
    const mime = blob.type || "image/jpeg";
    if (!/^image\/(png|jpeg|webp|gif)$/.test(mime)) return { error: "Please upload a PNG, JPG, WEBP or GIF image." };
    const b64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
    const prompt = `You revise artwork alt text for Arwiqa, a Saudi art marketplace. A screen reader reads the alt text right before the listing title and description, so the alt text must COMPLEMENT that copy, not repeat it.
Rules for the revision:
- Describe only what is visible in the image: subject, composition, key colours, visible text/calligraphy (transcribe short text).
- Do NOT repeat the title, the artist name, the medium or facts already stated in the description. No price, praise or claims you can't see.
- Keep what is accurate in the saved alt text; fix what is wrong. Max 140 characters. Never start with "image of"/"picture of".
- revisionAr: natural Arabic equivalent, max 140 characters.
Also return:
- repeats / repeatsAr: words or phrases in the SAVED alt text that duplicate the title or description (empty if none).
- adds / addsAr: short notes of the visual information the revision adds that the listing copy doesn't cover.
- rationale / rationaleAr: one sentence explaining the change.
TITLE: ${JSON.stringify(data.title)}
DESCRIPTION: ${JSON.stringify(data.description)}
SAVED ALT TEXT: ${JSON.stringify(data.altText || "(none)")}
Reply with ONLY JSON: {"revision":"","revisionAr":"","repeats":[],"repeatsAr":[],"adds":[],"addsAr":[],"rationale":"","rationaleAr":""}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", stream: true, store: false,
        reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"],
        input: [{ role: "user", content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: `data:${mime};base64,${b64}` },
        ] }],
      }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      console.error(`Alt complement AI failed [${res.status}]: ${msg}`);
      if (res.status === 429) return { error: "Too many requests — please try again shortly." };
      if (res.status === 403 && msg.includes("credit_limit")) return { error: "The workspace AI spending limit has been reached. A workspace admin can raise it in workspace settings." };
      if (res.status === 402) return { error: "AI credits are used up for this workspace." };
      return { error: `AI request failed (${res.status}).` };
    }
    let text = "";
    try { text = await readText(res); } catch (e) { return { error: e instanceof Error ? e.message : "AI error" }; }
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { error: "The AI returned no suggestion." };
    try { return { result: AltComplement.parse(JSON.parse(json)) }; }
    catch { return { error: "The AI returned an unreadable answer." }; }
  });
