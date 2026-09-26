import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell, ArtCard, PageTitle } from "@/components/SiteShell";
import { useListings, useStore } from "@/lib/store";

export const Route = createFileRoute("/favorites")({
  head: () => ({
    meta: [
      { title: "Your favorites — creativestudio" },
      { name: "description", content: "Artworks you've saved on creativestudio." },
      { property: "og:title", content: "Favorites — creativestudio" },
      { property: "og:description", content: "Artworks you've saved." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Favorites,
});

function Favorites() {
  const { favorites } = useStore();
  const list = useListings().filter((l) => favorites.includes(l.id));
  return (
    <SiteShell>
      <PageTitle eyebrow="Saved" title="Favorites" />
      <div className="mx-auto max-w-7xl px-6">
        {list.length === 0 ? (
          <p className="text-muted-foreground">Nothing saved yet. Tap the heart on any artwork. <Link to="/explore" className="underline">Explore</Link></p>
        ) : <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">{list.map((a) => <ArtCard key={a.id} a={a} />)}</div>}
      </div>
    </SiteShell>
  );
}
