import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { minPrice } from "@/lib/data";
import type { Key } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n";
import { SiteShell, ArtCard } from "@/components/SiteShell";
import { creatorOf } from "@/lib/data";
import { useListings } from "@/lib/store";

export const Route = createFileRoute("/artists/$id")({
  loader: ({ params }) => {
    const c = creatorOf(params.id);
    if (!c) throw notFound();
    return c;
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [
      { title: `${loaderData.name} — ${loaderData.discipline} on Arwiqa` },
      { name: "description", content: loaderData.bio },
      { property: "og:title", content: `${loaderData.name} — Arwiqa أروقة` },
      { property: "og:description", content: loaderData.bio },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ] : [{ title: "Artist not found" }, { name: "robots", content: "noindex" }],
  }),
  notFoundComponent: () => <SiteShell><p className="p-16 text-center">Artist not found.</p></SiteShell>,
  component: Profile,
});

function Profile() {
  const c = Route.useLoaderData();
  const { t, pick, num, locale } = useLocale();
  const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const works = useListings().filter((l) => l.creatorId === c.id);
  const cats = [...new Set(works.map((w) => w.category))];
  const [cat, setCat] = useState("All");
  const [sort, setSort] = useState<"newest" | "low" | "high">("newest");
  const shown = works.filter((w) => cat === "All" || w.category === cat)
    .sort((a, b) => sort === "newest" ? b.createdAt - a.createdAt : sort === "low" ? minPrice(a) - minPrice(b) : minPrice(b) - minPrice(a));
  const cover = works[0]?.image;
  const from = works.length ? Math.min(...works.map(minPrice)) : null;
  return (
    <SiteShell>
      <section className="relative isolate overflow-hidden">
        {cover && <img src={cover} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full scale-110 object-cover opacity-25 blur-2xl" />}
        <div aria-hidden className="sadu-thin" />
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-16 md:flex-row md:items-end">
          <img src={c.image} alt={pick(c, "name")} className="h-40 w-40 rounded-full border-4 border-background object-cover shadow-xl" />
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.3em] text-primary">{pick(c, "discipline")} · {pick(c, "city")}</p>
            <h1 className="mt-2 font-display text-5xl md:text-6xl">{pick(c, "name")}</h1>
            <p className="mt-4 max-w-2xl text-muted-foreground">{pick(c, "bio")}</p>
          </div>
          <dl className="grid grid-cols-3 gap-6 text-center">
            <div><dt className="text-xs text-muted-foreground">{t("artists.listings")}</dt><dd className="font-display text-3xl">{num(works.length)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("artists.followers")}</dt><dd className="font-display text-3xl">{num(c.followers)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{L("From", "ابتداءً من")}</dt><dd className="font-display text-3xl">{from != null ? `$${num(from)}` : "—"}</dd></div>
          </dl>
        </div>
      </section>
      <section className="mx-auto mt-10 max-w-7xl px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-3xl">{t("artists.listings")}</h2>
          <div className="flex flex-wrap items-center gap-2">
            {cats.length > 1 && ["All", ...cats].map((x) => (
              <button key={x} type="button" aria-pressed={cat === x} onClick={() => setCat(x)} className={`rounded-full border px-3 py-1 text-sm ${cat === x ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{x === "All" ? t("explore.all") : t(`cat.${x}` as Key)}</button>))}
            <select aria-label={L("Sort", "الترتيب")} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded-full border border-border bg-background px-3 py-1.5 text-sm">
              <option value="newest">{L("Newest", "الأحدث")}</option><option value="low">{L("Price: low to high", "السعر: من الأقل")}</option><option value="high">{L("Price: high to low", "السعر: من الأعلى")}</option>
            </select>
          </div>
        </div>
        {shown.length ? <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">{shown.map((a) => <ArtCard key={a.id} a={a} />)}</div>
          : <p className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">{L("No works listed yet.", "لا أعمال معروضة بعد.")}</p>}
      </section>
    </SiteShell>
  );
}
