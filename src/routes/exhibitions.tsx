import { createFileRoute } from "@tanstack/react-router";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { exhibitions } from "@/lib/data";

export const Route = createFileRoute("/exhibitions")({
  head: () => ({
    meta: [
      { title: "Exhibitions — creativestudio" },
      { name: "description", content: "Virtual and physical art exhibitions with tickets and visitor invites." },
      { property: "og:title", content: "Exhibitions — creativestudio" },
      { property: "og:description", content: "Virtual and physical art exhibitions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <SiteShell>
      <PageTitle eyebrow="Exhibitions" title="On view" sub="Walk virtual rooms online or book tickets for shows near you." />
      <div className="mx-auto max-w-7xl space-y-10 px-6">
        {exhibitions.map((e) => (
          <div key={e.id} className="grid items-center gap-8 border-b border-border pb-10 md:grid-cols-2">
            <img src={e.image} alt={e.title} loading="lazy" className="aspect-video w-full rounded-sm object-cover" />
            <div>
              <p className="text-xs uppercase tracking-widest text-primary">{e.type} exhibition</p>
              <h2 className="mt-2 font-display text-4xl">{e.title}</h2>
              <p className="mt-2 text-muted-foreground">{e.venue}</p>
              <p className="text-muted-foreground">{e.dates}</p>
              <button className="mt-6 rounded-full bg-primary px-6 py-3 text-primary-foreground">{e.ticket ? `Get tickets · $${e.ticket}` : "Enter free"}</button>
            </div>
          </div>
        ))}
      </div>
    </SiteShell>
  ),
});
