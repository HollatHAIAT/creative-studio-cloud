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
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const pillars = [
    [L("Buy", "اشترِ"), L("Originals, numbered prints and digital licenses, priced clearly.", "أعمال أصلية ومطبوعات مرقّمة وتراخيص رقمية بأسعار واضحة."), "/explore"],
    [L("Bid", "زايد"), L("Live auctions — open or by invitation — with a full transaction log.", "مزادات مباشرة مفتوحة أو بدعوة مع سجل معاملات كامل."), "/auctions"],
    [L("Visit", "زُر"), L("Book exhibition tickets and get scannable entry codes.", "احجز تذاكر المعارض واحصل على رموز دخول قابلة للمسح."), "/exhibitions"],
    [L("Sell", "بِع"), L("Open a storefront, write listings with AI, and track sales.", "افتح متجرك واكتب إعلاناتك بالذكاء الاصطناعي وتابع مبيعاتك."), "/sell"],
  ] as const;
  return (
    <SiteShell>
      <PageTitle eyebrow={L("Company", "الشركة")} title={L("Global art, crafted by Saudi hands", "فنٌّ عالمي بأيادٍ سعودية")} sub={L("Arwiqa (أروقة, “galleries”) connects collectors worldwide with artists, galleries and heritage makers — with special strength in Saudi and Gulf art, calligraphy, Sadu, Al-Qatt Al-Asiri and pottery.", "أروقة سوق عالمي يربط المقتنين حول العالم بالفنانين والمعارض وصنّاع التراث، بقوة خاصة في الفن السعودي والخليجي والخط العربي والسدو والقط العسيري والفخار.")} />
      <div className="mx-auto grid max-w-7xl gap-6 px-6 md:grid-cols-4">
        {pillars.map(([t, d, to]) => (
          <Link key={to} to={to} className="rounded-2xl border border-border bg-card p-6 transition hover:border-primary">
            <p className="font-display text-2xl">{t}</p><p className="mt-2 text-sm text-muted-foreground">{d}</p>
          </Link>
        ))}
      </div>
      <section className="mx-auto mt-12 max-w-3xl space-y-4 px-6 leading-relaxed">
        <h2 className="font-display text-2xl">{L("Our commitments", "التزاماتنا")}</h2>
        <ul className="ms-5 list-disc space-y-2">
          <li>{L("Prices are calculated on our servers, so what you see is what you pay.", "تُحسب الأسعار على خوادمنا، فما تراه هو ما تدفعه.")}</li>
          <li>{L("Provenance and condition are shown as the seller provided them — we mark what is documented and what is not.", "نعرض المصدر والحالة كما قدّمها البائع، ونوضح ما هو موثّق وما ليس كذلك.")}</li>
          <li>{L("Heritage listings go through staff review before they go live.", "تمر إعلانات التراث بمراجعة الفريق قبل نشرها.")}</li>
          <li>{L("Reviews, reports and appeals are moderated by people, with an audit trail.", "يراجع فريقنا التقييمات والبلاغات والاعتراضات مع سجل تدقيق.")}</li>
        </ul>
        <div className="flex flex-wrap gap-3 pt-4">
          <Link to="/support" className="rounded-full bg-primary px-5 py-2 text-primary-foreground">{L("Contact support", "تواصل مع الدعم")}</Link>
          <Link to="/licensing" className="rounded-full border border-border px-5 py-2">{L("Licensing terms", "شروط التراخيص")}</Link>
        </div>
      </section>
    </SiteShell>
  );
}
