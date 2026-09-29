import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect } from "react";
import { countView } from "@/lib/recently-viewed";
import { SiteShell } from "@/components/SiteShell";
import { getSellerListing } from "@/lib/seller-listings.functions";
import { useLocale } from "@/lib/i18n";
import { TrustPanel } from "@/components/TrustPanel";
import { ListingGallery } from "@/components/ListingGallery";
import { ArtworkAsk } from "@/components/ArtworkAsk";

export const Route = createFileRoute("/listing/$id")({
  loader: async ({ params }) => {
    const l = await getSellerListing({ data: { id: params.id } }).catch(() => null);
    if (!l) throw notFound();
    return l;
  },
  head: ({ loaderData }) => ({ meta: [
    { title: `${loaderData?.title ?? "Artwork"} — Arwiqa أروقة` },
    { name: "description", content: loaderData?.description.slice(0, 155) ?? "Artwork from an Arwiqa seller." },
    { property: "og:title", content: `${loaderData?.title ?? "Artwork"} — Arwiqa` },
    { property: "og:description", content: loaderData?.description.slice(0, 155) ?? "Artwork from an Arwiqa seller." },
    { property: "og:type", content: "product" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  notFoundComponent: () => <SiteShell><p className="mx-auto max-w-3xl p-10">This listing isn't in the shop. <Link to="/explore" className="underline">Browse artworks</Link></p></SiteShell>,
  errorComponent: () => <SiteShell><p className="mx-auto max-w-3xl p-10">Couldn't load this listing.</p></SiteShell>,
  component: ListingPage,
});

function ListingPage() {
  const l = Route.useLoaderData();
  const { locale } = useLocale(); const ar = locale === "ar";
  useEffect(() => { const id = (l as any)?.published_listing_id ?? (l as any)?.id; if (id) void countView(String(id)); }, [l]);
  return (
    <SiteShell>
      <article className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-2">
        <ListingGallery images={[...(l.imageUrl ? [{ url: l.imageUrl, alt: l.altText, altAr: l.altTextAr }] : []), ...l.gallery]} />
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{l.medium}</p>
          <h1 className="font-display text-4xl">{ar ? l.titleAr : l.title}</h1>
          <p className="text-2xl">${l.price.toLocaleString()}</p>
          <p className="whitespace-pre-line leading-relaxed">{ar ? l.descriptionAr : l.description}</p>
          {l.tags.length > 0 && <ul className="flex flex-wrap gap-2">{l.tags.map((t) => <li key={t} className="rounded-full bg-muted px-3 py-1 text-xs">{t}</li>)}</ul>}
          <p className="text-sm text-muted-foreground">{ar ? "للشراء، استخدم «اسأل البائع» أو تواصل مع فريق أروقة." : "To buy, contact the Arwiqa team — seller checkout for new listings is coming soon."}</p>
          <TrustPanel listingId={l.id} />
          <ArtworkAsk listingId={l.id} />
        </div>
      </article>
    </SiteShell>
  );
}
