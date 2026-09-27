import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { supabase } from "@/integrations/supabase/client";
import { categories } from "@/lib/data";
import { useLocale } from "@/lib/i18n";
import { ActionButton, useAction } from "@/components/ActionButton";

export const Route = createFileRoute("/_authenticated/saved-searches")({
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s['q'] === "string" ? s['q'] : undefined, cat: typeof s['cat'] === "string" ? s['cat'] : undefined }),
  head: () => ({
    meta: [
      { title: "Saved searches — Arwiqa أروقة" },
      { name: "description", content: "Get notified when new artworks match your keywords, categories and budget." },
      { property: "og:title", content: "Saved searches — Arwiqa أروقة" },
      { property: "og:description", content: "Alerts for new artworks that match what you're looking for." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SavedSearches,
});

type Saved = { id: string; name: string; keywords: string; categories: string[]; min_price: number | null; max_price: number | null; active: boolean };
const CAT_AR: Record<string, string> = { Painting: "رسم", Photography: "تصوير", Calligraphy: "خط عربي", Illustration: "رسوم توضيحية", Digital: "رقمي", Print: "مطبوعات" };
// Generated types may lag the new table; keep one narrow cast.
const table = () => (supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }).from("saved_searches");

function SavedSearches() {
  const { locale, money } = useLocale();
  const ar = locale === "ar";
  const s = Route.useSearch();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["saved-searches"], queryFn: async () => {
    const { data, error } = await table().select("*").order("created_at", { ascending: false });
    if (error) throw error; return (data ?? []) as unknown as Saved[];
  } });
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState(s.q ?? "");
  const [cats, setCats] = useState<string[]>(s.cat && s.cat !== "All" ? [s.cat] : []);
  const [min, setMin] = useState(""); const [max, setMax] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["saved-searches"] });

  const save = useAction(async () => {
    const { error } = await table().insert({ name, keywords, categories: cats, min_price: min ? Number(min) : null, max_price: max ? Number(max) : null } as never);
    if (error) throw new Error(error.message);
    setName(""); setKeywords(""); setCats([]); setMin(""); setMax("");
    toast.success(ar ? "تم حفظ البحث — سننبّهك عند وصول أعمال مطابقة" : "Search saved — we'll notify you about new matches");
    refresh();
  });
  const errMsg = (e: unknown) => {
    const m = e instanceof Error ? e.message : "";
    if (m.includes("PRICE_RANGE")) return ar ? "الحد الأدنى أكبر من الحد الأعلى." : "Minimum price is higher than maximum.";
    if (m.includes("SEARCH_LIMIT")) return ar ? "وصلت إلى الحد الأقصى (٢٠ بحثًا)." : "You've reached the limit of 20 saved searches.";
    return ar ? "تعذّر الحفظ" : "Couldn't save";
  };
  const toggle = async (x: Saved) => { const { error } = await table().update({ active: !x.active } as never).eq("id", x.id); if (error) toast.error(ar ? "تعذّر التحديث" : "Couldn't update"); refresh(); };
  const remove = async (x: Saved) => { const { error } = await table().delete().eq("id", x.id); if (error) toast.error(ar ? "تعذّر الحذف" : "Couldn't delete"); refresh(); };
  const field = "w-full rounded-md border border-border bg-card px-3 py-2 outline-none focus:border-primary";

  return (
    <SiteShell>
      <PageTitle eyebrow={ar ? "التنبيهات" : "Alerts"} title={ar ? "عمليات البحث المحفوظة" : "Saved searches"}
        sub={ar ? "سنرسل لك إشعارًا عندما يُعرض عمل جديد يطابق كلماتك وفئاتك وميزانيتك." : "We'll notify you when a new live artwork matches your keywords, categories and budget."} />
      <div className="mx-auto grid max-w-5xl gap-10 px-6 pb-20 lg:grid-cols-[1fr_1.2fr]">
        <form onSubmit={(e) => { e.preventDefault(); void save.run(); }} className="space-y-4 rounded-lg border border-border p-5">
          <h2 className="font-display text-xl">{ar ? "بحث جديد" : "New saved search"}</h2>
          <label className="block space-y-1 text-sm">{ar ? "الاسم (اختياري)" : "Name (optional)"}<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={field} /></label>
          <label className="block space-y-1 text-sm">{ar ? "كلمات مفتاحية" : "Keywords"}<input value={keywords} onChange={(e) => setKeywords(e.target.value)} maxLength={200} placeholder={ar ? "مثال: صحراء ذهبي" : "e.g. desert gold"} className={field} /></label>
          <fieldset className="space-y-2 text-sm"><legend>{ar ? "الفئات (اتركها فارغة للكل)" : "Categories (none = all)"}</legend>
            <div className="flex flex-wrap gap-2">{categories.map((c) => {
              const on = cats.includes(c);
              return <button key={c} type="button" aria-pressed={on} onClick={() => setCats(on ? cats.filter((x) => x !== c) : [...cats, c])}
                className={`rounded-full border px-3 py-1 ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{ar ? CAT_AR[c] : c}</button>;
            })}</div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-sm">{ar ? "أقل سعر ($)" : "Min price ($)"}<input type="number" min={0} value={min} onChange={(e) => setMin(e.target.value)} className={field} /></label>
            <label className="space-y-1 text-sm">{ar ? "أعلى سعر ($)" : "Max price ($)"}<input type="number" min={0} value={max} onChange={(e) => setMax(e.target.value)} className={field} /></label>
          </div>
          <ActionButton type="submit" state={save.state} loadingLabel={ar ? "جارٍ الحفظ…" : "Saving…"} successLabel={ar ? "تم الحفظ" : "Saved"}
            errorLabel={errMsg(save.error)} onRetry={save.retry} retryLabel={ar ? "حاول مجددًا" : "Try again"}
            className="rounded-md bg-primary px-5 py-2.5 text-primary-foreground"><Bell aria-hidden className="h-4 w-4" />{ar ? "احفظ ونبّهني" : "Save & notify me"}</ActionButton>
        </form>

        <section className="space-y-3">
          {list.isLoading ? <p className="text-muted-foreground">{ar ? "جارٍ التحميل…" : "Loading…"}</p>
            : !list.data?.length ? <p className="text-muted-foreground">{ar ? "لا توجد عمليات بحث محفوظة بعد." : "No saved searches yet."}</p>
            : list.data.map((x) => (
              <article key={x.id} className={`rounded-lg border border-border p-4 ${x.active ? "" : "opacity-60"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">{x.name || x.keywords || (ar ? "كل الأعمال" : "All artworks")}</h3>
                    <p className="text-sm text-muted-foreground">
                      {[x.keywords && `“${x.keywords}”`, x.categories.length ? x.categories.map((c) => (ar ? CAT_AR[c] : c)).join("، ") : (ar ? "كل الفئات" : "All categories"),
                        x.min_price != null || x.max_price != null ? `${x.min_price != null ? money(x.min_price) : "$0"} – ${x.max_price != null ? money(x.max_price) : "∞"}` : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button type="button" onClick={() => void toggle(x)} className="rounded-md border border-border px-3 py-1 text-sm">{x.active ? (ar ? "إيقاف" : "Pause") : (ar ? "تفعيل" : "Resume")}</button>
                    <button type="button" onClick={() => void remove(x)} aria-label={ar ? "حذف" : "Delete"} className="rounded-md border border-border p-1.5 text-destructive"><Trash2 aria-hidden className="h-4 w-4" /></button>
                  </div>
                </div>
              </article>
            ))}
          <Link to="/notifications" className="inline-block text-sm underline">{ar ? "عرض الإشعارات" : "View notifications"}</Link>
        </section>
      </div>
    </SiteShell>
  );
}
