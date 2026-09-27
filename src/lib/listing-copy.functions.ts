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
