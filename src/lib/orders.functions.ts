import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { priceCart } from "./pricing";

const cartItem = z.union([
  z.object({ key: z.string().max(200), kind: z.literal("artwork"), listingId: z.string().max(100), variantId: z.string().max(50), qty: z.number().int().min(1).max(10) }),
  z.object({ key: z.string().max(200), kind: z.literal("ticket"), exhibitionId: z.string().max(100), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), slot: z.string().max(20), tickets: z.record(z.string().max(20), z.number().int().min(0).max(20)) }),
  z.object({ key: z.string().max(200), kind: z.literal("supply"), supplyId: z.string().max(100), qty: z.number().int().min(1).max(20) }),
]);

const input = z.object({
  items: z.array(cartItem).min(1).max(30),
  contact: z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().email().max(255), phone: z.string().trim().max(30).optional().default("") }),
  address: z.object({ line: z.string().trim().max(200), city: z.string().trim().max(100), country: z.string().trim().max(100), postal: z.string().trim().max(20) }).nullable(),
  paymentMethod: z.enum(["card", "mada", "applepay", "stcpay", "bank"]),
  idempotencyKey: z.string().uuid(),
});

/** Creates an order priced on the server; payment is captured later once a provider is connected. */
export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Duplicate submit (double click / network retry): return the order already created with this key.
    const { data: existing } = await supabase.from("orders").select("id, reference").eq("user_id", userId).eq("idempotency_key", data.idempotencyKey).maybeSingle();
    if (existing) return { ok: true as const, orderId: existing.id, reference: existing.reference };
    const { data: ps } = await (supabase as any).from("platform_settings").select("commercial_multiplier, extended_multiplier").eq("id", 1).maybeSingle();
    if (ps) { const { licenseRates } = await import("./license-rates"); licenseRates.commercial = Number(ps.commercial_multiplier); licenseRates.extended = Number(ps.extended_multiplier); }
    // Supplier products are priced from the database, never from the client.
    const supplierIds = data.items.flatMap((i) => (i.kind === "supply" && /^[0-9a-f-]{36}$/.test(i.supplyId) ? [i.supplyId] : []));
    let extra: import("./data").Supply[] = [];
    if (supplierIds.length) {
      const { SUPPLIER_PRODUCT_SELECT, rowToSupply } = await import("./supplier");
      const { data: rows } = await (supabase as any).from("supplier_products").select(SUPPLIER_PRODUCT_SELECT).in("id", supplierIds).eq("status", "published");
      extra = (rows ?? []).map(rowToSupply);
      for (const i of data.items) if (i.kind === "supply") { const p = extra.find((x) => x.id === i.supplyId); if (p && (p.stock ?? 0) < i.qty) return { ok: false as const, error: (p.stock ?? 0) <= 0 ? "OUT_OF_STOCK" : "NOT_ENOUGH_STOCK" }; }
    }
    const priced = priceCart(data.items, extra);
    if (priced.errors.length) return { ok: false as const, error: priced.errors.join("; ") };
    // Seller authorization: listing must be live; agent-sold listings need a valid, owner-approved license covering this format.
    const usedOffers: string[] = [];
    const wanted = new Map<string, number>();
    for (const l of priced.lines.filter((x) => x.kind !== "ticket" && x.kind !== "supply")) {
      const listingId = String(l.ref["listingId"]);
      const { data: row } = await supabase.from("listings").select("id, status, stock").eq("id", listingId).maybeSingle();
      if (!row || row.status !== "published") return { ok: false as const, error: "LISTING_UNAVAILABLE" };
      // Stock: physical items (originals, prints) can't exceed what the seller has left.
      if (l.kind !== "license" && row.stock != null) {
        const need = (wanted.get(listingId) ?? 0) + l.qty; wanted.set(listingId, need);
        if (row.stock <= 0) return { ok: false as const, error: "OUT_OF_STOCK" };
        if (need > row.stock) return { ok: false as const, error: "NOT_ENOUGH_STOCK" };
      }
      const { data: auth, error: ae } = await supabase.rpc("agent_authorization_valid", { _listing: listingId, _kind: l.kind });
      if (ae || (auth !== "OWNER" && auth !== "AGENT_OK")) return { ok: false as const, error: String(auth ?? "SELLER_NOT_AUTHORIZED") };
      // Accepted offer: the buyer pays the agreed price for the original, once.
      if (l.kind === "original") {
        const { data: off } = await (supabase as any).from("offers").select("id, amount").eq("listing_id", listingId).eq("user_id", userId).eq("status", "accepted").is("used_order_id", null).order("updated_at", { ascending: false }).limit(1).maybeSingle();
        if (off && Number(off.amount) > 0 && Number(off.amount) < l.unit) {
          l.unit = Number(off.amount); l.amount = l.unit * l.qty; l.detail = `${l.detail} · Accepted offer`; usedOffers.push(off.id);
        }
      }
    }
    if (usedOffers.length) {
      const { VAT_RATE } = await import("./pricing");
      priced.subtotal = priced.lines.reduce((s, x) => s + x.amount, 0);
      priced.vat = Math.round((priced.subtotal + priced.shipping) * VAT_RATE * 100) / 100;
      priced.total = Math.round((priced.subtotal + priced.shipping + priced.vat) * 100) / 100;
    }
    if (priced.needsShipping && (!data.address || !data.address.line || !data.address.city || !data.address.country)) return { ok: false as const, error: "Shipping address is required" };

    const { data: order, error } = await supabase.from("orders").insert({
      user_id: userId,
      items: priced.lines.map((l) => ({ kind: l.kind, title: l.title, titleAr: l.titleAr, detail: l.detail, unit: l.unit, qty: l.qty, amount: l.amount, ...l.ref })),
      subtotal: priced.subtotal, vat: priced.vat, shipping: priced.shipping, total: priced.total,
      contact: data.contact, shipping_address: priced.needsShipping ? data.address : null, payment_method: data.paymentMethod, idempotency_key: data.idempotencyKey,
    }).select("id, reference").single();
    if (error?.code === "23505") {
      const { data: again } = await supabase.from("orders").select("id, reference").eq("user_id", userId).eq("idempotency_key", data.idempotencyKey).maybeSingle();
      if (again) return { ok: true as const, orderId: again.id, reference: again.reference };
    }
    for (const code of ["OUT_OF_STOCK", "NOT_ENOUGH_STOCK", "LISTING_UNAVAILABLE"]) if (error?.message?.includes(code)) return { ok: false as const, error: code };
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
    for (const id of usedOffers) await (supabase as any).rpc("consume_accepted_offer", { _offer: id, _order: order.id });
    await supabase.from("cart_items").delete().eq("user_id", userId);
    return { ok: true as const, orderId: order.id, reference: order.reference };
  });
