import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useState } from "react";
import { SiteShell, ArtCard, PageTitle } from "@/components/SiteShell";
import { categories, minPrice } from "@/lib/data";
import { useListings } from "@/lib/store";
import { useLocale, type Key } from "@/lib/i18n";

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
  component: Explore,
});

const sorts = { newest: "sort.newest", "price-asc": "sort.priceAsc", "price-desc": "sort.priceDesc", title: "sort.title" } as const;

function Explore() {
  const all = useListings();
  const { t, pick, num, locale } = useLocale();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const [sort, setSort] = useState<keyof typeof sorts>("newest");
  const list = all
    .filter((a) => (cat === "All" || a.category === cat) && [a.title, a.titleAr, a.artist, a.artistAr, a.medium, a.mediumAr, a.description].join(" ").toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => sort === "newest" ? b.createdAt - a.createdAt : sort === "price-asc" ? minPrice(a) - minPrice(b) : sort === "price-desc" ? minPrice(b) - minPrice(a) : pick(a, "title").localeCompare(pick(b, "title")));
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
        {list.length === 0 && <p className="text-muted-foreground">{t("explore.none")}</p>}
      </div>
    </SiteShell>
  );
}
