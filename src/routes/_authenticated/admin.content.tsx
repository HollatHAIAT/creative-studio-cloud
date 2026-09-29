import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Save, Trash2, Eye, EyeOff, RotateCcw } from "lucide-react";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { StaffGate } from "@/components/StaffGate";
import { supabase } from "@/integrations/supabase/client";
import { useStaff } from "@/lib/auth";
import { useLocale, dictionaries } from "@/lib/i18n";
import { cmsQuery, builtIn, type CmsKind, type CmsRow } from "@/lib/cms";

export const Route = createFileRoute("/_authenticated/admin/content")({
  head: () => ({ meta: [
    { title: "Content — Arwiqa admin" },
    { name: "description", content: "Edit site texts, artists, categories, exhibitions and banners on Arwiqa." },
    { property: "og:title", content: "Content — Arwiqa admin" },
    { property: "og:description", content: "Admin content management for Arwiqa." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <StaffGate><Content /></StaffGate>,
});

type Field = { k: string; en: string; ar: string; type?: "text" | "area" | "number" | "date" | "select"; options?: string[] };
const FIELDS: Record<Exclude<CmsKind, "text">, Field[]> = {
  artist: [
    { k: "name", en: "Name (English)", ar: "الاسم (إنجليزي)" }, { k: "nameAr", en: "Name (Arabic)", ar: "الاسم (عربي)" },
    { k: "city", en: "City (English)", ar: "المدينة (إنجليزي)" }, { k: "cityAr", en: "City (Arabic)", ar: "المدينة (عربي)" },
    { k: "discipline", en: "Discipline (English)", ar: "التخصص (إنجليزي)" }, { k: "disciplineAr", en: "Discipline (Arabic)", ar: "التخصص (عربي)" },
    { k: "image", en: "Photo URL", ar: "رابط الصورة" }, { k: "followers", en: "Followers", ar: "المتابعون", type: "number" },
    { k: "bio", en: "Bio (English)", ar: "النبذة (إنجليزي)", type: "area" }, { k: "bioAr", en: "Bio (Arabic)", ar: "النبذة (عربي)", type: "area" },
  ],
  category: [{ k: "en", en: "Label (English)", ar: "الاسم (إنجليزي)" }, { k: "ar", en: "Label (Arabic)", ar: "الاسم (عربي)" }],
  exhibition: [
    { k: "title", en: "Title (English)", ar: "العنوان (إنجليزي)" }, { k: "titleAr", en: "Title (Arabic)", ar: "العنوان (عربي)" },
    { k: "type", en: "Type", ar: "النوع", type: "select", options: ["Physical", "Virtual"] },
    { k: "venue", en: "Venue (English)", ar: "المكان (إنجليزي)" }, { k: "venueAr", en: "Venue (Arabic)", ar: "المكان (عربي)" },
    { k: "image", en: "Cover image URL", ar: "رابط صورة الغلاف" },
    { k: "startDate", en: "Opening date", ar: "تاريخ الافتتاح", type: "date" }, { k: "days", en: "Runs for (days)", ar: "المدة (أيام)", type: "number" },
    { k: "slots", en: "Time slots (comma-separated)", ar: "الفترات (مفصولة بفواصل)" }, { k: "capacity", en: "Places per slot", ar: "المقاعد لكل فترة", type: "number" },
    { k: "adultPrice", en: "Adult ticket price (USD, 0 = free)", ar: "سعر تذكرة البالغ (دولار، ٠ = مجاني)", type: "number" },
    { k: "description", en: "Description (English)", ar: "الوصف (إنجليزي)", type: "area" }, { k: "descriptionAr", en: "Description (Arabic)", ar: "الوصف (عربي)", type: "area" },
  ],
  banner: [
    { k: "title", en: "Title (English)", ar: "العنوان (إنجليزي)" }, { k: "titleAr", en: "Title (Arabic)", ar: "العنوان (عربي)" },
    { k: "body", en: "Text (English)", ar: "النص (إنجليزي)", type: "area" }, { k: "bodyAr", en: "Text (Arabic)", ar: "النص (عربي)", type: "area" },
    { k: "cta", en: "Button (English)", ar: "الزر (إنجليزي)" }, { k: "ctaAr", en: "Button (Arabic)", ar: "الزر (عربي)" },
    { k: "link", en: "Button link (/page or https://…)", ar: "رابط الزر (/صفحة أو https://…)" }, { k: "image", en: "Background image URL", ar: "رابط صورة الخلفية" },
  ],
};
const TABS: { k: CmsKind; en: string; ar: string }[] = [
  { k: "text", en: "Page texts", ar: "نصوص الصفحات" }, { k: "artist", en: "Artists", ar: "الفنانون" }, { k: "category", en: "Categories", ar: "التصنيفات" },
  { k: "exhibition", en: "Exhibitions", ar: "المعارض" }, { k: "banner", en: "Banners", ar: "البانرات" },
];

function Content() {
  const { locale } = useLocale();
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const { isAdmin } = useStaff();
  const [tab, setTab] = useState<CmsKind>("text");
  const q = useQuery(cmsQuery);
  const rows = q.data ?? [];
  return (
    <SiteShell>
      <PageTitle eyebrow={L("Administration", "إدارة النظام")} title={L("Site content", "إدارة المحتوى")}
        sub={L("Edit the texts, artists, categories, exhibitions and banners shown on the public site, in Arabic and English.", "عدّل النصوص والفنانين والتصنيفات والمعارض والبانرات الظاهرة في الموقع، بالعربية والإنجليزية.")} />
      <div className="mx-auto max-w-6xl px-6 pb-20">
        {!isAdmin && <p className="mb-4 rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">{L("Only admins can change content.", "تعديل المحتوى للمديرين فقط.")}</p>}
        <div role="tablist" className="mb-6 flex flex-wrap gap-1 border-b border-border">
          {TABS.map((t) => <button key={t.k} role="tab" aria-selected={tab === t.k} onClick={() => setTab(t.k)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${tab === t.k ? "border-primary font-medium" : "border-transparent text-muted-foreground"}`}>{L(t.en, t.ar)}</button>)}
        </div>
        {q.isLoading ? <p className="text-muted-foreground">{L("Loading…", "جارٍ التحميل…")}</p>
          : tab === "text" ? <Texts rows={rows} L={L} canEdit={isAdmin} />
          : <Items kind={tab} rows={rows} L={L} canEdit={isAdmin} />}
      </div>
    </SiteShell>
  );
}

function useSave() {
  const qc = useQueryClient();
  return {
    save: async (kind: CmsKind, key: string, data: Record<string, unknown>, published = true, sort = 0) => {
      const { error } = await supabase.from("cms_entries" as never).upsert({ kind, key, data, published, sort } as never);
      if (error) { toast.error(error.message); return false; }
      await qc.invalidateQueries({ queryKey: ["cms"] }); return true;
    },
    remove: async (kind: CmsKind, key: string) => {
      const { error } = await supabase.from("cms_entries" as never).delete().eq("kind", kind).eq("key", key);
      if (error) { toast.error(error.message); return false; }
      await qc.invalidateQueries({ queryKey: ["cms"] }); return true;
    },
  };
}

function Texts({ rows, L, canEdit }: { rows: CmsRow[]; L: (e: string, a: string) => string; canEdit: boolean }) {
  const { save, remove } = useSave();
  const [s, setS] = useState(""); const [onlyEdited, setOnlyEdited] = useState(false);
  const [draft, setDraft] = useState<Record<string, { en: string; ar: string }>>({});
  const over = useMemo(() => new Map(rows.filter((r) => r.kind === "text").map((r) => [r.key, r])), [rows]);
  const keys = useMemo(() => Object.keys(dictionaries.en).filter((k) => !k.startsWith("cat.")), []);
  const term = s.trim().toLowerCase();
  const list = keys.filter((k) => (!onlyEdited || over.has(k)) && (!term || k.toLowerCase().includes(term) || dictionaries.en[k]!.toLowerCase().includes(term) || (dictionaries.ar[k] ?? "").includes(s.trim()) || String(over.get(k)?.data.en ?? "").toLowerCase().includes(term)));
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input value={s} onChange={(e) => setS(e.target.value)} placeholder={L("Search texts in English or Arabic…", "ابحث في النصوص بالعربية أو الإنجليزية…")} aria-label={L("Search texts", "بحث في النصوص")} className="min-w-64 flex-1 rounded-md border border-border bg-card px-3 py-2" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyEdited} onChange={(e) => setOnlyEdited(e.target.checked)} />{L(`Edited only (${over.size})`, `المعدّلة فقط (${over.size})`)}</label>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{L(`${list.length} texts. Empty fields keep the built-in wording.`, `${list.length} نصًا. الحقل الفارغ يُبقي النص الأصلي.`)}</p>
      <div className="mt-4 space-y-3">
        {list.slice(0, 60).map((k) => {
          const o = over.get(k); const d = draft[k] ?? { en: String(o?.data.en ?? ""), ar: String(o?.data.ar ?? "") };
          const set = (f: "en" | "ar", v: string) => setDraft({ ...draft, [k]: { ...d, [f]: v } });
          return (
            <div key={k} className="rounded-md border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2"><code className="text-xs text-muted-foreground">{k}</code>{o && <span className="text-xs text-primary">{L("Edited", "معدّل")}</span>}</div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <textarea dir="ltr" rows={2} value={d.en} disabled={!canEdit} onChange={(e) => set("en", e.target.value)} placeholder={dictionaries.en[k]} aria-label={`${k} English`} className="rounded border border-border bg-background p-2 text-sm" />
                <textarea dir="rtl" rows={2} value={d.ar} disabled={!canEdit} onChange={(e) => set("ar", e.target.value)} placeholder={dictionaries.ar[k]} aria-label={`${k} Arabic`} className="rounded border border-border bg-background p-2 text-sm" />
              </div>
              {canEdit && <div className="mt-2 flex gap-3 text-sm">
                <button onClick={async () => { if (!d.en.trim() && !d.ar.trim()) { if (o) await remove("text", k); } else if (await save("text", k, { en: d.en.trim(), ar: d.ar.trim() })) toast.success(L("Saved", "تم الحفظ")); }} className="inline-flex items-center gap-1 text-primary"><Save aria-hidden className="h-4 w-4" />{L("Save", "حفظ")}</button>
                {o && <button onClick={async () => { if (await remove("text", k)) { setDraft({ ...draft, [k]: { en: "", ar: "" } }); toast.success(L("Restored original", "أُعيد النص الأصلي")); } }} className="inline-flex items-center gap-1 text-muted-foreground"><RotateCcw aria-hidden className="h-4 w-4" />{L("Restore original", "استعادة الأصلي")}</button>}
              </div>}
            </div>
          );
        })}
        {list.length > 60 && <p className="text-sm text-muted-foreground">{L("Showing the first 60 — search to narrow down.", "يُعرض أول ٦٠ — استخدم البحث للتضييق.")}</p>}
      </div>
    </div>
  );
}

function Items({ kind, rows, L, canEdit }: { kind: Exclude<CmsKind, "text">; rows: CmsRow[]; L: (e: string, a: string) => string; canEdit: boolean }) {
  const { save, remove } = useSave();
  const [editing, setEditing] = useState<{ key: string; data: Record<string, any>; published: boolean; sort: number; isNew: boolean; builtIn: boolean } | null>(null);
  const mine = rows.filter((r) => r.kind === kind);
  const base: { key: string; data: Record<string, any> }[] =
    kind === "artist" ? builtIn.artists.map((a) => ({ key: a.id, data: { ...a } }))
    : kind === "exhibition" ? builtIn.exhibitions.map((e) => ({ key: e.id, data: { ...e, slots: e.slots.join(", "), adultPrice: e.tickets[0]?.price ?? 0 } }))
    : kind === "category" ? builtIn.categories.map((c) => ({ key: c, data: { en: dictionaries.en[`cat.${c}`] ?? c, ar: dictionaries.ar[`cat.${c}`] ?? c } }))
    : [];
  const items = [...base.map((b) => { const o = mine.find((m) => m.key === b.key); return { key: b.key, data: { ...b.data, ...(o?.data ?? {}) }, published: o ? o.published : true, sort: o?.sort ?? 0, edited: !!o, builtIn: true }; }),
    ...mine.filter((m) => !base.some((b) => b.key === m.key)).map((m) => ({ key: m.key, data: m.data, published: m.published, sort: m.sort, edited: true, builtIn: false }))];
  const label = (d: Record<string, any>, key: string) => (L(d.name ?? d.title ?? d.en ?? key, d.nameAr ?? d.titleAr ?? d.ar ?? key)) || key;
  const fields = FIELDS[kind];

  const submit = async () => {
    if (!editing) return;
    const key = editing.key.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,59}$/.test(key)) { toast.error(L("ID: letters, numbers, - or _ only", "المعرّف: حروف إنجليزية وأرقام و - أو _ فقط")); return; }
    if (editing.isNew && items.some((i) => i.key === key)) { toast.error(L("That ID already exists", "هذا المعرّف مستخدم")); return; }
    const data: Record<string, unknown> = {};
    for (const f of fields) { const v = editing.data[f.k]; if (v !== undefined && v !== "") data[f.k] = f.type === "number" ? Number(v) : typeof v === "string" ? v.trim() : v; }
    if (await save(kind, key, data, editing.published, editing.sort)) { toast.success(L("Saved — live on the site", "تم الحفظ — ظاهر في الموقع")); setEditing(null); }
  };

  return (
    <div>
      {canEdit && <button onClick={() => setEditing({ key: "", data: kind === "exhibition" ? { type: "Physical" } : {}, published: true, sort: items.length, isNew: true, builtIn: false })} className="mb-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"><Plus aria-hidden className="h-4 w-4" />{L("Add new", "إضافة جديد")}</button>}
      {items.length === 0 && <p className="text-muted-foreground">{L("Nothing here yet.", "لا يوجد شيء بعد.")}</p>}
      <ul className="divide-y divide-border rounded-md border border-border bg-card">
        {items.map((i) => (
          <li key={i.key} className="flex flex-wrap items-center gap-3 p-3">
            {(i.data.image) && <img src={i.data.image} alt="" className="h-10 w-10 rounded object-cover" />}
            <div className="min-w-0 flex-1"><p className="font-medium">{label(i.data, i.key)}</p><p className="text-xs text-muted-foreground">{i.key}{i.builtIn ? "" : ` · ${L("added", "مضاف")}`}{i.edited && i.builtIn ? ` · ${L("edited", "معدّل")}` : ""}{!i.published ? ` · ${L("hidden", "مخفي")}` : ""}</p></div>
            {canEdit && <div className="flex gap-3 text-sm">
              <button onClick={() => setEditing({ key: i.key, data: { ...i.data }, published: i.published, sort: i.sort, isNew: false, builtIn: i.builtIn })} className="text-primary underline">{L("Edit", "تعديل")}</button>
              <button onClick={() => save(kind, i.key, mine.find((m) => m.key === i.key)?.data ?? {}, !i.published, i.sort)} className="inline-flex items-center gap-1" aria-label={i.published ? L("Hide", "إخفاء") : L("Show", "إظهار")}>{i.published ? <EyeOff aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}{i.published ? L("Hide", "إخفاء") : L("Show", "إظهار")}</button>
              {i.edited && <button onClick={() => { if (confirm(i.builtIn ? L("Undo your edits and restore the original?", "إلغاء تعديلاتك واستعادة الأصل؟") : L("Delete this item?", "حذف هذا العنصر؟"))) void remove(kind, i.key); }} className="inline-flex items-center gap-1 text-destructive">{i.builtIn ? <RotateCcw aria-hidden className="h-4 w-4" /> : <Trash2 aria-hidden className="h-4 w-4" />}{i.builtIn ? L("Restore", "استعادة") : L("Delete", "حذف")}</button>}
            </div>}
          </li>
        ))}
      </ul>

      {editing && (
        <div role="dialog" aria-modal="true" aria-label={L("Edit item", "تعديل عنصر")} className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4">
          <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-md bg-card p-6">
            <h2 className="font-display text-2xl">{editing.isNew ? L("Add new", "إضافة جديد") : L("Edit", "تعديل")}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-sm">{L("ID (used in links, English letters)", "المعرّف (يُستخدم في الروابط، بحروف إنجليزية)")}
                <input value={editing.key} disabled={!editing.isNew} onChange={(e) => setEditing({ ...editing, key: e.target.value })} dir="ltr" className="mt-1 w-full rounded border border-border bg-background p-2" /></label>
              <label className="text-sm">{L("Order", "الترتيب")}
                <input type="number" value={editing.sort} onChange={(e) => setEditing({ ...editing, sort: Number(e.target.value) })} className="mt-1 w-full rounded border border-border bg-background p-2" /></label>
              {fields.map((f) => {
                const v = editing.data[f.k] ?? ""; const set = (x: unknown) => setEditing({ ...editing, data: { ...editing.data, [f.k]: x } });
                const dir = f.k.endsWith("Ar") || f.k === "ar" ? "rtl" : undefined;
                return (
                  <label key={f.k} className={`text-sm ${f.type === "area" ? "md:col-span-2" : ""}`}>{L(f.en, f.ar)}
                    {f.type === "area" ? <textarea dir={dir} rows={3} value={v} onChange={(e) => set(e.target.value)} className="mt-1 w-full rounded border border-border bg-background p-2" />
                      : f.type === "select" ? <select value={v} onChange={(e) => set(e.target.value)} className="mt-1 w-full rounded border border-border bg-background p-2">{f.options!.map((o) => <option key={o}>{o}</option>)}</select>
                      : <input dir={dir} type={f.type ?? "text"} value={v} onChange={(e) => set(e.target.value)} className="mt-1 w-full rounded border border-border bg-background p-2" />}
                  </label>
                );
              })}
              <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" checked={editing.published} onChange={(e) => setEditing({ ...editing, published: e.target.checked })} />{L("Show on the site", "إظهار في الموقع")}</label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setEditing(null)} className="rounded-md border border-border px-4 py-2">{L("Cancel", "إلغاء")}</button>
              <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground">{L("Save", "حفظ")}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
