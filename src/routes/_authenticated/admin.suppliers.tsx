import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X, Ban, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { summarizeSupplierApplication, type SupplierReview, type Bi } from "@/lib/supplier-review.functions";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { StaffGate } from "@/components/StaffGate";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/suppliers")({
  head: () => ({ meta: [
    { title: "Supplier approvals — Arwiqa admin" },
    { name: "description", content: "Approve or reject new supplier shops before they appear on the supplies page." },
    { property: "og:title", content: "Supplier approvals — Arwiqa admin" },
    { property: "og:description", content: "Staff review of supplier accounts and their products." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <StaffGate><Suppliers /></StaffGate>,
});

type Row = { user_id: string; name: string; name_ar: string; city: string; phone: string; email: string; about: string; about_ar: string; status: string; review_note: string; created_at: string; supplier_products: { id: string; name: string; name_ar: string; price: number; stock: number; status: string }[] };
const sb = supabase as any;

function Suppliers() {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const qc = useQueryClient();
  const [filter, setFilter] = useState("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reviews, setReviews] = useState<Record<string, { review?: SupplierReview; rules: Bi[]; error?: string } | "loading">>({});
  const summarize = useServerFn(summarizeSupplierApplication);
  const runSummary = async (id: string) => {
    setReviews((r) => ({ ...r, [id]: "loading" }));
    try { const out = await summarize({ data: { userId: id } }); setReviews((r) => ({ ...r, [id]: out })); }
    catch { setReviews((r) => ({ ...r, [id]: { rules: [], error: L("Couldn't build the summary.", "تعذّر إعداد الملخص.") } })); }
  };
  const t2 = (b: Bi) => (ar ? b.ar : b.en);
  const q = useQuery({ queryKey: ["admin-suppliers", filter], queryFn: async () => {
    let r = sb.from("supplier_accounts").select("user_id,name,name_ar,city,phone,email,about,about_ar,status,review_note,created_at,supplier_products(id,name,name_ar,price,stock,status)").order("created_at", { ascending: true }).limit(200);
    if (filter !== "all") r = r.eq("status", filter);
    const { data, error } = await r; if (error) throw error; return data as Row[];
  } });
  // Deep link from a staff notification: /admin/suppliers#supplier-<id> scrolls to and highlights that shop.
  const [focus, setFocus] = useState<string | null>(null);
  useEffect(() => { const h = window.location.hash.match(/^#supplier-([0-9a-f-]{36})$/); if (h) setFocus(h[1]!); }, []);
  useEffect(() => {
    if (!focus || !q.data) return;
    if (!q.data.some((r) => r.user_id === focus)) { if (filter !== "all") setFilter("all"); return; }
    document.getElementById(`supplier-${focus}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focus, q.data, filter]);
  const decide = async (r: Row, decision: "active" | "rejected" | "suspended") => {
    const note = (notes[r.user_id] ?? "").trim();
    if (decision === "rejected" && note.length < 5) { toast.error(L("Write what the supplier needs to change.", "اكتب ما يجب على المورّد تعديله.")); return; }
    if (decision !== "active" && !confirm(decision === "rejected" ? L(`Send "${r.name}" back for changes?`, `إعادة «${r.name_ar || r.name}» للتعديل؟`) : L(`Suspend "${r.name}"? Their products will be hidden.`, `إيقاف «${r.name_ar || r.name}»؟ ستُخفى منتجاته.`))) return;
    const { error } = await sb.rpc("admin_review_supplier", { _user: r.user_id, _decision: decision, _note: note });
    if (error) { toast.error(error.message); return; }
    toast.success(decision === "active" ? L("Approved — the shop is now visible.", "تمت الموافقة — أصبح المتجر ظاهرًا.") : decision === "rejected" ? L("Sent back for changes", "أُعيد للتعديل") : L("Suspended", "تم الإيقاف"));
    qc.invalidateQueries({ queryKey: ["admin-suppliers"] }); qc.invalidateQueries({ queryKey: ["supplier-products-public"] });
  };
  const labels: Record<string, [string, string]> = { pending: ["Waiting", "بانتظار المراجعة"], active: ["Approved", "معتمد"], rejected: ["Needs changes", "يحتاج تعديلات"], suspended: ["Suspended", "موقوف"], all: ["All", "الكل"] };

  return (
    <SiteShell>
      <PageTitle eyebrow={L("Admin", "الإدارة")} title={L("Supplier approvals", "موافقات الموردين")} sub={L("New supplier shops and their products stay hidden from the supplies page until staff approve them.", "تبقى متاجر الموردين الجديدة ومنتجاتها مخفية عن صفحة المستلزمات حتى يوافق عليها الفريق.")} />
      <div className="mx-auto max-w-6xl px-6 pb-20">
        <div role="tablist" className="mb-6 flex flex-wrap gap-2">{Object.keys(labels).map((k) => (
          <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={`rounded-full border px-4 py-1.5 text-sm ${filter === k ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{L(...labels[k]!)}</button>))}</div>
        {q.isLoading ? <p className="text-muted-foreground">{L("Loading…", "جارٍ التحميل…")}</p>
          : q.error ? <p role="alert" className="text-destructive">{L("Couldn't load suppliers.", "تعذّر تحميل الموردين.")}</p>
          : !q.data?.length ? <p className="text-muted-foreground">{L("Nothing here.", "لا يوجد شيء هنا.")}</p>
          : <ul className="space-y-4">{q.data.map((r) => (
            <li key={r.user_id} id={`supplier-${r.user_id}`} className={`scroll-mt-24 rounded-2xl border bg-card p-5 ${focus === r.user_id ? "border-primary ring-2 ring-primary/40" : "border-border"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="font-display text-xl">{ar ? r.name_ar || r.name : r.name}</p>
                  <p className="text-sm text-muted-foreground">{[r.city, r.email, r.phone].filter(Boolean).join(" · ")} · {L("applied", "قدّم")} {new Date(r.created_at).toLocaleDateString(ar ? "ar-SA" : "en-GB")}</p></div>
                <span className="rounded-full bg-muted px-3 py-1 text-xs">{L(...(labels[r.status] ?? [r.status, r.status]))}</span>
              </div>
              {(r.about || r.about_ar) && <p className="mt-3 text-sm">{ar ? r.about_ar || r.about : r.about}</p>}
              {r.review_note && <p className="mt-2 text-sm text-muted-foreground">{L("Last note: ", "آخر ملاحظة: ")}{r.review_note}</p>}
              <details className="mt-3 text-sm"><summary className="cursor-pointer">{L(`Products (${r.supplier_products.length})`, `المنتجات (${r.supplier_products.length})`)}</summary>
                <ul className="mt-2 space-y-1">{r.supplier_products.map((p) => <li key={p.id}>{ar ? p.name_ar : p.name} — {p.price} {L("SAR", "ر.س")} · {L("stock", "المخزون")} {p.stock} · {p.status}</li>)}</ul></details>
              {(() => { const rv = reviews[r.user_id]; return (
                <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{L("Review summary", "ملخص المراجعة")}</p>
                    <button onClick={() => void runSummary(r.user_id)} disabled={rv === "loading"} className="inline-flex items-center gap-1 rounded-full border border-primary px-3 py-1 text-primary disabled:opacity-50"><Sparkles aria-hidden className="h-4 w-4" />{rv === "loading" ? L("Summarising…", "جارٍ التلخيص…") : rv ? L("Refresh", "تحديث") : L("Summarise application", "لخّص الطلب")}</button>
                  </div>
                  {rv && rv !== "loading" && (<div className="mt-3 space-y-3">
                    {rv.review && <>
                      <div><p className="text-xs font-medium text-muted-foreground">{L("Shop", "المتجر")}</p><p>{t2(rv.review.summary)}</p></div>
                      <div><p className="text-xs font-medium text-muted-foreground">{L("Product range", "تشكيلة المنتجات")}</p><p>{t2(rv.review.range)}</p></div>
                    </>}
                    {(rv.rules.length > 0 || (rv.review?.missing.length ?? 0) > 0) && <div><p className="text-xs font-medium text-destructive">{L("Missing information", "معلومات ناقصة")}</p>
                      <ul className="ms-5 list-disc">{[...rv.rules, ...(rv.review?.missing ?? [])].map((m, i) => <li key={i}>{t2(m)}</li>)}</ul></div>}
                    {rv.rules.length === 0 && rv.review && rv.review.missing.length === 0 && <p className="text-success">{L("No missing information found.", "لا توجد معلومات ناقصة.")}</p>}
                    {rv.review && rv.review.concerns.length > 0 && <div><p className="text-xs font-medium text-muted-foreground">{L("Worth checking", "يستحق التحقق")}</p><ul className="ms-5 list-disc">{rv.review.concerns.map((c: Bi, i: number) => <li key={i}>{t2(c)}</li>)}</ul></div>}
                    {rv.review && <p className="rounded-md bg-background p-2"><span className="font-medium">{L("AI suggestion: ", "اقتراح الذكاء الاصطناعي: ")}{rv.review.suggestion === "approve" ? L("approve", "موافقة") : L("ask for changes", "طلب تعديلات")}</span> — {t2(rv.review.suggestionWhy)}</p>}
                    {rv.error && <p role="alert" className="text-destructive">{rv.error}</p>}
                    <p className="text-xs text-muted-foreground">{L("Advice only — the decision is yours.", "للاستئناس فقط — القرار لك.")}</p>
                    {rv.rules.length > 0 && !notes[r.user_id] && <button onClick={() => setNotes({ ...notes, [r.user_id]: L("Please add: ", "يرجى إضافة: ") + [...rv.rules, ...(rv.review?.missing ?? [])].map(t2).join("، ") })} className="text-xs text-primary underline">{L("Use missing items as the note", "استخدم النواقص كملاحظة")}</button>}
                  </div>)}
                </div>); })()}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <input value={notes[r.user_id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.user_id]: e.target.value })} maxLength={1000} placeholder={L("Note to supplier (required to send back)", "ملاحظة للمورّد (مطلوبة عند الإعادة)")} aria-label={L("Note to supplier", "ملاحظة للمورّد")} className="min-w-64 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
                {r.status !== "active" && <button onClick={() => void decide(r, "active")} className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground"><Check aria-hidden className="h-4 w-4" />{L("Approve", "موافقة")}</button>}
                {r.status === "pending" && <button onClick={() => void decide(r, "rejected")} className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-sm"><X aria-hidden className="h-4 w-4" />{L("Send back", "إعادة للتعديل")}</button>}
                {r.status === "active" && <button onClick={() => void decide(r, "suspended")} className="inline-flex items-center gap-1 rounded-full border border-destructive/50 px-4 py-2 text-sm text-destructive"><Ban aria-hidden className="h-4 w-4" />{L("Suspend", "إيقاف")}</button>}
              </div>
            </li>))}</ul>}
      </div>
    </SiteShell>
  );
}
