import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readText } from "./advisor.functions";

export type Bi = { en: string; ar: string };
export type SupplierReview = { summary: Bi; range: Bi; missing: Bi[]; concerns: Bi[]; suggestion: "approve" | "needs_changes"; suggestionWhy: Bi };

/** Rule-based gaps the AI can't overlook; shown alongside its summary. */
export function missingInfo(acc: Record<string, any>, products: Record<string, any>[]): Bi[] {
  const m: Bi[] = [];
  if (!acc.name_ar?.trim()) m.push({ en: "Arabic shop name", ar: "اسم المتجر بالعربية" });
  if (!acc.city?.trim()) m.push({ en: "City", ar: "المدينة" });
  if (!acc.phone?.trim() && !acc.email?.trim()) m.push({ en: "Contact phone or email", ar: "رقم تواصل أو بريد" });
  if ((acc.about ?? "").trim().length < 30) m.push({ en: "Shop description (English)", ar: "نبذة المتجر بالإنجليزية" });
  if ((acc.about_ar ?? "").trim().length < 30) m.push({ en: "Shop description (Arabic)", ar: "نبذة المتجر بالعربية" });
  if (!products.length) m.push({ en: "At least one product", ar: "منتج واحد على الأقل" });
  const noDesc = products.filter((p) => !(p.description ?? "").trim() || !(p.description_ar ?? "").trim()).length;
  if (noDesc) m.push({ en: `Bilingual description for ${noDesc} product(s)`, ar: `وصف باللغتين لعدد ${noDesc} من المنتجات` });
  const noStock = products.filter((p) => Number(p.stock) <= 0).length;
  if (noStock) m.push({ en: `Stock for ${noStock} product(s)`, ar: `مخزون لعدد ${noStock} من المنتجات` });
  return m;
}

const bi = { type: "object", additionalProperties: false, required: ["en", "ar"], properties: { en: { type: "string" }, ar: { type: "string" } } };
const schema = { type: "object", additionalProperties: false, required: ["summary", "range", "missing", "concerns", "suggestion", "suggestionWhy"],
  properties: { summary: bi, range: bi, missing: { type: "array", items: bi }, concerns: { type: "array", items: bi }, suggestion: { type: "string", enum: ["approve", "needs_changes"] }, suggestionWhy: bi } };

/** Staff-only AI review summary of a supplier application. Advisory only: staff make the decision. */
export const summarizeSupplierApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ review?: SupplierReview; rules: Bi[]; error?: string }> => {
    const { data: staff } = await context.supabase.rpc("is_staff", { _uid: context.userId });
    if (!staff) throw new Error("Staff only");
    const sb = context.supabase as any;
    const { data: acc } = await sb.from("supplier_accounts").select("name,name_ar,city,city_ar,phone,email,about,about_ar,status,created_at").eq("user_id", data.userId).maybeSingle();
    if (!acc) return { rules: [], error: "Application not found." };
    const { data: products } = await sb.from("supplier_products").select("name,name_ar,description,description_ar,type,price,stock,status").eq("supplier_id", data.userId).limit(100);
    const rules = missingInfo(acc, products ?? []);
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { rules, error: "AI is not configured." };

    const prompt = `You help staff of Arwiqa, a Saudi art marketplace, review an application from an art-supplies seller (paints, brushes, canvas, qalam, clay, textiles).
Write, each in English (en) and natural Arabic (ar):
- summary: 2-3 sentences on who the shop is, from the submitted details.
- range: 1-2 sentences on the product range — types, count, price span in SAR, stock levels.
- missing: information a buyer or staff would need that is absent or too thin (beyond these already-detected gaps: ${JSON.stringify(rules.map((r) => r.en))}). Empty if none.
- concerns: anything that looks off-topic for art supplies, inconsistent, implausible prices, or possible policy issues. Empty if none. Never speculate about the person.
- suggestion: "approve" or "needs_changes", with suggestionWhy (one sentence). This is advice only; staff decide.
Use only the data below.
Shop: ${JSON.stringify({ ...acc, phone: acc.phone ? "provided" : "", email: acc.email ? "provided" : "" })}
Products: ${JSON.stringify(products ?? [])}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", input: prompt, stream: true, store: false,
        reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"],
        text: { format: { type: "json_schema", name: "supplier_review", strict: true, schema } },
      }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      if (res.status === 429) return { rules, error: "Too many requests — please try again shortly." };
      if (res.status === 403 && msg.includes("credit_limit")) return { rules, error: "The workspace AI spending limit has been reached. A workspace admin can raise it in workspace settings." };
      if (res.status === 402) return { rules, error: "AI credits are used up for this workspace." };
      return { rules, error: `AI request failed (${res.status}).` };
    }
    try { return { rules, review: JSON.parse(await readText(res)) as SupplierReview }; }
    catch (e) { return { rules, error: e instanceof Error && !(e instanceof SyntaxError) ? e.message : "The AI returned an unreadable answer." }; }
  });
