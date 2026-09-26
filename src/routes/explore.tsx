import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteShell, ArtCard, PageTitle } from "@/components/SiteShell";
import { categories } from "@/lib/data";
import { useListings } from "@/lib/store";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore artworks — creativestudio" },
      { name: "description", content: "Search paintings, photography, calligraphy, prints and digital assets." },
      { property: "og:title", content: "Explore artworks — creativestudio" },
      { property: "og:description", content: "Search paintings, photography, prints and digital assets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Explore,
});

const sorts = { newest: "Newest", "price-asc": "Price: low to high", "price-desc": "Price: high to low", title: "Title A–Z" } as const;

function Explore() {
  const all = useListings();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const [sort, setSort] = useState<keyof typeof sorts>("newest");
  const list = all
    .filter((a) => (cat === "All" || a.category === cat) && (a.title + a.artist + a.medium + a.description).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => sort === "newest" ? b.createdAt - a.createdAt : sort === "price-asc" ? a.price - b.price : sort === "price-desc" ? b.price - a.price : a.title.localeCompare(b.title));
  return (
    <SiteShell>
      <PageTitle eyebrow="Explore" title="Artworks" sub="Originals, editions, prints and licensed digital files." />
      <div className="mx-auto max-w-7xl px-6">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title, artist or medium…" className="w-full border-b border-border bg-transparent py-3 text-lg outline-none focus:border-primary" />
        <div className="my-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {["All", ...categories].map((c) => (
              <button key={c} onClick={() => setCat(c)} className={`rounded-full border px-4 py-1.5 text-sm ${cat === c ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{c}</button>
            ))}
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value as keyof typeof sorts)} className="rounded-full border border-border bg-background px-4 py-2 text-sm">
            {Object.entries(sorts).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">{list.length} results</p>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">{list.map((a) => <ArtCard key={a.id} a={a} />)}</div>
        {list.length === 0 && <p className="text-muted-foreground">No artworks match your search.</p>}
      </div>
    </SiteShell>
  );
}
