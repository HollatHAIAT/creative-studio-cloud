import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { useLocale } from "@/lib/i18n";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Arwiqa أروقة — global art by Saudi hands" },
      { name: "description", content: "Arwiqa is a global marketplace for art, prints, auctions and exhibitions, built in Saudi Arabia." },
      { property: "og:title", content: "About Arwiqa أروقة" },
      { property: "og:description", content: "A global art marketplace with special strength in Saudi and Gulf art and heritage." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: About,
});

function About() {
  const { t } = useLocale();
  const pillars = [["p1", "/explore"], ["p2", "/auctions"], ["p3", "/exhibitions"], ["p4", "/sell"]] as const;
  return (
    <SiteShell>
      <PageTitle eyebrow={t("about.eyebrow")} title={t("about.title")} sub={t("about.sub")} />
      <div className="mx-auto grid max-w-7xl gap-6 px-6 md:grid-cols-4">
        {pillars.map(([k, to]) => (
          <Link key={to} to={to} className="rounded-2xl border border-border bg-card p-6 transition hover:border-primary">
            <p className="font-display text-2xl">{t(`about.${k}.title`)}</p><p className="mt-2 text-sm text-muted-foreground">{t(`about.${k}.body`)}</p>
          </Link>
        ))}
      </div>
      <section className="mx-auto mt-12 max-w-3xl space-y-4 px-6 leading-relaxed">
        <h2 className="font-display text-2xl">{t("about.commit.title")}</h2>
        <ul className="ms-5 list-disc space-y-2">
          {[1, 2, 3, 4].map((i) => <li key={i}>{t(`about.commit.${i}`)}</li>)}
        </ul>
        <div className="flex flex-wrap gap-3 pt-4">
          <Link to="/support" className="rounded-full bg-primary px-5 py-2 text-primary-foreground">{t("about.cta.support")}</Link>
          <Link to="/licensing" className="rounded-full border border-border px-5 py-2">{t("about.cta.licensing")}</Link>
        </div>
      </section>
    </SiteShell>
  );
}
