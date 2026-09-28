import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useState } from "react";
import { SiteShell, ArtCard, PageTitle } from "@/components/SiteShell";
import { categories, minPrice } from "@/lib/data";
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
  validateSearch: (s: Record<string, unknown>): { q?: string | undefined; cat?: string | undefined; min?: number | undefined; max?: number | undefined } => ({
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
  const list = all
    .filter((a) => (search.min == null || minPrice(a) >= search.min) && (search.max == null || minPrice(a) < search.max))
    .filter((a) => (cat === "All" || a.category === cat) && [a.title, a.titleAr, a.artist, a.artistAr, a.medium, a.mediumAr, a.description].join(" ").toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => sort === "newest" ? b.createdAt - a.createdAt : sort === "price-asc" ? minPrice(a) - minPrice(b) : sort === "price-desc" ? minPrice(b) - minPrice(a) : pick(a, "title").localeCompare(pick(b, "title")));
  const sellers = useQuery({ queryKey: ["seller-listings"], queryFn: () => listSellerListings() });
  const sellerList = (sellers.data ?? []).filter((l) => (cat === "All" || l.category === cat)
    && (search.min == null || l.price >= search.min) && (search.max == null || l.price < search.max)
    && [l.title, l.titleAr, l.medium, l.description, ...l.tags].join(" ").toLowerCase().includes(q.toLowerCase()));
  return (
    <SiteShell>
      <PageTitle eyebrow={t("nav.explore")} title={t("explore.title")} sub={t("explore.sub")} />
      <div className="mx-auto max-w-7xl px-6">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("explore.search")} className="w-full border-b border-border bg-transparent py-3 text-lg outline-none focus:border-primary" />
        <div className="my-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {["All", ...categories].map((c) => (
              <button key={c} onClick={() => setCat(c)} className={`rounded-full border px-4 py-1.5 text-sm ${cat === c ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{c === "All" ? t("explore.all") : t(`cat.${c}` as Key)}</button>
            ))}
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value as keyof typeof sorts)} className="rounded-full border border-border bg-background px-4 py-2 text-sm">
            {Object.entries(sorts).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
          </select>
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
        {list.length === 0 && sellerList.length === 0 && <p className="text-muted-foreground">{t("explore.none")}</p>}
      </div>
    </SiteShell>
  );
}
