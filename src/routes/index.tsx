import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell, ArtCard } from "@/components/SiteShell";
import { artworks, exhibitions, heroImage } from "@/lib/data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "creativestudio — Global marketplace for art & creative assets" },
      { name: "description", content: "Buy originals, prints and digital licenses, bid in auctions and visit exhibitions from artists worldwide." },
      { property: "og:title", content: "creativestudio — Global art marketplace" },
      { property: "og:description", content: "Originals, prints, auctions and exhibitions in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <SiteShell>
      <section className="mx-auto grid max-w-7xl items-end gap-10 px-6 pt-16 md:grid-cols-12">
        <div className="md:col-span-5">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Art · Prints · Auctions · Exhibitions</p>
          <h1 className="mt-4 font-display text-6xl leading-[0.95] md:text-7xl">Where the world collects art.</h1>
          <p className="mt-6 text-lg text-muted-foreground">Originals, limited editions, digital licenses and live auctions — from independent artists and galleries across 120 countries.</p>
          <div className="mt-8 flex gap-3">
            <Link to="/explore" className="rounded-full bg-primary px-6 py-3 text-primary-foreground">Explore artworks</Link>
            <Link to="/auctions" className="rounded-full border border-foreground px-6 py-3">Live auctions</Link>
          </div>
        </div>
        <div className="md:col-span-7">
          <img src={heroImage} alt="Gallery exhibition hall" width={1600} height={912} className="w-full rounded-sm object-cover" />
        </div>
      </section>

      <section className="mx-auto mt-10 grid max-w-7xl grid-cols-2 gap-6 border-y border-border px-6 py-8 text-center md:grid-cols-4">
        {[["48k", "Artists"], ["1.2M", "Artworks"], ["320", "Exhibitions"], ["$18M", "Paid to creators"]].map(([n, l]) => (
          <div key={l}><p className="font-display text-4xl">{n}</p><p className="text-sm text-muted-foreground">{l}</p></div>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-6 pt-20">
        <div className="mb-8 flex items-end justify-between"><h2 className="font-display text-4xl">New this week</h2><Link to="/explore" className="text-sm underline">View all</Link></div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">{artworks.slice(0, 6).map((a) => <ArtCard key={a.id} a={a} />)}</div>
      </section>

      <section className="mx-auto mt-24 max-w-7xl px-6">
        <div className="mb-8 flex items-end justify-between"><h2 className="font-display text-4xl">Exhibitions</h2><Link to="/exhibitions" className="text-sm underline">All exhibitions</Link></div>
        <div className="grid gap-6 md:grid-cols-3">
          {exhibitions.map((e) => (
            <div key={e.id} className="rounded-sm border border-border bg-card p-4">
              <img src={e.image} alt={e.title} loading="lazy" className="aspect-video w-full rounded-sm object-cover" />
              <p className="mt-4 text-xs uppercase tracking-widest text-primary">{e.type}</p>
              <p className="font-display text-2xl">{e.title}</p>
              <p className="text-sm text-muted-foreground">{e.venue} · {e.dates}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-24 max-w-7xl px-6">
        <div className="rounded-sm bg-secondary p-12 md:flex md:items-center md:justify-between">
          <div><h2 className="font-display text-4xl text-secondary-foreground">Open your storefront.</h2><p className="mt-2 text-secondary-foreground/70">Sell originals, prints and licenses. Run auctions. Host exhibitions.</p></div>
          <Link to="/sell" className="mt-6 inline-block rounded-full bg-primary px-6 py-3 text-primary-foreground md:mt-0">Become a seller</Link>
        </div>
      </section>
    </SiteShell>
  );
}
