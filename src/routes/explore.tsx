import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteShell, ArtCard, PageTitle } from "@/components/SiteShell";
import { artworks } from "@/lib/data";

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

function Explore() {
  const [q, setQ] = useState("");
  const list = artworks.filter((a) => (a.title + a.artist + a.medium).toLowerCase().includes(q.toLowerCase()));
  return (
    <SiteShell>
      <PageTitle eyebrow="Explore" title="Artworks" sub="Originals, editions, prints and licensed digital files." />
      <div className="mx-auto max-w-7xl px-6">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title, artist or medium…" className="mb-10 w-full border-b border-border bg-transparent py-3 text-lg outline-none focus:border-primary" />
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">{list.map((a) => <ArtCard key={a.id} a={a} />)}</div>
        {list.length === 0 && <p className="text-muted-foreground">No artworks match your search.</p>}
      </div>
    </SiteShell>
  );
}
