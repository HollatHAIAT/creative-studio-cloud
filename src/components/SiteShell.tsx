import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { Artwork } from "@/lib/data";
import { fmt } from "@/lib/data";

const nav = [
  { to: "/explore", label: "Explore" },
  { to: "/auctions", label: "Auctions" },
  { to: "/exhibitions", label: "Exhibitions" },
  { to: "/artists", label: "Artists" },
] as const;

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="font-display text-2xl tracking-tight">creative<span className="text-primary">studio</span></Link>
          <nav className="hidden gap-8 text-sm md:flex">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} className="text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground" }}>{n.label}</Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">EN · العربية</span>
            <Link to="/sell" className="rounded-full bg-primary px-4 py-2 text-primary-foreground hover:opacity-90">Start selling</Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="mt-24 border-t border-border">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 text-sm text-muted-foreground md:grid-cols-4">
          <div><p className="font-display text-xl text-foreground">creativestudio</p><p className="mt-2">The global marketplace for art, prints, auctions and exhibitions.</p></div>
          <div><p className="text-foreground">Buy</p><p>Originals</p><p>Prints</p><p>Digital licenses</p></div>
          <div><p className="text-foreground">Sell</p><p>Artist storefronts</p><p>Auctions</p><p>Exhibitions</p></div>
          <div><p className="text-foreground">Company</p><p>About</p><p>Licensing</p><p>Support</p></div>
        </div>
      </footer>
    </div>
  );
}

export function ArtCard({ a }: { a: Artwork }) {
  return (
    <Link to="/artwork/$id" params={{ id: a.id }} className="group block">
      <div className="overflow-hidden rounded-sm bg-muted">
        <img src={a.image} alt={a.title} loading="lazy" width={768} height={960} className="aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-105" />
      </div>
      <div className="mt-3 flex items-start justify-between gap-2">
        <div><p className="font-display text-lg">{a.title}</p><p className="text-sm text-muted-foreground">{a.artist}</p></div>
        <div className="text-right text-sm">
          {a.auction ? (<><p className="text-primary">{fmt(a.auction.currentBid)}</p><p className="text-muted-foreground">{a.auction.endsIn}</p></>) : <p>{fmt(a.price)}</p>}
        </div>
      </div>
    </Link>
  );
}

export function PageTitle({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mx-auto max-w-7xl px-6 pb-10 pt-16">
      <p className="text-xs uppercase tracking-[0.3em] text-primary">{eyebrow}</p>
      <h1 className="mt-3 font-display text-5xl md:text-6xl">{title}</h1>
      {sub && <p className="mt-4 max-w-2xl text-muted-foreground">{sub}</p>}
    </div>
  );
}
