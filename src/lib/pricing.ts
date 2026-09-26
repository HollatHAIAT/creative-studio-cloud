import { exhibitions, seedListings, variantsOf, type VariantKind } from "./data";
import type { CartItem } from "./store";

export const VAT_RATE = 0.15;
export const SHIPPING_FLAT = 25;

export type PricedLine = {
  key: string; kind: VariantKind | "ticket"; title: string; titleAr: string; detail: string;
  unit: number; qty: number; amount: number; ref: Record<string, unknown>;
};

/** Prices cart lines from the catalog — used by both the browser (display) and the server (authoritative). */
export function priceCart(items: CartItem[]) {
  const lines: PricedLine[] = [];
  const errors: string[] = [];
  for (const it of items) {
    if (it.kind === "artwork") {
      const l = seedListings.find((x) => x.id === it.listingId);
      const v = l && variantsOf(l).find((x) => x.id === it.variantId);
      if (!l || !v) { errors.push(`Unknown item ${it.listingId}`); continue; }
      const qty = v.kind === "original" ? 1 : Math.max(1, Math.min(10, Math.floor(it.qty)));
      const detail = [v.size, v.material, v.license].filter(Boolean).join(" · ");
      lines.push({ key: it.key, kind: v.kind, title: l.title, titleAr: l.titleAr ?? l.title, detail, unit: v.price, qty, amount: v.price * qty, ref: { listingId: l.id, variantId: v.id } });
    } else {
      const e = exhibitions.find((x) => x.id === it.exhibitionId);
      if (!e) { errors.push(`Unknown exhibition ${it.exhibitionId}`); continue; }
      if (!e.slots.includes(it.slot)) { errors.push("Unknown time slot"); continue; }
      let amount = 0, qty = 0;
      for (const [type, n] of Object.entries(it.tickets)) {
        const tk = e.tickets.find((x) => x.id === type);
        const c = Math.max(0, Math.min(20, Math.floor(n)));
        if (!tk || !c) continue;
        amount += tk.price * c; qty += c;
      }
      if (!qty) { errors.push("No tickets selected"); continue; }
      lines.push({ key: it.key, kind: "ticket", title: e.title, titleAr: e.titleAr, detail: `${it.date} · ${it.slot}`, unit: qty ? amount / qty : 0, qty, amount, ref: { exhibitionId: e.id, date: it.date, slot: it.slot, tickets: it.tickets } });
    }
  }
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const needsShipping = lines.some((l) => l.kind === "original" || l.kind === "print");
  const shipping = needsShipping ? SHIPPING_FLAT : 0;
  const vat = Math.round((subtotal + shipping) * VAT_RATE * 100) / 100;
  return { lines, errors, subtotal, shipping, vat, total: Math.round((subtotal + shipping + vat) * 100) / 100, needsShipping };
}
