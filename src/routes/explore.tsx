import { usePlatformSettings, num } from "@/lib/platform-settings";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useRecentlyViewed } from "@/lib/recently-viewed";
import { useState } from "react";
import { SiteShell, ArtCard, PageTitle } from "@/components/SiteShell";
import { categories, minPrice, variantsOf } from "@/lib/data";
import { useListings } from "@/lib/store";
import { useLocale, type Key } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { listSellerListings } from "@/lib/seller-listings.functions";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore artworks — Arwiqa أروقة" },
      { name: "description", content: "Search paintings, photography, calligraphy, prints and digital assets." },
      { property: "og:title", content: "Explore artworks — Arwiqa أروقة" },
      { property: "og:description", content: "Search paintings, photography, prints and digital assets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { q?: string | undefined; cat?: string | undefined; min?: number | undefined; max?: number | undefined; format?: "original" | "print" | "license" | undefined } => ({
    format: s["format"] === "original" || s["format"] === "print" || s["format"] === "license" ? s["format"] : undefined,
    q: typeof s["q"] === "string" ? s["q"] : undefined,
    cat: typeof s["cat"] === "string" ? s["cat"] : undefined,
    min: typeof s["min"] === "number" ? s["min"] : undefined,
    max: typeof s["max"] === "number" ? s["max"] : undefined,
  }),
  component: Explore,
});

const sorts = { newest: "sort.newest", "price-asc": "sort.priceAsc", "price-desc": "sort.priceDesc", title: "sort.title" } as const;

function Explore() {
  const all = useListings();
  const { t, pick, num, locale } = useLocale();
  const search = Route.useSearch();
  const [q, setQ] = useState(search.q ?? "");
  const [cat, setCat] = useState<string>(search.cat && (categories as readonly string[]).includes(search.cat) ? search.cat : "All");
  const [sort, setSort] = useState<keyof typeof sorts>("newest");
  const [sheet, setSheet] = useState(false);
  const recent = useRecentlyViewed().map((r) => all.find((x) => x.id === r)).filter((x): x is NonNullable<typeof x> => !!x).slice(0, 4);
  const ar = locale === "ar";
  const list = all
    .filter((a) => !search.format || variantsOf(a).some((v) => v.kind === search.format))
    .filter((a) => (search.min == null || minPrice(a) >= search.min) && (search.max == null || minPrice(a) < search.max))
    .filter((a) => (cat === "All" || a.category === cat) && [a.title, a.titleAr, a.artist, a.artistAr, a.medium, a.mediumAr, a.description].join(" ").toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => sort === "newest" ? b.createdAt - a.createdAt : sort === "price-asc" ? minPrice(a) - minPrice(b) : sort === "price-desc" ? minPrice(b) - minPrice(a) : pick(a, "title").localeCompare(pick(b, "title")));
  const sellers = useQuery({ queryKey: ["seller-listings"], queryFn: () => listSellerListings() });
  const sellerList = (search.format && search.format !== "original" ? [] : sellers.data ?? []).filter((l) => (cat === "All" || l.category === cat)
    && (search.min == null || l.price >= search.min) && (search.max == null || l.price < search.max)
    && [l.title, l.titleAr, l.medium, l.description, ...l.tags].join(" ").toLowerCase().includes(q.toLowerCase()));
  return (
    <SiteShell>
      <PageTitle eyebrow={t("nav.explore")} title={t("explore.title")} sub={t("explore.sub")} />
      <div className="mx-auto max-w-7xl px-6">
        {search.format && <FormatGuide format={search.format} ar={ar} />}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("explore.search")} className="w-full border-b border-border bg-transparent py-3 text-lg outline-none focus:border-primary" />
        <div className="my-8 hidden flex-wrap items-center justify-between gap-4 md:flex">
          <div className="flex flex-wrap gap-2">{["All", ...categories].map((c) => (
              <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className={`rounded-full border px-4 py-1.5 text-sm ${cat === c ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{c === "All" ? t("explore.all") : t(`cat.${c}` as Key)}</button>
            ))}</div>
          <select value={sort} onChange={(e) => setSort(e.target.value as keyof typeof sorts)} aria-label={ar ? "الترتيب" : "Sort"} className="rounded-full border border-border bg-background px-4 py-2 text-sm">
            {Object.entries(sorts).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
          </select>
        </div>
        <div className="my-6 flex items-center justify-between gap-3 md:hidden">
          <Sheet open={sheet} onOpenChange={setSheet}>
            <SheetTrigger asChild>
              <button type="button" className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm">
                <SlidersHorizontal aria-hidden className="h-4 w-4" />{ar ? "التصفية والترتيب" : "Filter & sort"}{cat !== "All" && <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">1</span>}
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl">
              <SheetHeader><SheetTitle>{ar ? "التصفية والترتيب" : "Filter & sort"}</SheetTitle></SheetHeader>
              <p className="mt-4 text-sm text-muted-foreground">{ar ? "الفئة" : "Category"}</p>
              <div className="mt-2 flex flex-wrap gap-2">{["All", ...categories].map((c) => (
              <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className={`rounded-full border px-4 py-1.5 text-sm ${cat === c ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{c === "All" ? t("explore.all") : t(`cat.${c}` as Key)}</button>
            ))}</div>
              <p className="mt-5 text-sm text-muted-foreground">{ar ? "الترتيب" : "Sort"}</p>
              <div className="mt-2"><select value={sort} onChange={(e) => setSort(e.target.value as keyof typeof sorts)} aria-label={ar ? "الترتيب" : "Sort"} className="rounded-full border border-border bg-background px-4 py-2 text-sm">
            {Object.entries(sorts).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
          </select></div>
              <div className="mt-6 flex gap-2">
                <button type="button" onClick={() => { setCat("All"); setSort("newest"); }} className="flex-1 rounded-full border border-border py-3 text-sm">{ar ? "إعادة الضبط" : "Reset"}</button>
                <button type="button" onClick={() => setSheet(false)} className="flex-1 rounded-full bg-primary py-3 text-sm text-primary-foreground">{ar ? `اعرض ${num(list.length)} نتيجة` : `Show ${list.length} results`}</button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{num(list.length)} {t("explore.results")}</p>
          <Link to="/saved-searches" search={{ q: q || undefined, cat: cat === "All" ? undefined : cat }} className="inline-flex items-center gap-1.5 rounded-full border border-primary px-4 py-1.5 text-sm text-primary hover:bg-primary hover:text-primary-foreground">
            <Bell aria-hidden className="h-4 w-4" />{locale === "ar" ? "احفظ هذا البحث ونبّهني" : "Save this search & alert me"}
          </Link>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">{list.map((a) => <ArtCard key={a.id} a={a} />)}</div>
        {sellerList.length > 0 && (
          <section aria-labelledby="new-sellers" className="mt-14">
            <h2 id="new-sellers" className="mb-6 font-display text-2xl">{locale === "ar" ? "جديد من البائعين" : "New from sellers"}</h2>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {sellerList.map((l) => (
                <Link key={l.id} to="/listing/$id" params={{ id: l.id }} className="group block">
                  {l.imageUrl ? <img src={l.imageUrl} alt={locale === "ar" ? l.altTextAr : l.altText} loading="lazy" className="aspect-[4/5] w-full rounded-2xl object-cover" /> : <div className="aspect-[4/5] rounded-2xl bg-muted" />}
                  <p className="mt-3 font-medium group-hover:underline">{locale === "ar" ? l.titleAr : l.title}</p>
                  <p className="text-sm text-muted-foreground">{l.medium} · ${l.price.toLocaleString()}</p>
                </Link>))}
            </div>
          </section>)}
        {list.length === 0 && sellerList.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-muted-foreground">{t("explore.none")}</p>
            <button type="button" onClick={() => { setQ(""); setCat("All"); }} className="mt-3 rounded-full border border-primary px-4 py-1.5 text-sm text-primary">{ar ? "امسح البحث والتصفية" : "Clear search & filters"}</button>
          </div>)}
        {recent.length > 0 && (
          <section aria-labelledby="recent-h" className="mt-14">
            <h2 id="recent-h" className="mb-6 font-display text-2xl">{ar ? "شاهدتها مؤخرًا" : "Recently viewed"}</h2>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">{recent.map((a) => <ArtCard key={a.id} a={a} />)}</div>
          </section>)}
      </div>
    </SiteShell>
  );
}

const GUIDE = {
  original: { en: ["Original artworks", "One-of-a-kind pieces shipped from the artist or gallery.", ["Pick a work and choose “Original”", "Pay by bank transfer at checkout", "The seller packs and ships with tracking", "Confirm delivery — {R}-day return window"]],
    ar: ["الأعمال الأصلية", "قطع فريدة تُشحن من الفنان أو المعرض مباشرة.", ["اختر العمل ثم «أصلي»", "ادفع بالتحويل البنكي عند الدفع", "يغلّف البائع العمل ويشحنه مع رقم تتبع", "أكّد الاستلام — مهلة إرجاع {R} يومًا"]] },
  print: { en: ["Prints", "Numbered editions in several sizes and papers.", ["Choose a size and material", "Check the edition number still available", "Pay at checkout", "Printed and shipped within {A}–{B} days"]],
    ar: ["المطبوعات", "نسخ مرقّمة بعدة مقاسات وخامات.", ["اختر المقاس والخامة", "تأكد من رقم الإصدار المتاح", "ادفع عند الدفع", "تُطبع وتُشحن خلال {A}–{B} أيام"]] },
  license: { en: ["Digital licenses", "Use artwork in your projects — personal, commercial or extended.", ["Choose the license that fits your use", "Pay at checkout", "Download the file from your order page", "Keep the license certificate with your project"]],
    ar: ["التراخيص الرقمية", "استخدم الأعمال في مشاريعك — شخصي أو تجاري أو موسّع.", ["اختر الترخيص المناسب لاستخدامك", "ادفع عند الدفع", "حمّل الملف من صفحة طلبك", "احتفظ بشهادة الترخيص مع مشروعك"]] },
} as const;

function FormatGuide({ format, ar }: { format: keyof typeof GUIDE; ar: boolean }) {
  const [title, sub, raw] = GUIDE[format][ar ? "ar" : "en"];
  const ps = usePlatformSettings();
  const steps = raw.map((x) => x.replace("{R}", num(ps.return_days, ar)).replace("{A}", num(ps.print_ship_min_days, ar)).replace("{B}", num(ps.print_ship_max_days, ar)));
  return (
    <section className="mb-8 rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-display text-2xl">{title}</h2><p className="text-muted-foreground">{sub}</p></div>
        <div className="flex gap-2 text-sm">
          {format === "license" && <Link to="/licensing" className="rounded-full border border-border px-4 py-2">{ar ? "شروط التراخيص" : "License terms"}</Link>}
          <Link to="/explore" className="rounded-full border border-border px-4 py-2">{ar ? "كل الأعمال" : "All artworks"}</Link>
        </div>
      </div>
      <ol className="mt-4 grid gap-3 md:grid-cols-4">{steps.map((st, i) => <li key={i} className="rounded-xl bg-muted p-3 text-sm"><span className="font-display text-primary">{i + 1}</span> {st}</li>)}</ol>
    </section>
  );
}
