import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Heart } from "lucide-react";
import type { Artwork } from "@/lib/data";
import { fmt } from "@/lib/data";
import { actions, useStore } from "@/lib/store";

const nav = [
  { to: "/explore", label: "Explore" },
  { to: "/auctions", label: "Auctions" },
  { to: "/exhibitions", label: "Exhibitions" },
  { to: "/artists", label: "Artists" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/analytics", label: "Analytics" },
] as const;

export function SiteShell({ children }: { children: ReactNode }) {
  const { favorites } = useStore();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="font-display text-2xl tracking-tight">creative<span className="text-primary">studio</span></Link>
          <nav className="hidden gap-7 text-sm md:flex">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} className="text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground" }}>{n.label}</Link>
            ))}
          </nav>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/favorites" className="flex items-center gap-1" aria-label="Favorites"><Heart className="h-5 w-5" />{favorites.length > 0 && <span>{favorites.length}</span>}</Link>
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

export function FavButton({ id, className = "" }: { id: string; className?: string }) {
  const { favorites } = useStore();
  const on = favorites.includes(id);
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); actions.toggleFavorite(id); }}
      aria-label={on ? "Remove from favorites" : "Save to favorites"}
      className={`rounded-full bg-background/90 p-2 ${className}`}
    >
      <Heart className={`h-4 w-4 ${on ? "fill-primary text-primary" : ""}`} />
    </button>
  );
}

export function ArtCard({ a }: { a: Artwork }) {
  return (
    <Link to="/artwork/$id" params={{ id: a.id }} className="group block">
      <div className="relative overflow-hidden rounded-sm bg-muted">
        <img src={a.image} alt={a.title} loading="lazy" className="aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-105" />
        <span className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs">{a.category}</span>
        <FavButton id={a.id} className="absolute right-3 top-3" />
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
