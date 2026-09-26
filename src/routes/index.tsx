import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell, ArtCard } from "@/components/SiteShell";
import { exhibitions, heroImage, saudiBanks } from "@/lib/data";
import { useListings } from "@/lib/store";
import { useLocale } from "@/lib/i18n";
import { BankTile } from "@/components/BankTile";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Arwiqa — Global marketplace for art & creative assets" },
      { name: "description", content: "Buy originals, prints and digital licenses, bid in auctions and visit exhibitions from artists worldwide — in English and Arabic." },
      { property: "og:title", content: "Arwiqa — Global art marketplace" },
      { property: "og:description", content: "Originals, prints, auctions and exhibitions in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { t, pick } = useLocale();
  const all = useListings();
  return (
    <SiteShell>
      <section className="mx-auto grid max-w-7xl items-end gap-10 px-6 pt-16 md:grid-cols-12">
        <div className="md:col-span-5">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">{t("home.eyebrow")}</p>
          <h1 className="mt-4 font-display text-6xl leading-[1.05] md:text-7xl">{t("home.title")}</h1>
          <p className="mt-6 text-lg text-muted-foreground">{t("home.sub")}</p>
          <div className="mt-8 flex gap-3">
            <Link to="/explore" className="rounded-full bg-primary px-6 py-3 text-primary-foreground">{t("home.explore")}</Link>
            <Link to="/auctions" className="rounded-full border border-foreground px-6 py-3">{t("home.live")}</Link>
          </div>
        </div>
        <div className="md:col-span-7">
          <img src={heroImage} alt="Gallery exhibition hall" width={1600} height={912} className="w-full rounded-sm object-cover" />
        </div>
      </section>

      <section className="mx-auto mt-10 grid max-w-7xl grid-cols-2 gap-6 border-y border-border px-6 py-8 text-center md:grid-cols-4">
        {([["48k", "stat.artists"], ["1.2M", "stat.artworks"], ["320", "stat.exhibitions"], ["$18M", "stat.paid"]] as const).map(([n, l]) => (
          <div key={l}><p className="font-display text-4xl">{n}</p><p className="text-sm text-muted-foreground">{t(l)}</p></div>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-6 pt-20">
        <div className="mb-8 flex items-end justify-between"><h2 className="font-display text-4xl">{t("home.new")}</h2><Link to="/explore" className="text-sm underline">{t("home.viewAll")}</Link></div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">{all.slice(0, 6).map((a) => <ArtCard key={a.id} a={a} />)}</div>
      </section>

      <section className="mx-auto mt-24 max-w-7xl px-6">
        <div className="mb-8 flex items-end justify-between"><h2 className="font-display text-4xl">{t("home.exhibitions")}</h2><Link to="/exhibitions" className="text-sm underline">{t("home.allExhibitions")}</Link></div>
        <div className="grid gap-6 md:grid-cols-3">
          {exhibitions.map((e) => (
            <Link key={e.id} to="/exhibitions/$id" params={{ id: e.id }} className="rounded-sm border border-border bg-card p-4 hover:border-primary">
              <img src={e.image} alt={pick(e, "title")} loading="lazy" className="aspect-video w-full rounded-sm object-cover" />
              <p className="mt-4 text-xs uppercase tracking-widest text-primary">{t(e.type === "Virtual" ? "ex.virtual" : "ex.physical")}</p>
              <p className="font-display text-2xl">{pick(e, "title")}</p>
              <p className="text-sm text-muted-foreground">{pick(e, "venue")}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-24 max-w-7xl px-6">
        <div className="mb-8 flex items-end justify-between">
          <div><h2 className="font-display text-4xl">{t("home.banks")}</h2><p className="mt-1 text-muted-foreground">{t("home.banksSub")}</p></div>
          <Link to="/collections/saudi-banks" className="text-sm underline">{t("home.viewAll")}</Link>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">{saudiBanks.slice(0, 5).map((b) => <BankTile key={b.id} b={b} />)}</div>
      </section>

      <section className="mx-auto mt-24 max-w-7xl px-6">
        <div className="rounded-sm bg-secondary p-12 md:flex md:items-center md:justify-between">
          <div><h2 className="font-display text-4xl text-secondary-foreground">{t("home.store")}</h2><p className="mt-2 text-secondary-foreground/70">{t("home.storeSub")}</p></div>
          <Link to="/sell" className="mt-6 inline-block rounded-full bg-primary px-6 py-3 text-primary-foreground md:mt-0">{t("home.becomeSeller")}</Link>
        </div>
      </section>
    </SiteShell>
  );
}
