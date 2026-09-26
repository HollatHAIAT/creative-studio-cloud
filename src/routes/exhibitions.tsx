import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { exhibitions } from "@/lib/data";
import { useLocale } from "@/lib/i18n";
import { dateRange } from "@/lib/exhibitions";

export const Route = createFileRoute("/exhibitions")({
  head: () => ({
    meta: [
      { title: "Exhibitions — creativestudio" },
      { name: "description", content: "Virtual and physical art exhibitions with schedules, ticket booking and exhibition maps." },
      { property: "og:title", content: "Exhibitions — creativestudio" },
      { property: "og:description", content: "Virtual rooms and physical shows worldwide." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Layout,
});

function Layout() {
  const match = useMatchRoute();
  if (match({ to: "/exhibitions/$id" })) return <Outlet />;
  return <List />;
}

function List() {
  const { t, pick, locale } = useLocale();
  return (
    <SiteShell>
      <PageTitle eyebrow={t("ex.eyebrow")} title={t("ex.title")} sub={t("ex.sub")} />
      <div className="mx-auto grid max-w-7xl gap-10 px-6">
        {exhibitions.map((e, i) => (
          <article key={e.id} className={`grid items-center gap-8 md:grid-cols-2 ${i % 2 ? "md:[&>*:first-child]:order-2" : ""}`}>
            <img src={e.image} alt={pick(e, "title")} loading="lazy" className="aspect-video w-full rounded-sm object-cover" />
            <div>
              <p className="text-xs uppercase tracking-widest text-primary">{t(e.type === "Virtual" ? "ex.virtual" : "ex.physical")}</p>
              <h2 className="mt-2 font-display text-4xl">{pick(e, "title")}</h2>
              <p className="mt-2 text-muted-foreground">{pick(e, "venue")} · {dateRange(e, locale)}</p>
              <p className="mt-4">{pick(e, "description")}</p>
              <Link to="/exhibitions/$id" params={{ id: e.id }} className="mt-6 inline-block rounded-full bg-primary px-6 py-3 text-primary-foreground">{e.type === "Virtual" ? t("ex.free") : t("ex.tickets")}</Link>
            </div>
          </article>
        ))}
      </div>
    </SiteShell>
  );
}
