import { createFileRoute, notFound } from "@tanstack/react-router";
import { useLocale } from "@/lib/i18n";
import { SiteShell, ArtCard } from "@/components/SiteShell";
import { creatorOf } from "@/lib/data";
import { useListings } from "@/lib/store";

export const Route = createFileRoute("/artists/$id")({
  loader: ({ params }) => {
    const c = creatorOf(params.id);
    if (!c) throw notFound();
    return c;
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [
      { title: `${loaderData.name} — ${loaderData.discipline} on Arwiqa` },
      { name: "description", content: loaderData.bio },
      { property: "og:title", content: `${loaderData.name} — Arwiqa أروقة` },
      { property: "og:description", content: loaderData.bio },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ] : [{ title: "Artist not found" }, { name: "robots", content: "noindex" }],
  }),
  notFoundComponent: () => <SiteShell><p className="p-16 text-center">Artist not found.</p></SiteShell>,
  component: Profile,
});

function Profile() {
  const c = Route.useLoaderData();
  const { t, pick, num } = useLocale();
  const works = useListings().filter((l) => l.creatorId === c.id);
  return (
    <SiteShell>
      <section className="mx-auto flex max-w-7xl flex-col gap-8 px-6 pt-16 md:flex-row md:items-center">
        <img src={c.image} alt={c.name} className="h-40 w-40 rounded-full object-cover" />
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary">{pick(c, "discipline")} · {pick(c, "city")}</p>
          <h1 className="mt-2 font-display text-5xl">{pick(c, "name")}</h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">{pick(c, "bio")}</p>
          <p className="mt-3 text-sm">{num(works.length)} {t("artists.listings")} · {num(c.followers)} {t("artists.followers")}</p>
        </div>
      </section>
      <section className="mx-auto mt-14 max-w-7xl px-6">
        <h2 className="mb-6 font-display text-3xl">{t("artists.listings")}</h2>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">{works.map((a) => <ArtCard key={a.id} a={a} />)}</div>
      </section>
    </SiteShell>
  );
}
