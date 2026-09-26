import { createFileRoute } from "@tanstack/react-router";
import { SiteShell, PageTitle } from "@/components/SiteShell";

export const Route = createFileRoute("/sell")({
  head: () => ({
    meta: [
      { title: "Sell on creativestudio" },
      { name: "description", content: "Open a storefront to sell originals, prints, licenses, auctions and exhibition tickets." },
      { property: "og:title", content: "Sell on creativestudio" },
      { property: "og:description", content: "Open your artist or gallery storefront." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <SiteShell>
      <PageTitle eyebrow="For artists & galleries" title="Sell everywhere, from one studio." sub="One storefront for originals, editions, print-on-demand, digital licenses, auctions and exhibitions." />
      <div className="mx-auto grid max-w-7xl gap-6 px-6 md:grid-cols-3">
        {[["Storefront", "Portfolio, pricing, inventory and orders."], ["Auctions", "Reserve prices, scheduled open & close, live bids."], ["Exhibitions", "Virtual rooms, physical shows, ticketing and invites."], ["Prints", "Sizes, materials and unlimited reproductions."], ["Licensing", "Personal, commercial and extended licenses."], ["Analytics", "Sales, revenue, visitors and popularity."]].map(([t, d]) => (
          <div key={t} className="rounded-sm border border-border bg-card p-6"><p className="font-display text-2xl">{t}</p><p className="mt-2 text-muted-foreground">{d}</p></div>
        ))}
      </div>
    </SiteShell>
  ),
});
