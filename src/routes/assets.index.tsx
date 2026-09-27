import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { BankTile } from "@/components/BankTile";
import { useAssets, resolveBlob } from "@/lib/assets-db";
import { useLocale } from "@/lib/i18n";
import { FORMATS, metadataCsv, save, type AssetFormat } from "@/lib/bank-assets";

export const Route = createFileRoute("/assets/")({
  head: () => ({
    meta: [
      { title: "Images & digital assets library — Arwiqa أروقة" },
      { name: "description", content: "Browse every image and digital asset on Arwiqa. Filter by name, category, tags and type, then download one or many as a ZIP." },
      { property: "og:title", content: "Images & digital assets — Arwiqa أروقة" },
      { property: "og:description", content: "Searchable library of images, mockups and logo assets with bulk download." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssetsLibrary,
});

const chip = (on: boolean) => `rounded-full border px-3 py-1 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`;

function AssetsLibrary() {
  const { locale, num, pick } = useLocale();
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const q = useAssets();
  const all = q.data?.banks ?? [];
  const files = q.data?.files ?? [];

  const [name, setName] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [kind, setKind] = useState("all");
  const [collection, setCollection] = useState("all");
  const [hasFiles, setHasFiles] = useState(false);
  const [sort, setSort] = useState("default");
  const [sel, setSel] = useState<string[]>([]);
  const [fmt, setFmt] = useState<AssetFormat>("png");
  const [busy, setBusy] = useState(false);

  const categories = useMemo(() => [...new Map(all.map((a) => [a.category ?? "Other", a])).values()], [all]);
  const allTags = useMemo(() => [...new Set(all.flatMap((a) => a.tags ?? []))].sort(), [all]);
  const collections = useMemo(() => [...new Set(all.map((a) => a.collection ?? "other"))], [all]);
  const kinds = useMemo(() => [...new Set(all.map((a) => a.kind ?? "logo"))], [all]);
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const list = useMemo(() => {
    const n = name.trim().toLowerCase();
    const r = all.filter((a) => {
      if (n && ![a.name, a.nameAr, a.code, a.description, a.descriptionAr, ...(a.tags ?? [])].some((x) => x?.toLowerCase().includes(n))) return false;
      if (cats.length && !cats.includes(a.category ?? "Other")) return false;
      if (tags.length && !tags.every((t) => a.tags?.includes(t))) return false;
      if (kind !== "all" && (a.kind ?? "logo") !== kind) return false;
      if (collection !== "all" && (a.collection ?? "other") !== collection) return false;
      if (hasFiles && !files.some((f) => f.asset_id === a.id)) return false;
      return true;
    });
    if (sort === "name") r.sort((a, b) => pick(a, "name").localeCompare(pick(b, "name")));
    if (sort === "newest") r.sort((a, b) => (b.founded ?? 0) - (a.founded ?? 0));
    return r;
  }, [all, files, name, cats, tags, kind, collection, hasFiles, sort, pick]);

  const chosen = all.filter((a) => sel.includes(a.id));
  const reset = () => { setName(""); setCats([]); setTags([]); setKind("all"); setCollection("all"); setHasFiles(false); setSort("default"); };
  const active = !!name || cats.length > 0 || tags.length > 0 || kind !== "all" || collection !== "all" || hasFiles;

  async function download() {
    setBusy(true);
    const id = toast.loading(L("Preparing download…", "جارٍ تجهيز التنزيل…"));
    try {
      if (chosen.length === 1) { const r = await resolveBlob(chosen[0], fmt, files); save(r.blob, r.name); }
      else {
        const JSZip = (await import("jszip")).default;
        const z = new JSZip();
        for (const a of chosen) { const r = await resolveBlob(a, fmt, files); z.file(r.name, r.blob); }
        z.file("metadata.csv", metadataCsv(chosen, fmt));
        save(await z.generateAsync({ type: "blob" }), "arwiqa-assets.zip");
      }
      toast.success(L("Downloaded", "تم التنزيل"), { id });
    } catch { toast.error(L("Download failed", "فشل التنزيل"), { id }); } finally { setBusy(false); }
  }

  const kindLabel = (k: string) => (k === "image" ? L("Images", "صور") : k === "logo" ? L("Logos", "شعارات") : k);
  const collLabel = (c: string) => (c === "saudi-banks" ? L("Saudi banks", "البنوك السعودية") : c === "arwiqa-images" ? L("Arwiqa images", "صور أروقة") : c);

  return (
    <SiteShell>
      <PageTitle eyebrow={L("Library", "المكتبة")} title={L("Images & digital assets", "الصور والأصول الرقمية")} sub={L("Every image, mockup and logo asset in one place. Filter, select and download.", "كل الصور والنماذج والشعارات في مكان واحد. صفِّ واختر ونزّل.")} />
      <div className="mx-auto grid max-w-7xl gap-8 px-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-6" aria-label={L("Filters", "عوامل التصفية")}>
          <label className="block text-sm">{L("Search name, code, tags", "ابحث بالاسم أو الرمز أو الوسوم")}
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-full border border-border bg-background px-4 py-2" placeholder={L("e.g. majlis", "مثال: مجلس")} />
          </label>
          <fieldset><legend className="mb-2 text-xs uppercase tracking-widest text-primary">{L("Categories", "التصنيفات")}</legend>
            <div className="flex flex-wrap gap-2">{categories.map((a) => { const c = a.category ?? "Other"; return <button key={c} type="button" aria-pressed={cats.includes(c)} onClick={() => setCats(toggle(cats, c))} className={chip(cats.includes(c))}>{a.category ? pick(a, "category") : c}</button>; })}</div>
          </fieldset>
          <fieldset><legend className="mb-2 text-xs uppercase tracking-widest text-primary">{L("Tags", "الوسوم")}</legend>
            <div className="flex flex-wrap gap-2">{allTags.map((t) => <button key={t} type="button" aria-pressed={tags.includes(t)} onClick={() => setTags(toggle(tags, t))} className={chip(tags.includes(t))}>#{t}</button>)}</div>
          </fieldset>
          <label className="block text-sm">{L("Type", "النوع")}
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="mt-1 w-full rounded-full border border-border bg-background px-3 py-2">
              <option value="all">{L("All", "الكل")}</option>{kinds.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
            </select>
          </label>
          <label className="block text-sm">{L("Collection", "المجموعة")}
            <select value={collection} onChange={(e) => setCollection(e.target.value)} className="mt-1 w-full rounded-full border border-border bg-background px-3 py-2">
              <option value="all">{L("All", "الكل")}</option>{collections.map((c) => <option key={c} value={c}>{collLabel(c)}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hasFiles} onChange={(e) => setHasFiles(e.target.checked)} className="accent-primary" />{L("Only with uploaded files", "فقط ما له ملفات مرفوعة")}</label>
          {active && <button onClick={reset} className="text-sm underline">{L("Clear all filters", "مسح كل عوامل التصفية")}</button>}
        </aside>

        <div>
          <div className="sticky top-[72px] z-30 mb-6 flex flex-wrap items-center gap-3 rounded-sm border border-border bg-background/95 p-3 backdrop-blur">
            <span className="text-sm text-muted-foreground" aria-live="polite">{num(list.length)} {L("assets", "أصل")} · {num(sel.length)} {L("selected", "محدد")}</span>
            <button onClick={() => setSel(list.map((a) => a.id))} className="rounded-full border border-border px-3 py-1.5 text-sm">{L("Select shown", "تحديد المعروض")}</button>
            <button onClick={() => setSel([])} className="rounded-full border border-border px-3 py-1.5 text-sm">{L("Clear", "مسح")}</button>
            <select aria-label={L("Sort", "ترتيب")} value={sort} onChange={(e) => setSort(e.target.value)} className="ms-auto rounded-full border border-border bg-background px-3 py-1.5 text-sm">
              <option value="default">{L("Featured", "مميز")}</option><option value="name">{L("Name", "الاسم")}</option><option value="newest">{L("Newest", "الأحدث")}</option>
            </select>
            <select aria-label={L("Format", "الصيغة")} value={fmt} onChange={(e) => setFmt(e.target.value as AssetFormat)} className="rounded-full border border-border bg-background px-3 py-1.5 text-sm">
              {FORMATS.map((x) => <option key={x} value={x}>{x.toUpperCase()}</option>)}
            </select>
            <button disabled={!chosen.length || busy} onClick={download} className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground disabled:opacity-50">{chosen.length > 1 ? L("Download ZIP", "تنزيل ZIP") : L("Download", "تنزيل")}</button>
          </div>

          {q.isLoading ? <p className="text-muted-foreground">{L("Loading…", "جارٍ التحميل…")}</p> : list.length === 0 ? (
            <p className="rounded-sm border border-border p-8 text-center text-muted-foreground">{L("No assets match these filters.", "لا توجد أصول مطابقة.")} <button onClick={reset} className="underline">{L("Clear filters", "مسح التصفية")}</button></p>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {list.map((a) => (
                <div key={a.id}>
                  <BankTile b={a} selected={sel.includes(a.id)} onToggle={() => setSel(toggle(sel, a.id))} />
                  <div className="mt-1 flex flex-wrap gap-1">{(a.tags ?? []).slice(0, 3).map((t) => <button key={t} onClick={() => setTags(tags.includes(t) ? tags : [...tags, t])} className="text-xs text-muted-foreground hover:text-primary">#{t}</button>)}</div>
                  <Link to="/assets/$id" params={{ id: a.id }} className="mt-1 block text-xs underline">{L("Details & files", "التفاصيل والملفات")} ({num(files.filter((x) => x.asset_id === a.id).length)})</Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
