import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useLocale } from "@/lib/i18n";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { artists } from "@/lib/data";

export const Route = createFileRoute("/artists")({
  head: () => ({
    meta: [
      { title: "Artists — creativestudio" },
      { name: "description", content: "Discover and follow painters, photographers and calligraphers worldwide." },
      { property: "og:title", content: "Artists — creativestudio" },
      { property: "og:description", content: "Discover and follow artists worldwide." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ArtistsLayout,
});

function ArtistsLayout() {
  const match = useMatchRoute();
  const { t, pick } = useLocale();
  if (match({ to: "/artists/$id" })) return <Outlet />;
  return (
    <SiteShell>
      <PageTitle eyebrow={t("artists.eyebrow")} title={t("artists.title")} />
      <div className="mx-auto grid max-w-7xl gap-8 px-6 md:grid-cols-3">
        {artists.map((a) => (
          <Link key={a.id} to="/artists/$id" params={{ id: a.id }} className="block rounded-sm border border-border bg-card p-6 hover:border-primary">
            <img src={a.image} alt={pick(a, "name")} loading="lazy" className="h-20 w-20 rounded-full object-cover" />
            <p className="mt-4 font-display text-2xl">{pick(a, "name")}</p>
            <p className="text-sm text-muted-foreground">{pick(a, "discipline")} · {pick(a, "city")}</p>
            <p className="mt-3 line-clamp-2 text-sm">{pick(a, "bio")}</p>
          </Link>
        ))}
      </div>
    </SiteShell>
  );
}
