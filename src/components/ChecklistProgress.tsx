import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";

const sb = supabase as any;
const PR: Record<string, [string, string, string]> = {
  high: ["High", "عالية", "bg-destructive/10 text-destructive"],
  medium: ["Medium", "متوسطة", "bg-warning/15 text-warning"],
  low: ["Low", "منخفضة", "bg-muted text-muted-foreground"],
};
const FIELD: Record<string, [string, string]> = {
  image: ["Image", "الصورة"], title: ["Title", "العنوان"], description: ["Description", "الوصف"], altText: ["Alt text", "النص البديل"],
  tags: ["Tags", "الوسوم"], price: ["Price", "السعر"], medium: ["Medium", "الوسيط"], general: ["General", "عام"],
};
type Item = { id: string; priority: string; field: string; action: string; action_ar: string; why: string; why_ar: string; done_at: string | null; seller_note: string | null; created_at: string };

/** Revision checklist progress. Sellers (canEdit) tick items off; invited reviewers see what's been addressed. */
export function ChecklistProgress({ draftId, canEdit, refreshKey = 0 }: { draftId: string; canEdit: boolean; refreshKey?: number }) {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const [items, setItems] = useState<Item[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data } = await sb.from("revision_checklist_items").select("*").eq("draft_id", draftId).order("created_at");
    setItems(data ?? []);
  };
  useEffect(() => { void load(); }, [draftId, refreshKey]);

  async function toggle(it: Item) {
    if (busy) return; setBusy(it.id);
    const { error } = await sb.rpc("set_checklist_item_done", { _item: it.id, _done: !it.done_at, _note: notes[it.id] ?? null });
    setBusy(null);
    if (error) { toast.error(L("Couldn't update this item.", "تعذّر تحديث هذا البند.")); return; }
    toast.success(!it.done_at ? L("Marked as done", "عُلّم كمنجز") : L("Marked as not done", "عُلّم كغير منجز"));
    void load();
  }

  if (!items || items.length === 0) return null;
  const done = items.filter((i) => i.done_at).length;
  const pct = Math.round((done / items.length) * 100);

  return (
    <section aria-labelledby={`cp-${draftId}`} className="space-y-3 rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`cp-${draftId}`} className="font-medium">{L("Revision checklist progress", "تقدّم قائمة التعديلات")}</h3>
        <span aria-live="polite" className="text-sm text-muted-foreground">{L(`${done} of ${items.length} addressed`, `${done} من ${items.length} منجزة`)}</span>
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={L("Addressed", "المنجز")} className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-success transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ol className="space-y-2">
        {items.map((x) => {
          const p = PR[x.priority] ?? PR["medium"]!; const f = FIELD[x.field] ?? FIELD["general"]!;
          return (
            <li key={x.id} className={`rounded-lg p-2 ${x.done_at ? "bg-success/10" : "bg-muted/40"}`}>
              <div className="flex items-start gap-2">
                {canEdit ? (
                  <button type="button" onClick={() => toggle(x)} disabled={busy === x.id} aria-pressed={!!x.done_at}
                    aria-label={x.done_at ? L("Mark as not done", "علّم كغير منجز") : L("Mark as done", "علّم كمنجز")} className="mt-0.5 rounded-full">
                    {x.done_at ? <CheckCircle2 aria-hidden className="h-5 w-5 text-success" /> : <Circle aria-hidden className="h-5 w-5 text-muted-foreground" />}
                  </button>
                ) : x.done_at ? <CheckCircle2 aria-hidden className="mt-0.5 h-5 w-5 text-success" /> : <Circle aria-hidden className="mt-0.5 h-5 w-5 text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                  <span className={`me-2 rounded-full px-2 py-0.5 text-xs ${p[2]}`}>{L(p[0], p[1])}</span>
                  <span className="text-xs text-muted-foreground">{L(f[0], f[1])}</span>
                  <span className={`block font-medium ${x.done_at ? "line-through decoration-success/60" : ""}`}>{ar ? x.action_ar || x.action : x.action}</span>
                  {(x.why || x.why_ar) && <span className="block text-sm text-muted-foreground">{ar ? x.why_ar || x.why : x.why}</span>}
                  <span className="block text-xs text-muted-foreground">
                    <span className="sr-only">{L("Status:", "الحالة:")} </span>
                    {x.done_at ? `${L("Addressed", "مُنجز")} · ${new Date(x.done_at).toLocaleString(ar ? "ar" : "en")}` : L("Not yet addressed", "لم يُنجز بعد")}
                  </span>
                  {x.seller_note && <span className="mt-1 block text-sm">{L("Seller's note:", "ملاحظة البائع:")} {x.seller_note}</span>}
                  {canEdit && !x.done_at && (
                    <input value={notes[x.id] ?? ""} onChange={(e) => setNotes({ ...notes, [x.id]: e.target.value })} maxLength={500}
                      aria-label={L("Optional note for the reviewer", "ملاحظة اختيارية للمراجع")} placeholder={L("Optional note for the reviewer (what you changed)", "ملاحظة اختيارية للمراجع (ماذا غيّرت)")}
                      className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-1 text-sm" />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted-foreground">{canEdit
        ? L("Reviewers on this listing can see which items you've marked done.", "يرى مراجعو هذا الإعلان البنود التي علّمتها كمنجزة.")
        : L("Only the seller can mark items as done.", "البائع وحده يعلّم البنود كمنجزة.")}</p>
    </section>
  );
}
