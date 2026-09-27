import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, Frame, Gavel, Printer, ShieldCheck, Store, Truck } from "lucide-react";
import { SiteShell } from "@/components/SiteShell";
import { artists, exhibitions, fmt, saudiBanks, type Artwork } from "@/lib/data";
import { useListings } from "@/lib/store";
import { useLocale } from "@/lib/i18n";
import { BankTile } from "@/components/BankTile";
import { DiscoverySearch } from "@/components/DiscoverySearch";
import { QuickView } from "@/components/QuickView";
import { ArtTile, Countdown, LiveBadge, Reveal, SectionHead, useL, useLiveAuction } from "@/components/editorial";
import { useDbAuctions, dbStatus, useNow } from "@/lib/auctions";
import heroArt from "@/assets/hero-art.jpg";
import studio from "@/assets/artist-studio.jpg";
import galleryWide from "@/assets/gallery-wide.jpg";
import spaceLiving from "@/assets/space-living.jpg";
import spaceMajlis from "@/assets/space-majlis.jpg";
import spaceOffice from "@/assets/space-office.jpg";
import art1 from "@/assets/art1.jpg";
import art2 from "@/assets/art2.jpg";
import art3 from "@/assets/art3.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Arwiqa أروقة — Art worth discovering: originals, auctions & exhibitions" },
      { name: "description", content: "Discover original artworks, limited editions, live auctions and virtual or physical exhibitions from selected artists and galleries — in Arabic and English." },
      { property: "og:title", content: "Arwiqa أروقة — Art worth discovering" },
      { property: "og:description", content: "Originals, limited editions, live auctions and exhibitions in one editorial marketplace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const all = useListings();
  const [quick, setQuick] = useState<Artwork | null>(null);
  return (
    <SiteShell>
      <Hero lead={all[0]} />
      <Curated works={all} onQuick={setQuick} />
      <LiveAuctions works={all} />
      <Artists works={all} />
      <Spotlight works={all} />
      <Exhibitions />
      <ByMood />
      <BySpace />
      <CollectionStories />
      <DigitalAssets />
      <SellYourArt />
      <Trust />
      <QuickView a={quick} onClose={() => setQuick(null)} />
    </SiteShell>
  );
}

function Arrow() {
  const { dir } = useLocale();
  const I = dir === "rtl" ? ArrowLeft : ArrowRight;
  return <I className="h-4 w-4 transition group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" aria-hidden />;
}
function TextLink({ to, children }: { to: string; children: React.ReactNode }) {
  return <Link to={to} className="group inline-flex items-center gap-2 text-sm hover:text-primary">{children}<Arrow /></Link>;
}

/* 1–2. Asymmetric editorial hero with layered marketplace overlays + discovery search */
function Hero({ lead }: { lead?: Artwork }) {
  const L = useL();
  const { pick } = useLocale();
  const live = useLiveAuction(lead?.id ?? "");
  return (
    <section className="relative mx-auto max-w-7xl px-6 pb-16 pt-10 md:pt-14">
      <div className="grid items-center gap-12 lg:grid-cols-12">
        <div className="relative lg:col-span-7">
          <div className="relative ms-auto w-full max-w-[560px] lg:ms-0">
            <img src={heroArt} alt={L("Sweeping terracotta and espresso brushstrokes in an abstract oil painting", "ضربات فرشاة تجريدية بألوان التيراكوتا والبني الداكن في لوحة زيتية")} width={1152} height={1440} className="aspect-[4/5] w-full object-cover" />
            {/* Floating editorial overlays */}
            <div className="rise-in absolute -end-4 top-10 w-56 border border-border bg-surface/95 p-4 shadow-float backdrop-blur-sm md:-end-16" style={{ animationDelay: "200ms" }}>
              <LiveBadge label={L("Live auction", "مزاد مباشر")} />
              <p className="mt-2 text-xs text-muted-foreground">{L("Ends in", "ينتهي خلال")}</p>
              <Countdown ms={live?.left ?? 0} className="text-2xl" />
            </div>
            <div className="rise-in absolute -start-4 bottom-24 border border-border bg-surface/95 px-5 py-4 shadow-float backdrop-blur-sm md:-start-10" style={{ animationDelay: "380ms" }}>
              <p className="text-xs text-muted-foreground">{L("Current bid", "المزايدة الحالية")}</p>
              <p className="font-display text-3xl">{fmt(live?.current ?? 5200)}</p>
            </div>
            <Link to="/artists/$id" params={{ id: artists[0].id }} className="rise-in absolute -bottom-6 end-6 flex items-center gap-3 border border-border bg-surface px-4 py-3 shadow-float" style={{ animationDelay: "520ms" }}>
              <img src={studio} alt="" className="h-10 w-10 rounded-full object-cover" />
              <span><span className="block text-sm">{pick(artists[0], "name")}</span><span className="flex items-center gap-1 text-xs text-muted-foreground"><BadgeCheck className="h-3.5 w-3.5 text-primary" aria-hidden />{L("Verified artist", "فنانة موثقة")}</span></span>
            </Link>
            <span className="absolute start-4 top-4 bg-background/90 px-3 py-1 text-[11px] uppercase tracking-widest">{L("Original • 1/1", "نسخة أصلية • 1/1")}</span>
          </div>
        </div>
        <div className="lg:col-span-5">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">{L("Global art marketplace", "سوق فني عالمي")}</p>
          <h1 className="mt-5 font-display text-5xl leading-[1.05] md:text-7xl">{L("Art that deserves to be discovered.", "الفن الذي يستحق أن يُكتشف.")}</h1>
          <p className="mt-6 max-w-md text-lg text-muted-foreground">{L("Discover originals, limited editions, exhibitions and auctions from selected artists and galleries.", "اكتشف أعمالًا أصلية، إصدارات محدودة، معارض ومزادات من فنانين وصالات مختارة.")}</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link to="/explore" className="rounded-full bg-primary px-7 py-3.5 text-primary-foreground transition hover:bg-primary-hover">{L("Explore artworks", "استكشف الأعمال")}</Link>
            <Link to="/auctions" className="rounded-full border border-foreground px-6 py-3.5 transition hover:bg-foreground hover:text-background">{L("Live auctions", "المزادات الحية")}</Link>
            <TextLink to="/exhibitions">{L("Discover exhibitions", "اكتشف المعارض")}</TextLink>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-20 max-w-4xl"><DiscoverySearch /></div>
    </section>
  );
}

/* 3. Curated now — editorial masonry */
function Curated({ works, onQuick }: { works: Artwork[]; onQuick: (a: Artwork) => void }) {
  const L = useL();
  const [a, b, c, d, e] = works;
  if (!a) return null;
  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <Reveal><SectionHead eyebrow={L("Curated now", "مختارات الآن")} title={L("Arwiqa selections", "مختارات أروقة")} action={<TextLink to="/explore">{L("All artworks", "كل الأعمال")}</TextLink>} /></Reveal>
      <div className="grid gap-x-8 gap-y-14 md:grid-cols-12">
        <Reveal className="md:col-span-5"><ArtTile a={a} ratio="aspect-[3/4]" onQuick={onQuick} size="lg" /></Reveal>
        <div className="grid gap-y-14 md:col-span-3">
          {b && <Reveal delay={80}><ArtTile a={b} ratio="aspect-square" onQuick={onQuick} /></Reveal>}
          {c && <Reveal delay={160}><ArtTile a={c} ratio="aspect-[4/5]" onQuick={onQuick} /></Reveal>}
        </div>
        <div className="grid content-start gap-y-14 md:col-span-4 md:pt-24">
          {d && <Reveal delay={120}><ArtTile a={d} ratio="aspect-[4/3]" onQuick={onQuick} /></Reveal>}
          {e && <Reveal delay={200}><ArtTile a={e} ratio="aspect-[5/4]" onQuick={onQuick} /></Reveal>}
        </div>
      </div>
      <PriceChips />
    </section>
  );
}

/* 24. Shop by price — subtle chips */
function PriceChips() {
  const L = useL();
  const chips: [string, string, number | undefined, number | undefined][] = [
    ["Under $1,000", "أقل من 1,000", undefined, 1000], ["$1,000 – 5,000", "1,000 – 5,000", 1000, 5000],
    ["$5,000 – 15,000", "5,000 – 15,000", 5000, 15000], ["$15,000+", "+15,000", 15000, undefined],
  ];
  return (
    <div className="mt-16 flex flex-wrap items-center gap-3 border-t border-border pt-8">
      <span className="me-2 text-sm text-muted-foreground">{L("Shop by price", "تسوّق حسب السعر")}</span>
      {chips.map(([en, ar, min, max]) => (
        <Link key={en} to="/explore" search={{ min, max }} className="rounded-full border border-border px-4 py-2 text-sm transition hover:border-foreground">{L(en, ar)}</Link>
      ))}
    </div>
  );
}

/* 4. Live auctions — one dominant feature + supporting lots */
function LiveAuctions({ works }: { works: Artwork[] }) {
  const L = useL();
  const { pick } = useLocale();
  const q = useDbAuctions();
  const now = useNow(1000);
  const lots = (q.data?.auctions ?? [])
    .filter((x) => now > 0 && dbStatus(x, now) !== "closed")
    .sort((x, y) => Date.parse(x.ends_at) - Date.parse(y.ends_at))
    .map((x) => ({ x, w: works.find((w) => w.id === x.listing_id) }))
    .filter((r): r is { x: typeof r.x; w: Artwork } => !!r.w);
  const bidsOf = (id: string) => (q.data?.bids ?? []).filter((b) => b.auction_id === id);
  const [feat, ...rest] = lots;
  return (
    <section className="bg-foreground py-24 text-background">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal><SectionHead eyebrow={L("Happening now", "يحدث الآن")} title={L("Live auctions", "مزادات مباشرة")} action={<Link to="/auctions" className="text-sm underline-offset-4 hover:underline">{L("All auctions", "كل المزادات")}</Link>} /></Reveal>
        {!feat ? (
          <p className="text-background/70">{q.isLoading ? L("Loading auctions…", "جارٍ تحميل المزادات…") : L("No auctions are open right now — new lots open weekly.", "لا توجد مزادات مفتوحة الآن — تُفتح مزادات جديدة أسبوعيًا.")}</p>
        ) : (
          <div className="grid gap-10 lg:grid-cols-12">
            {(() => {
              const bids = bidsOf(feat.x.id); const top = bids.reduce((m, b) => Math.max(m, b.amount), 0) || feat.x.start_bid;
              const isLive = dbStatus(feat.x, now) === "live";
              return (
                <Link to="/auctions/$id" params={{ id: feat.x.id }} className="group grid gap-8 md:grid-cols-2 lg:col-span-7">
                  <div className="overflow-hidden"><img src={feat.w.image} alt={pick(feat.w, "title")} loading="lazy" className="aspect-[4/5] w-full object-cover transition duration-700 group-hover:scale-[1.03]" /></div>
                  <div className="flex flex-col justify-end">
                    {isLive ? <LiveBadge label={L("Live now", "مباشر الآن")} /> : <span className="text-xs uppercase tracking-widest text-background/60">{L("Opens soon", "يفتح قريبًا")}</span>}
                    <p className="mt-4 font-display text-4xl">{pick(feat.w, "title")}</p>
                    <p className="text-background/70">{pick(feat.w, "artist")}</p>
                    <dl className="mt-8 grid grid-cols-2 gap-6 border-t border-background/20 pt-6">
                      <div><dt className="text-xs text-background/60">{L("Current bid", "المزايدة الحالية")}</dt><dd className="font-display text-3xl tabular-nums">{fmt(top)}</dd></div>
                      <div><dt className="text-xs text-background/60">{L("Bids", "مزايدة")}</dt><dd className="font-display text-3xl">{bids.length}</dd></div>
                      <div className="col-span-2"><dt className="text-xs text-background/60">{isLive ? L("Ends in", "ينتهي خلال") : L("Opens in", "يفتح خلال")}</dt><dd><Countdown ms={Date.parse(isLive ? feat.x.ends_at : feat.x.starts_at) - now} className="text-4xl" /></dd></div>
                    </dl>
                    <span className="mt-8 inline-flex w-fit rounded-full bg-primary px-6 py-3 text-primary-foreground">{L("Enter auction", "دخول المزاد")}</span>
                  </div>
                </Link>
              );
            })()}
            <div className="grid content-start gap-6 lg:col-span-5">
              {rest.slice(0, 3).map(({ x, w }) => {
                const bids = bidsOf(x.id); const top = bids.reduce((m, b) => Math.max(m, b.amount), 0) || x.start_bid; const isLive = dbStatus(x, now) === "live";
                return (
                  <Link key={x.id} to="/auctions/$id" params={{ id: x.id }} className="group flex gap-5 border-b border-background/15 pb-6">
                    <img src={w.image} alt={pick(w, "title")} loading="lazy" className="h-28 w-24 shrink-0 object-cover" />
                    <div className="flex flex-1 flex-col justify-between">
                      <div><p className="font-display text-xl group-hover:text-primary">{pick(w, "title")}</p><p className="text-sm text-background/60">{pick(w, "artist")}</p></div>
                      <div className="flex items-end justify-between text-sm">
                        <span className="tabular-nums">{fmt(top)} · {bids.length} {L("bids", "مزايدة")}</span>
                        {isLive ? <Countdown ms={Date.parse(x.ends_at) - now} className="text-base" /> : <span className="text-background/60">{L("Upcoming", "قادم")}</span>}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* 5. Featured artists — cinematic cards with mini works */
function Artists({ works }: { works: Artwork[] }) {
  const L = useL();
  const { pick } = useLocale();
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <Reveal><SectionHead eyebrow={L("Artists", "الفنانون")} title={L("Artists worth discovering", "فنانون يستحقون الاكتشاف")} action={<TextLink to="/artists">{L("All artists", "كل الفنانين")}</TextLink>} /></Reveal>
      <div className="no-scrollbar -mx-6 flex snap-x gap-6 overflow-x-auto px-6 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
        {artists.map((p, i) => {
          const mine = works.filter((w) => w.artistId === p.id).slice(0, 3);
          return (
            <Reveal key={p.id} delay={i * 90} className="w-[80%] shrink-0 snap-start md:w-auto">
              <Link to="/artists/$id" params={{ id: p.id }} className="group relative block overflow-hidden">
                <img src={p.image} alt={pick(p, "name")} loading="lazy" className="aspect-[3/4] w-full object-cover transition duration-700 group-hover:scale-[1.03]" />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6 text-background">
                  <p className="flex items-center gap-2 font-display text-3xl">{pick(p, "name")}<BadgeCheck className="h-5 w-5 text-primary" aria-label={L("Verified", "موثّق")} /></p>
                  <p className="text-sm text-background/75">{pick(p, "discipline")} · {pick(p, "city")}</p>
                  <div className="mt-4 flex gap-2">{mine.map((w) => <img key={w.id} src={w.image} alt="" className="h-12 w-12 object-cover ring-1 ring-background/40" />)}</div>
                  <div className="mt-4 flex gap-4 text-sm opacity-0 transition duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                    <span className="underline underline-offset-4">{L("View profile", "عرض الملف")}</span><span>{L("Follow", "متابعة")}</span>
                  </div>
                </div>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

/* Artist spotlight — full-width editorial story */
function Spotlight({ works }: { works: Artwork[] }) {
  const L = useL();
  const { pick } = useLocale();
  const p = artists[0];
  const w = works.find((x) => x.artistId === p.id);
  return (
    <section className="bg-muted py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-12">
        <Reveal className="lg:col-span-5"><img src={studio} alt={L("An artist in her sunlit studio surrounded by canvases", "فنانة في مرسمها المضيء تحيط بها اللوحات")} loading="lazy" width={1280} height={1600} className="aspect-[4/5] w-full object-cover" /></Reveal>
        <Reveal delay={120} className="lg:col-span-7 lg:ps-8">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">{L("Artist story", "قصة فنان")}</p>
          <blockquote className="mt-6 font-display text-3xl leading-snug md:text-5xl">“{L("I paint the moment the light leaves the sea — the colour that stays after.", "أرسم اللحظة التي يغادر فيها الضوء البحر — اللون الذي يبقى بعدها.")}”</blockquote>
          <p className="mt-6 max-w-xl text-muted-foreground">{pick(p, "bio")}</p>
          <div className="mt-10 flex flex-wrap items-center gap-8">
            {w && <Link to="/artwork/$id" params={{ id: w.id }} className="flex items-center gap-4"><img src={w.image} alt={pick(w, "title")} className="h-20 w-16 object-cover" /><span><span className="block font-display text-lg">{pick(w, "title")}</span><span className="text-sm text-muted-foreground">{fmt(w.price)}</span></span></Link>}
            <Link to="/artists/$id" params={{ id: p.id }} className="rounded-full bg-primary px-6 py-3 text-primary-foreground hover:bg-primary-hover">{L("Discover the artist's work", "اكتشف أعمال الفنان")}</Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* 6. Exhibitions — immersive wide preview + typed cards */
function Exhibitions() {
  const L = useL();
  const { pick } = useLocale();
  const virtual = exhibitions.find((e) => e.type === "Virtual") ?? exhibitions[0];
  const hotspots = [[18, 48], [42, 45], [60, 48], [86, 44]];
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6"><Reveal><SectionHead eyebrow={L("Exhibitions", "المعارض")} title={L("Exhibitions you can enter now", "معارض يمكنك دخولها الآن")} action={<TextLink to="/exhibitions">{L("All exhibitions", "كل المعارض")}</TextLink>} /></Reveal></div>
      <Reveal>
        <Link to="/exhibitions/$id" params={{ id: virtual.id }} className="group relative mx-auto block max-w-[1600px] overflow-hidden">
          <img src={galleryWide} alt={L("Wide view of a quiet gallery hall with large paintings", "منظر واسع لقاعة عرض هادئة بلوحات كبيرة")} loading="lazy" width={1920} height={800} className="aspect-[21/9] w-full object-cover transition duration-[1400ms] ease-editorial group-hover:scale-[1.04]" />
          {hotspots.map(([x, y], i) => <span key={i} aria-hidden style={{ insetInlineStart: `${x}%`, top: `${y}%` }} className="absolute hidden h-3 w-3 rounded-full border-2 border-background bg-primary/80 md:block"><span className="live-dot absolute inset-0 m-auto bg-background/60" /></span>)}
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 bg-gradient-to-t from-foreground/80 to-transparent p-6 text-background md:p-10">
            <div><p className="text-xs uppercase tracking-widest text-background/75">{L("Virtual exhibition", "معرض افتراضي")}</p><p className="font-display text-3xl md:text-5xl">{pick(virtual, "title")}</p></div>
            <span className="rounded-full bg-background px-6 py-3 text-sm text-foreground">{L("Enter the virtual exhibition", "دخول المعرض الافتراضي")}</span>
          </div>
        </Link>
      </Reveal>
      <div className="mx-auto mt-12 grid max-w-7xl gap-8 px-6 md:grid-cols-3">
        {exhibitions.map((e, i) => {
          const start = new Date(Date.UTC(2026, 8, 1) + e.startDay * 864e5);
          const end = new Date(start.getTime() + e.days * 864e5);
          const f = (d: Date) => d.toLocaleDateString(L("en-GB", "ar-SA-u-ca-gregory"), { day: "numeric", month: "short" });
          const works = e.rooms.reduce((n, r) => n + r.works.length, 0);
          return (
            <Reveal key={e.id} delay={i * 80}>
              <Link to="/exhibitions/$id" params={{ id: e.id }} className="group block border-t border-foreground pt-5">
                <p className="text-xs uppercase tracking-widest text-primary">{e.type === "Virtual" ? L("Virtual", "افتراضي") : L("Physical", "حضوري")}</p>
                <p className="mt-2 font-display text-2xl group-hover:text-primary">{pick(e, "title")}</p>
                <p className="mt-2 text-sm text-muted-foreground">{f(start)} – {f(end)} · {works} {L("works", "عملًا")}</p>
                <p className="text-sm text-muted-foreground">{e.type === "Virtual" ? L("Online, open anytime", "عبر الإنترنت، متاح دائمًا") : pick(e, "venue")}</p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm">{e.type === "Virtual" ? L("Enter the exhibition", "ادخل المعرض") : L("Book tickets", "احجز التذاكر")}<Arrow /></span>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

/* 7. Discover by mood — imagery, not icons */
function ByMood() {
  const L = useL();
  const moods: [string, string, string][] = [
    ["Calm", "هادئ", art2], ["Bold", "جريء", heroArt], ["Contemporary", "معاصر", art1], ["Heritage", "تراثي", art3],
    ["Abstract", "تجريدي", spaceLiving], ["Monochrome", "أحادي اللون", galleryWide], ["Nature", "طبيعة", spaceOffice], ["Spiritual", "روحاني", spaceMajlis],
  ];
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <Reveal><SectionHead eyebrow={L("Discover", "اكتشف")} title={L("Search by feeling", "ابحث بالشعور")} /></Reveal>
      <div className="no-scrollbar -mx-6 flex snap-x gap-4 overflow-x-auto px-6 pb-2">
        {moods.map(([en, ar, img]) => (
          <Link key={en} to="/explore" search={{ q: en }} className="group relative w-44 shrink-0 snap-start overflow-hidden md:w-56">
            <img src={img} alt="" loading="lazy" className="aspect-[3/4] w-full object-cover transition duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-foreground/25 transition group-hover:bg-foreground/40" />
            <span className="absolute bottom-4 start-4 font-display text-2xl text-background">{L(en, ar)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* 8. Art for your space */
function BySpace() {
  const L = useL();
  const spaces: [string, string, string][] = [["Living room", "غرفة المعيشة", spaceLiving], ["Majlis", "مجلس", spaceMajlis], ["Office", "المكتب", spaceOffice]];
  const more = [["Hotel", "فندق"], ["Restaurant", "مطعم"], ["Commercial spaces", "مساحات تجارية"]];
  return (
    <section className="bg-muted py-24">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal><SectionHead eyebrow={L("Art for spaces", "فن للمساحات")} title={L("Art for your space", "فن لمساحتك")} action={<TextLink to="/explore">{L("Explore by space", "استكشف حسب المساحة")}</TextLink>} /></Reveal>
        <div className="grid gap-6 md:grid-cols-3">
          {spaces.map(([en, ar, img], i) => (
            <Reveal key={en} delay={i * 90} className={i === 1 ? "md:translate-y-10" : ""}>
              <Link to="/explore" search={{ q: en }} className="group block overflow-hidden">
                <img src={img} alt={L(`Artwork styled in a ${en.toLowerCase()}`, `عمل فني في ${ar}`)} loading="lazy" width={1024} height={1280} className="aspect-[4/5] w-full object-cover transition duration-700 group-hover:scale-[1.03]" />
                <p className="mt-4 font-display text-2xl">{L(en, ar)}</p>
              </Link>
            </Reveal>
          ))}
        </div>
        <div className="mt-20 flex flex-wrap gap-3">{more.map(([en, ar]) => <Link key={en} to="/explore" search={{ q: en }} className="rounded-full border border-foreground/30 px-4 py-2 text-sm hover:border-foreground">{L(en, ar)}</Link>)}</div>
      </div>
    </section>
  );
}

/* 9. Editorial collection stories — magazine feature */
function CollectionStories() {
  const L = useL();
  const stories: [string, string, string, string, string][] = [
    ["Contemporary Saudi art", "فن سعودي معاصر", "A new generation redrawing the desert, the city and the script.", "جيل جديد يعيد رسم الصحراء والمدينة والخط.", art1],
    ["Women in Arab art", "المرأة في الفن العربي", "Voices shaping the region's visual language.", "أصوات تصوغ اللغة البصرية للمنطقة.", art3],
    ["Colours of the desert", "ألوان الصحراء", "Ochre, rose and dusk — a palette of the peninsula.", "المغرة والوردي والغسق — ألوان الجزيرة.", art2],
  ];
  const [lead, ...rest] = stories;
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <Reveal><SectionHead eyebrow={L("Collections", "المجموعات")} title={L("Editorial collections", "مجموعات تحريرية")} /></Reveal>
      <div className="grid gap-10 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <Link to="/explore" search={{ q: lead[0] }} className="group block">
            <img src={lead[4]} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover transition duration-700 group-hover:scale-[1.02]" />
            <p className="mt-6 text-xs uppercase tracking-widest text-primary">{L("Collection · 01", "مجموعة · 01")}</p>
            <p className="mt-2 font-display text-4xl">{L(lead[0], lead[1])}</p>
            <p className="mt-2 max-w-lg text-muted-foreground">{L(lead[2], lead[3])}</p>
          </Link>
        </Reveal>
        <div className="grid content-start gap-10 lg:col-span-5">
          {rest.map((s, i) => (
            <Reveal key={s[0]} delay={(i + 1) * 90}>
              <Link to="/explore" search={{ q: s[0] }} className="group grid grid-cols-[120px_1fr] items-center gap-6 border-b border-border pb-10">
                <img src={s[4]} alt="" loading="lazy" className="aspect-[3/4] w-full object-cover" />
                <div><p className="text-xs uppercase tracking-widest text-primary">{L(`Collection · 0${i + 2}`, `مجموعة · 0${i + 2}`)}</p><p className="mt-2 font-display text-2xl group-hover:text-primary">{L(s[0], s[1])}</p><p className="mt-1 text-sm text-muted-foreground">{L(s[2], s[3])}</p></div>
              </Link>
            </Reveal>
          ))}
          <div className="flex flex-wrap gap-2 text-sm">{[["Riyadh picks", "مختارات الرياض"], ["New abstractions", "تجريدات جديدة"]].map(([en, ar]) => <Link key={en} to="/explore" search={{ q: en }} className="rounded-full border border-border px-4 py-2 hover:border-foreground">{L(en, ar)}</Link>)}</div>
        </div>
      </div>
    </section>
  );
}

/* 10. Digital assets / Saudi banks — catalog mode */
function DigitalAssets() {
  const L = useL();
  return (
    <section className="border-y border-border bg-surface py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-4">
            <p className="text-xs uppercase tracking-[0.3em] text-primary">{L("Digital assets", "الأصول الرقمية")}</p>
            <h2 className="mt-3 font-display text-4xl leading-tight md:text-5xl">{L("Ready-to-use digital assets", "أصول رقمية جاهزة للاستخدام")}</h2>
            <p className="mt-4 text-muted-foreground">{L("Logos, photography, illustrations, brand assets and templates — licensed and downloadable.", "شعارات وصور ورسومات وأصول علامات وقوالب — مرخّصة وقابلة للتحميل.")}</p>
            <div className="mt-6 flex gap-2 text-xs">{["PNG", "SVG", "PDF", "JPG"].map((f) => <span key={f} className="border border-border px-2 py-1 font-mono">{f}</span>)}</div>
            <Link to="/collections/saudi-banks" className="mt-8 inline-flex rounded-full border border-foreground px-6 py-3 hover:bg-foreground hover:text-background">{L("Browse the collection", "استعراض المجموعة")}</Link>
          </Reveal>
          <Reveal delay={120} className="lg:col-span-8">
            <p className="mb-4 flex items-baseline justify-between text-sm"><span className="font-display text-2xl">{L("Saudi bank logos", "شعارات البنوك السعودية")}</span><span className="text-muted-foreground">{saudiBanks.length} {L("items", "عنصرًا")}</span></p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">{saudiBanks.slice(0, 10).map((b) => <BankTile key={b.id} b={b} />)}</div>
            <p className="mt-3 text-xs text-muted-foreground">{L("Placeholder marks for demonstration — not official logos.", "علامات توضيحية للعرض — ليست شعارات رسمية.")}</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* 11. Sell your art — creator story */
function SellYourArt() {
  const L = useL();
  const perks: [typeof Store, string, string, string, string][] = [
    [Store, "Your art storefront", "متجرك الفني", "Portfolio, pricing and orders.", "معرض أعمال وتسعير وطلبات."],
    [Frame, "Exhibitions", "المعارض", "Virtual rooms and ticketed shows.", "قاعات افتراضية ومعارض بتذاكر."],
    [Gavel, "Auctions", "المزادات", "Reserve prices and live bidding.", "أسعار دنيا ومزايدات مباشرة."],
    [Printer, "Prints", "المطبوعات", "Sizes, materials and editions.", "مقاسات وخامات وإصدارات."],
  ];
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <Reveal className="order-2 lg:order-1">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">{L("For artists & galleries", "للفنانين والصالات")}</p>
          <h2 className="mt-4 font-display text-5xl leading-tight md:text-6xl">{L("Your work deserves a bigger audience.", "عملك يستحق جمهورًا أكبر.")}</h2>
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">{L("Show your work, build your exhibition, join auctions and sell originals and prints from one place.", "اعرض أعمالك، أنشئ معرضك، شارك في المزادات وبع النسخ الأصلية والمطبوعة من مكان واحد.")}</p>
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <Link to="/sell" className="rounded-full bg-primary px-7 py-3.5 text-primary-foreground hover:bg-primary-hover">{L("Start selling", "ابدأ البيع")}</Link>
            <TextLink to="/sell">{L("How does it work?", "كيف تعمل المنصة؟")}</TextLink>
          </div>
          <dl className="mt-12 grid grid-cols-2 gap-x-8 gap-y-6">
            {perks.map(([I, en, ar, den, dar]) => (
              <div key={en} className="border-t border-border pt-4"><dt className="flex items-center gap-2 font-medium"><I className="h-4 w-4 text-primary" strokeWidth={1.5} aria-hidden />{L(en, ar)}</dt><dd className="mt-1 text-sm text-muted-foreground">{L(den, dar)}</dd></div>
            ))}
          </dl>
        </Reveal>
        <Reveal delay={120} className="order-1 lg:order-2"><img src={studio} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover object-top" /></Reveal>
      </div>
    </section>
  );
}

/* 12. Trust — statistics moved deep into the page */
function Trust() {
  const L = useL();
  const stats: [string, string, string][] = [["48k", "Artists", "فنان"], ["1.2M", "Artworks", "عمل فني"], ["320", "Exhibitions", "معرض"], ["$18M", "Paid to artists", "دُفعت للفنانين"]];
  const promises: [typeof ShieldCheck, string, string][] = [[ShieldCheck, "Secure payments & buyer protection", "دفع آمن وحماية للمشتري"], [BadgeCheck, "Verified artists and authorized agents", "فنانون موثّقون ووكلاء معتمدون"], [Truck, "Insured shipping, tracked to your door", "شحن مؤمَّن ومتتبَّع حتى بابك"]];
  return (
    <section className="border-t border-border">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-12">
        <div className="grid grid-cols-2 gap-8 lg:col-span-7 md:grid-cols-4">
          {stats.map(([n, en, ar]) => <div key={en}><p className="font-display text-4xl md:text-5xl">{n}</p><p className="mt-1 text-sm text-muted-foreground">{L(en, ar)}</p></div>)}
        </div>
        <ul className="space-y-4 lg:col-span-5">
          {promises.map(([I, en, ar]) => <li key={en} className="flex items-center gap-3 text-sm"><I className="h-5 w-5 text-primary" strokeWidth={1.5} aria-hidden />{L(en, ar)}</li>)}
        </ul>
      </div>
    </section>
  );
}
