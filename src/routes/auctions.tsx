import { createFileRoute } from "@tanstack/react-router";
import { SiteShell, ArtCard, PageTitle } from "@/components/SiteShell";
import { artworks } from "@/lib/data";

export const Route = createFileRoute("/auctions")({
  head: () => ({
    meta: [
      { title: "Live auctions — creativestudio" },
      { name: "description", content: "Bid on original artworks with reserve prices and scheduled closing times." },
      { property: "og:title", content: "Live auctions — creativestudio" },
      { property: "og:description", content: "Bid on original artworks from artists worldwide." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <SiteShell>
      <PageTitle eyebrow="Auctions" title="Live now" sub="Place bids on originals. Reserve prices and closing times set by each artist." />
      <div className="mx-auto grid max-w-7xl gap-8 px-6 sm:grid-cols-2 lg:grid-cols-3">
        {artworks.filter((a) => a.auction).map((a) => <ArtCard key={a.id} a={a} />)}
      </div>
    </SiteShell>
  ),
});
