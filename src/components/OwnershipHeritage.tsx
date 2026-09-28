import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";

const sb = supabase as any;
type Prov = { period: string; holder: string; evidence: string };
type Co = { name: string; email: string; share: string };
type S = {
  seller_role: string; owner_name: string; owner_email: string; consignment_terms: string; co_owners: Co[]; owner_approved_at: string | null;
  is_heritage: boolean; heritage_type: string; origin_region: string; era: string; provenance: Prov[]; condition_grade: string; condition_report: string; export_permit_ref: string;
};
const EMPTY: S = { seller_role: "owner", owner_name: "", owner_email: "", consignment_terms: "", co_owners: [], owner_approved_at: null,
  is_heritage: false, heritage_type: "", origin_region: "", era: "", provenance: [], condition_grade: "", condition_report: "", export_permit_ref: "" };

export const ROLES: [string, string, string][] = [
  ["owner", "I own it", "أنا المالك"], ["agent", "Agent for the owner", "وكيل عن المالك"], ["consignment", "On consignment", "بالأمانة"],
  ["heir", "Heir / estate", "وريث / تركة"], ["joint_owner", "Joint owner", "مالك مشترك"], ["gallery", "Gallery representing the artist", "غاليري يمثل الفنان"],
];
export const HTYPES: [string, string, string][] = [
  ["manuscript", "Manuscript-related art", "فن مرتبط بالمخطوطات"], ["textile", "Textile / carpet", "نسيج / سجاد"], ["jewellery", "Jewellery", "حُلي"],
  ["coin", "Coin", "عملة"], ["map", "Map / historic print", "خريطة / مطبوعة تاريخية"], ["woodwork", "Woodwork", "أعمال خشبية"],
  ["metalwork", "Metalwork", "أعمال معدنية"], ["ceramics", "Ceramics", "خزف"], ["architectural", "Architectural piece", "قطعة معمارية"],
  ["clothing", "Traditional clothing", "لباس تقليدي"], ["other", "Other", "أخرى"],
];
const GRADES: [string, string, string][] = [["excellent", "Excellent", "ممتازة"], ["good", "Good", "جيدة"], ["fair", "Fair", "مقبولة"], ["restored", "Restored", "مرمَّمة"], ["poor", "Poor", "ضعيفة"]];
export const REGIONS: [string, string][] = [["Najd", "نجد"], ["Hijaz", "الحجاز"], ["Asir", "عسير"], ["Eastern Province", "المنطقة الشرقية"], ["Northern Borders", "الحدود الشمالية"], ["Jazan", "جازان"], ["Najran", "نجران"], ["Al-Ahsa", "الأحساء"], ["UAE", "الإمارات"], ["Kuwait", "الكويت"], ["Bahrain", "البحرين"], ["Qatar", "قطر"], ["Oman", "عُمان"], ["Other", "أخرى"]];

/** Seller vs owner (agents, consignment, heirs, joint owners, galleries) + heritage details, saved on the draft. */
export function OwnershipHeritage({ draftId, onSave }: { draftId: string | null; onSave: () => Promise<string | null> }) {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const [s, setS] = useState<S>(EMPTY);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!draftId) { setS(EMPTY); return; } void (async () => {
    const { data } = await sb.from("listing_drafts").select(Object.keys(EMPTY).join(",")).eq("id", draftId).maybeSingle();
    if (data) setS({ ...EMPTY, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v ?? (EMPTY as any)[k]])) } as S);
  })(); }, [draftId]);
  const set = <K extends keyof S>(k: K, v: S[K]) => setS((x) => ({ ...x, [k]: v }));
  const nonOwner = s.seller_role !== "owner";

  async function save() {
    if (saving) return; setSaving(true);
    const id = draftId ?? (await onSave());
    if (!id) { setSaving(false); toast.error(L("Save the draft first.", "احفظ المسودة أولاً.")); return; }
    const { owner_approved_at: _a, ...row } = s;
    const { data, error } = await sb.from("listing_drafts").update({
      ...row, owner_email: row.owner_email.trim().toLowerCase() || null, heritage_type: row.is_heritage ? row.heritage_type || null : null,
      condition_grade: row.condition_grade || null,
      provenance: row.provenance.filter((p) => p.period || p.holder), co_owners: row.co_owners.filter((c) => c.name || c.email),
    }).eq("id", id).select("owner_approved_at").single();
    setSaving(false);
    if (error) { toast.error(L("Couldn't save these details.", "تعذّر حفظ هذه التفاصيل.")); return; }
    set("owner_approved_at", data.owner_approved_at);
    toast.success(L("Ownership and heritage details saved", "حُفظت تفاصيل الملكية والتراث"));
  }

  const inp = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";
  return (
    <section aria-labelledby="oh-h" className="space-y-4 rounded-2xl border border-border p-4">
      <h3 id="oh-h" className="font-display text-lg">{L("Ownership & heritage", "الملكية والتراث")}</h3>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{L("Who is selling this work?", "من يبيع هذا العمل؟")}</legend>
        <div className="flex flex-wrap gap-2">{ROLES.map(([id, en, a]) => (
          <label key={id} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${s.seller_role === id ? "border-primary bg-primary/10" : "border-border"}`}>
            <input type="radio" name="seller_role" className="sr-only" checked={s.seller_role === id} onChange={() => set("seller_role", id)} />{ar ? a : en}</label>))}</div>
      </fieldset>
      {nonOwner && (
        <div className="space-y-2 rounded-xl bg-muted/40 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={inp} value={s.owner_name} onChange={(e) => set("owner_name", e.target.value)} maxLength={120} aria-label={L("Owner's name", "اسم المالك")} placeholder={L("Owner's name", "اسم المالك")} />
            <input className={inp} type="email" value={s.owner_email} onChange={(e) => set("owner_email", e.target.value)} maxLength={255} aria-label={L("Owner's email", "بريد المالك")} placeholder={L("Owner's email", "بريد المالك")} />
          </div>
          {s.seller_role === "consignment" && <textarea className={inp} rows={2} maxLength={2000} value={s.consignment_terms} onChange={(e) => set("consignment_terms", e.target.value)} aria-label={L("Consignment terms", "شروط الأمانة")} placeholder={L("Consignment terms: commission, duration, minimum price…", "شروط الأمانة: العمولة، المدة، الحد الأدنى للسعر…")} />}
          {s.seller_role === "joint_owner" && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{L("Other joint owners", "المالكون المشاركون الآخرون")}</p>
              {s.co_owners.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <input className={inp} value={c.name} placeholder={L("Name", "الاسم")} aria-label={L("Name", "الاسم")} onChange={(e) => set("co_owners", s.co_owners.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                  <input className={inp} value={c.email} placeholder={L("Email", "البريد")} aria-label={L("Email", "البريد")} onChange={(e) => set("co_owners", s.co_owners.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} />
                  <input className={`${inp} w-24`} value={c.share} placeholder="%" aria-label={L("Share", "الحصة")} onChange={(e) => set("co_owners", s.co_owners.map((x, j) => j === i ? { ...x, share: e.target.value } : x))} />
                  <button type="button" aria-label={L("Remove", "إزالة")} onClick={() => set("co_owners", s.co_owners.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
                </div>))}
              <button type="button" className="inline-flex items-center gap-1 text-sm underline" onClick={() => set("co_owners", [...s.co_owners, { name: "", email: "", share: "" }])}><Plus className="h-3 w-3" />{L("Add joint owner", "أضف مالكاً مشاركاً")}</button>
            </div>)}
          <p role="status" className={`text-sm ${s.owner_approved_at ? "text-success" : "text-warning"}`}>
            {s.owner_approved_at ? L(`Owner approved on ${new Date(s.owner_approved_at).toLocaleDateString()}`, `وافق المالك في ${new Date(s.owner_approved_at).toLocaleDateString("ar-SA")}`)
              : L("The owner must approve before this can go live. After saving, they sign in with this email and approve it under Owner approvals.", "يجب أن يوافق المالك قبل النشر. بعد الحفظ، يسجّل الدخول بهذا البريد ويوافق من صفحة موافقات المالك.")}
          </p>
        </div>)}
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={s.is_heritage} onChange={(e) => set("is_heritage", e.target.checked)} />{L("This is a heritage or historical item", "هذه قطعة تراثية أو تاريخية")}</label>
      {s.is_heritage && (
        <div className="space-y-2 rounded-xl bg-muted/40 p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <select className={inp} value={s.heritage_type} onChange={(e) => set("heritage_type", e.target.value)} aria-label={L("Heritage type", "نوع القطعة")}>
              <option value="">{L("Heritage type…", "نوع القطعة…")}</option>{HTYPES.map(([id, en, a]) => <option key={id} value={id}>{ar ? a : en}</option>)}</select>
            <select className={inp} value={s.origin_region} onChange={(e) => set("origin_region", e.target.value)} aria-label={L("Region of origin", "منطقة المنشأ")}>
              <option value="">{L("Region of origin…", "منطقة المنشأ…")}</option>{REGIONS.map(([en, a]) => <option key={en} value={en}>{ar ? a : en}</option>)}</select>
            <input className={inp} value={s.era} onChange={(e) => set("era", e.target.value)} maxLength={120} aria-label={L("Era", "الحقبة")} placeholder={L("Era, e.g. c. 1920s", "الحقبة، مثل نحو العشرينيات")} />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{L("Ownership history (oldest first)", "سجل الملكية (الأقدم أولاً)")}</p>
            {s.provenance.map((p, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1.5fr_auto]">
                <input className={inp} value={p.period} placeholder={L("Period", "الفترة")} aria-label={L("Period", "الفترة")} onChange={(e) => set("provenance", s.provenance.map((x, j) => j === i ? { ...x, period: e.target.value } : x))} />
                <input className={inp} value={p.holder} placeholder={L("Holder", "المالك")} aria-label={L("Holder", "المالك")} onChange={(e) => set("provenance", s.provenance.map((x, j) => j === i ? { ...x, holder: e.target.value } : x))} />
                <input className={inp} value={p.evidence} placeholder={L("Evidence (receipt, letter, photo…)", "الدليل (إيصال، رسالة، صورة…)")} aria-label={L("Evidence", "الدليل")} onChange={(e) => set("provenance", s.provenance.map((x, j) => j === i ? { ...x, evidence: e.target.value } : x))} />
                <button type="button" aria-label={L("Remove", "إزالة")} onClick={() => set("provenance", s.provenance.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
              </div>))}
            <button type="button" className="inline-flex items-center gap-1 text-sm underline" onClick={() => set("provenance", [...s.provenance, { period: "", holder: "", evidence: "" }])}><Plus className="h-3 w-3" />{L("Add ownership entry", "أضف مرحلة ملكية")}</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-[12rem_1fr]">
            <select className={inp} value={s.condition_grade} onChange={(e) => set("condition_grade", e.target.value)} aria-label={L("Condition", "الحالة")}>
              <option value="">{L("Condition…", "الحالة…")}</option>{GRADES.map(([id, en, a]) => <option key={id} value={id}>{ar ? a : en}</option>)}</select>
            <textarea className={inp} rows={2} maxLength={4000} value={s.condition_report} onChange={(e) => set("condition_report", e.target.value)} aria-label={L("Condition report", "تقرير الحالة")} placeholder={L("Condition report: damage, repairs, restoration…", "تقرير الحالة: التلف، الإصلاحات، الترميم…")} />
          </div>
          <input className={inp} value={s.export_permit_ref} onChange={(e) => set("export_permit_ref", e.target.value)} maxLength={120} aria-label={L("Export permit reference", "رقم تصريح التصدير")} placeholder={L("Export permit reference (if the item may leave the country)", "رقم تصريح التصدير (إن كانت القطعة قد تغادر البلد)")} />
          <p className="text-xs text-muted-foreground">{L("Heritage items always go through Arwiqa review and can only be sold where the law allows.", "القطع التراثية تمر دائماً بمراجعة أروقة ولا تُباع إلا حيث يسمح النظام.")}</p>
        </div>)}
      <button type="button" onClick={save} disabled={saving} className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{saving ? "…" : L("Save ownership & heritage", "احفظ الملكية والتراث")}</button>
    </section>
  );
}
