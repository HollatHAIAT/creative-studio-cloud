import { createFileRoute } from "@tanstack/react-router";
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
  component: () => (
    <SiteShell>
      <PageTitle eyebrow="Artists" title="Featured creators" />
      <div className="mx-auto grid max-w-7xl gap-8 px-6 md:grid-cols-3">
        {artists.map((a) => (
          <div key={a.id} className="rounded-sm border border-border bg-card p-6">
            <img src={a.image} alt={a.name} loading="lazy" className="h-20 w-20 rounded-full object-cover" />
            <p className="mt-4 font-display text-2xl">{a.name}</p>
            <p className="text-sm text-muted-foreground">{a.discipline} · {a.city}</p>
            <p className="mt-3 text-sm">{a.works} works · {a.followers.toLocaleString()} followers</p>
            <button className="mt-4 rounded-full border border-foreground px-4 py-2 text-sm">Follow</button>
          </div>
        ))}
      </div>
    </SiteShell>
  ),
});
