import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { SiteShell, FavButton } from "@/components/SiteShell";
import { artworks, creatorOf, fmt } from "@/lib/data";
import { useListings } from "@/lib/store";

export const Route = createFileRoute("/artwork/$id")({
  head: ({ params }) => {
    const a = artworks.find((x) => x.id === params.id);
    const title = a ? `${a.title} by ${a.artist} — creativestudio` : "Artwork — creativestudio";
    const desc = a?.description ?? "Original art, prints and licenses on creativestudio.";
    return { meta: [
      { title }, { name: "description", content: desc },
      { property: "og:title", content: title }, { property: "og:description", content: desc },
      { property: "og:type", content: "product" }, { name: "twitter:card", content: "summary_large_image" },
    ] };
  },
  component: Detail,
});

function Detail() {
  const { id } = Route.useParams();
  const a = useListings().find((x) => x.id === id);
  const [img, setImg] = useState(0);
  const [format, setFormat] = useState<string | null>(null);
  if (!a) return <SiteShell><div className="p-16 text-center"><p>This listing isn't available.</p><Link to="/explore" className="underline">Back to explore</Link></div></SiteShell>;
  const creator = creatorOf(a.creatorId);
  const sel = format ?? a.formats[0];
  return (
    <SiteShell>
      <div className="mx-auto grid max-w-7xl gap-12 px-6 pt-12 md:grid-cols-2">
        <div>
          <div className="relative">
            <img src={a.images[img] ?? a.image} alt={a.title} className="aspect-[4/5] w-full rounded-sm object-cover" />
            <FavButton id={a.id} className="absolute end-4 top-4" />
          </div>
          {a.images.length > 1 && (
            <div className="mt-3 flex gap-3">
              {a.images.map((src, i) => (
                <button key={i} onClick={() => setImg(i)} className={`h-20 w-20 overflow-hidden rounded-sm border-2 ${i === img ? "border-primary" : "border-transparent"}`}>
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-primary">{a.category}</p>
          <h1 className="mt-2 font-display text-5xl">{a.title}</h1>
          {creator && <Link to="/artists/$id" params={{ id: creator.id }} className="mt-2 inline-block underline">{creator.name}</Link>}
          <p className="mt-1 text-muted-foreground">{a.medium} · {a.year}</p>
          <p className="mt-6 leading-relaxed">{a.description}</p>
          <p className="mt-8 text-sm uppercase tracking-widest">Format</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {a.formats.map((f) => (
              <button key={f} onClick={() => setFormat(f)} className={`rounded-full border px-4 py-2 text-sm ${sel === f ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{f}</button>
            ))}
          </div>
          <p className="mt-8 font-display text-4xl">{fmt(a.price)}</p>
          <button onClick={() => toast.success(`${a.title} (${sel}) added to your cart`)} className="mt-4 w-full rounded-full bg-primary py-4 text-primary-foreground">Buy now</button>
          {a.auction && (
            <div className="mt-8 rounded-sm border border-primary p-6">
              <p className="text-xs uppercase tracking-widest text-primary">Live auction · ends in {a.auction.endsIn}</p>
              <p className="mt-2 font-display text-3xl">{fmt(a.auction.currentBid)}</p>
              <p className="text-sm text-muted-foreground">{a.auction.bids} bids</p>
              <button onClick={() => toast("Bidding opens once accounts are live")} className="mt-4 w-full rounded-full border border-foreground py-3">Place a bid</button>
            </div>
          )}
          {creator && (
            <div className="mt-8 flex items-center gap-4 border-t border-border pt-6">
              <img src={creator.image} alt="" className="h-12 w-12 rounded-full object-cover" />
              <div><p>{creator.name}</p><p className="text-sm text-muted-foreground">{creator.discipline} · {creator.city}</p></div>
            </div>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
