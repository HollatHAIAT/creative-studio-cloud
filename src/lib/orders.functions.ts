import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { priceCart } from "./pricing";

const cartItem = z.union([
  z.object({ key: z.string().max(200), kind: z.literal("artwork"), listingId: z.string().max(100), variantId: z.string().max(50), qty: z.number().int().min(1).max(10) }),
  z.object({ key: z.string().max(200), kind: z.literal("ticket"), exhibitionId: z.string().max(100), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), slot: z.string().max(20), tickets: z.record(z.string().max(20), z.number().int().min(0).max(20)) }),
]);

const input = z.object({
  items: z.array(cartItem).min(1).max(30),
  contact: z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().email().max(255), phone: z.string().trim().max(30).optional().default("") }),
  address: z.object({ line: z.string().trim().max(200), city: z.string().trim().max(100), country: z.string().trim().max(100), postal: z.string().trim().max(20) }).nullable(),
  paymentMethod: z.enum(["card", "mada", "applepay", "stcpay", "bank"]),
});

/** Creates an order priced on the server; payment is captured later once a provider is connected. */
export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const priced = priceCart(data.items);
    if (priced.errors.length) return { ok: false as const, error: priced.errors.join("; ") };
    if (priced.needsShipping && (!data.address || !data.address.line || !data.address.city || !data.address.country)) return { ok: false as const, error: "Shipping address is required" };

    const { data: order, error } = await supabase.from("orders").insert({
      user_id: userId,
      items: priced.lines.map((l) => ({ kind: l.kind, title: l.title, titleAr: l.titleAr, detail: l.detail, unit: l.unit, qty: l.qty, amount: l.amount, ...l.ref })),
      subtotal: priced.subtotal, vat: priced.vat, shipping: priced.shipping, total: priced.total,
      contact: data.contact, shipping_address: priced.needsShipping ? data.address : null, payment_method: data.paymentMethod,
    }).select("id, reference").single();
    if (error || !order) { console.error(error); return { ok: false as const, error: "Could not create order" }; }

    for (const l of priced.lines.filter((x) => x.kind === "ticket")) {
      const r = l.ref as { exhibitionId: string; date: string; slot: string; tickets: Record<string, number> };
      const { error: be } = await supabase.from("bookings").insert({
        user_id: userId, order_id: order.id, exhibition_id: r.exhibitionId, visit_date: r.date, slot: r.slot, tickets: r.tickets, quantity: l.qty, total: l.amount,
      });
      if (be) {
        await supabase.from("refund_requests").insert({ order_id: order.id, user_id: userId, kind: "cancel", reason: `Automatic: ${be.message}` });
        const msg = be.message.includes("SLOT_FULL") ? "SLOT_FULL" : be.message.includes("DATE_PASSED") ? "DATE_PASSED" : "Booking failed";
        return { ok: false as const, error: msg, orderId: order.id };
      }
    }
    return { ok: true as const, orderId: order.id, reference: order.reference };
  });
