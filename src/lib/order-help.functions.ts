import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readText } from "./advisor.functions";

export type OrderHelpAnswer = { answer?: string; answerAr?: string; orders?: string[]; noOrders?: boolean; error?: string };

/** Answers a buyer's order/shipment question using only that buyer's own orders (RLS applies as the caller). */
export const askOrderHelp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ question: z.string().trim().min(3).max(1000) }).parse(d))
  .handler(async ({ data, context }): Promise<OrderHelpAnswer> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };

    const { data: orders, error } = await context.supabase.from("orders")
      .select("id, reference, status, items, subtotal, vat, shipping, total, currency, payment_method, payment_error, shipping_address, created_at")
      .eq("user_id", context.userId).order("created_at", { ascending: false }).limit(20);
    if (error) return { error: "Couldn't load your orders." };
    if (!orders?.length) return { noOrders: true };

    const ids = orders.map((o) => o.id);
    const [{ data: events }, { data: refunds }] = await Promise.all([
      context.supabase.from("order_events").select("order_id, from_status, to_status, note, created_at").in("order_id", ids).order("created_at"),
      context.supabase.from("refund_requests").select("order_id, kind, status, decision_note, created_at").in("order_id", ids),
    ]);

    const history = orders.map((o) => {
      const addr = o.shipping_address as { city?: string; country?: string } | null;
      return {
        reference: o.reference, status: o.status, placed: o.created_at, total: `${o.total} ${o.currency}`,
        payment: o.payment_method, paymentError: o.payment_error,
        shipTo: addr ? [addr.city, addr.country].filter(Boolean).join(", ") : null,
        items: (o.items as { title?: string; variant?: string; qty?: number }[] ?? []).map((i) => ({ title: i.title, option: i.variant, qty: i.qty })),
        timeline: (events ?? []).filter((e) => e.order_id === o.id).map((e) => ({ to: e.to_status, note: e.note, at: e.created_at })),
        refunds: (refunds ?? []).filter((r) => r.order_id === o.id).map((r) => ({ kind: r.kind, status: r.status, note: r.decision_note })),
      };
    });

    const prompt = `You are the customer-care assistant for the Arwiqa art marketplace. Answer the buyer's question using ONLY their order history below. Quote order references and dates. If the history doesn't contain the answer, say so plainly and suggest contacting support — never invent tracking numbers, dates or policies.
Reply with ONLY JSON: {"answer":"short helpful English answer (max 5 sentences)","answerAr":"the same answer in Arabic","orders":["referenced order references"]}

Order history (newest first):
${JSON.stringify(history)}

Question:
${data.question}`;

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
    if (!json) return { error: "The assistant returned no answer." };
    try {
      const p = JSON.parse(json) as OrderHelpAnswer;
      const known = new Set(orders.map((o) => o.reference));
      return { answer: p.answer ?? "", answerAr: p.answerAr ?? "", orders: (p.orders ?? []).filter((r) => known.has(r)) };
    } catch { return { error: "The assistant returned an unreadable answer." }; }
  });
