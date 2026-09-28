import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";

/** Inline stock control for one listing. Empty = not tracked. */
export function StockEditor({ listingId, stock, low, onSaved }: { listingId: string; stock: number | null; low: number; onSaved: () => void }) {
  const { locale } = useLocale(); const L = (e: string, a: string) => (locale === "ar" ? a : e);
  const [v, setV] = useState(stock == null ? "" : String(stock)); const [lo, setLo] = useState(String(low));
  const [busy, setBusy] = useState(false);
  const dirty = v !== (stock == null ? "" : String(stock)) || lo !== String(low);
  async function save() {
    const n = v.trim() === "" ? null : Number(v); const l = Number(lo);
    if ((n != null && (!Number.isInteger(n) || n < 0)) || !Number.isInteger(l) || l < 0) { toast.error(L("Use whole numbers of 0 or more.", "استخدم أعدادًا صحيحة من 0 فأكثر.")); return; }
    setBusy(true);
    const { error } = await (supabase as any).rpc("set_listing_stock", { _listing: listingId, _stock: n, _low: l });
    setBusy(false);
    if (error) { toast.error(L("Couldn't save stock.", "تعذّر حفظ المخزون.")); return; }
    toast.success(L("Stock saved", "حُفظ المخزون")); onSaved();
  }
  const state = stock == null ? null : stock === 0 ? "out" : stock <= low ? "low" : "ok";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="number" min={0} inputMode="numeric" value={v} onChange={(e) => setV(e.target.value)} placeholder={L("Not tracked", "غير متتبَّع")}
        aria-label={L("Stock", "المخزون")} className="w-24 rounded-lg border border-input bg-background px-2 py-1 text-sm" />
      <label className="flex items-center gap-1 text-xs text-muted-foreground">{L("Low at", "منخفض عند")}
        <input type="number" min={0} value={lo} onChange={(e) => setLo(e.target.value)} aria-label={L("Low-stock level", "حد المخزون المنخفض")} className="w-14 rounded-lg border border-input bg-background px-2 py-1 text-sm" /></label>
      {state && <span className={`rounded-full px-2 py-0.5 text-xs ${state === "out" ? "bg-destructive/10 text-destructive" : state === "low" ? "bg-warning/15 text-warning" : "bg-success/15 text-success"}`}>
        {state === "out" ? L("Out of stock", "نفد") : state === "low" ? L("Low", "منخفض") : L("In stock", "متوفر")}</span>}
      {dirty && <button type="button" onClick={save} disabled={busy} className="rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50">{busy ? "…" : L("Save", "احفظ")}</button>}
    </div>
  );
}
