import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { SiteShell } from "@/components/SiteShell";
import { artworks, fmt } from "@/lib/data";

export const Route = createFileRoute("/artwork/$id")({
  loader: ({ params }) => {
    const a = artworks.find((x) => x.id === params.id);
    if (!a) throw notFound();
    return a;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? "Artwork"} by ${loaderData?.artist ?? ""} — creativestudio` },
      { name: "description", content: `${loaderData?.title} — ${loaderData?.medium}. Available as original, print or license.` },
      { property: "og:title", content: `${loaderData?.title} — creativestudio` },
      { property: "og:description", content: loaderData?.medium ?? "" },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Detail,
});

function Detail() {
  const a = Route.useLoaderData();
  const [fmtSel, setFmt] = useState(a.formats[0]);
  return (
    <SiteShell>
      <div className="mx-auto grid max-w-7xl gap-12 px-6 pt-12 md:grid-cols-2">
        <img src={a.image} alt={a.title} width={768} height={960} className="w-full rounded-sm object-cover" />
        <div>
          <p className="text-sm text-muted-foreground">{a.artist}</p>
          <h1 className="font-display text-5xl">{a.title}</h1>
          <p className="mt-2 text-muted-foreground">{a.medium} · {a.year}</p>
          <p className="mt-8 text-sm uppercase tracking-widest">Format</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {a.formats.map((f) => (
              <button key={f} onClick={() => setFmt(f)} className={`rounded-full border px-4 py-2 text-sm ${fmtSel === f ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{f}</button>
            ))}
          </div>
          <p className="mt-8 font-display text-4xl">{fmt(a.price)}</p>
          <button className="mt-4 w-full rounded-full bg-primary py-4 text-primary-foreground">Add to cart</button>
          {a.auction && (
            <div className="mt-8 rounded-sm border border-primary p-6">
              <p className="text-xs uppercase tracking-widest text-primary">Live auction · ends in {a.auction.endsIn}</p>
              <p className="mt-2 font-display text-3xl">{fmt(a.auction.currentBid)}</p>
              <p className="text-sm text-muted-foreground">{a.auction.bids} bids</p>
              <button className="mt-4 w-full rounded-full border border-foreground py-3">Place a bid</button>
            </div>
          )}
          <p className="mt-8 text-sm text-muted-foreground">Certificate of authenticity included. Worldwide shipping for physical works. Licenses delivered instantly.</p>
        </div>
      </div>
    </SiteShell>
  );
}
