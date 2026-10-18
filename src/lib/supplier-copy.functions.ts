import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readText } from "./advisor.functions";

export type SupplierCopy = { name: string; nameAr: string; description: string; descriptionAr: string };
const str = { type: "string" } as const;
const schema = { type: "object", additionalProperties: false, required: ["name", "nameAr", "description", "descriptionAr"], properties: { name: str, nameAr: str, description: str, descriptionAr: str } };

/** Turns a supplier's rough product details into a polished bilingual listing. Facts come only from the supplier. */
export const writeSupplierListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    details: z.string().trim().min(10).max(1500),
    type: z.string().max(40).default(""),
    name: z.string().max(160).default(""),
  }).parse(d))
  .handler(async ({ data, context }): Promise<{ copy?: SupplierCopy; error?: string }> => {
    const { data: acc } = await (context.supabase as any).from("supplier_accounts").select("user_id").eq("user_id", context.userId).maybeSingle();
    if (!acc) return { error: "Open a supplier account first." };
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };
    const prompt = `You write product listings for an art-supplies shop on Arwiqa, a Saudi art marketplace. From the supplier's details, write:
- name: clear product name, max 8 words (English); nameAr: natural Arabic name.
- description: 40-90 words for artists — what it is, key specs given (size, quantity, colours, material, origin), what it's good for, care/use tips only if implied. descriptionAr: natural Modern Standard Arabic, not a literal translation.
Use ONLY facts in the details; never invent sizes, brands, certifications, prices or origin. No prices, no exaggerated claims.
Product type: ${data.type || "unknown"}. Current name: ${data.name || "none"}.
Supplier details: ${data.details}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", input: prompt, stream: true, store: false,
        reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"],
        text: { format: { type: "json_schema", name: "supplier_listing", strict: true, schema } },
      }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      if (res.status === 429) return { error: "Too many requests — please try again shortly." };
      if (res.status === 403 && msg.includes("credit_limit")) return { error: "The workspace AI spending limit has been reached. A workspace admin can raise it in workspace settings." };
      if (res.status === 402) return { error: "AI credits are used up for this workspace." };
      return { error: `AI request failed (${res.status}).` };
    }
    try {
      const c = JSON.parse(await readText(res)) as SupplierCopy;
      if (!c.name || !c.nameAr) return { error: "The AI returned no listing." };
      return { copy: { name: c.name.slice(0, 160), nameAr: c.nameAr.slice(0, 160), description: c.description.slice(0, 1500), descriptionAr: c.descriptionAr.slice(0, 1500) } };
    } catch (e) { return { error: e instanceof Error && !(e instanceof SyntaxError) ? e.message : "The AI returned an unreadable answer." }; }
  });
