import { createFileRoute, Link } from "@tanstack/react-router";
import { useLocale } from "@/lib/i18n";
import { SiteShell, PageTitle } from "@/components/SiteShell";

export const Route = createFileRoute("/sell")({
  head: () => ({
    meta: [
      { title: "Sell on Arwiqa" },
      { name: "description", content: "Open a storefront to sell originals, prints, licenses, auctions and exhibition tickets." },
      { property: "og:title", content: "Sell on Arwiqa" },
      { property: "og:description", content: "Open your artist or gallery storefront." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Sell,
});

function Sell() {
  const { t, locale } = useLocale();
  const items = locale === "ar" ? AR : EN;
  return (
    <SiteShell>
      <PageTitle eyebrow={t("sell.eyebrow")} title={t("sell.title")} sub={t("sell.sub")} />
      <div className="mx-auto mb-6 max-w-7xl px-6">
        <Link to="/listing-writer" className="inline-flex rounded-sm bg-primary px-5 py-3 text-primary-foreground">{locale === "ar" ? "اكتب إعلانك بالذكاء الاصطناعي من صورة العمل" : "Write your listing with AI from an artwork photo"}</Link>
      </div>
      <div className="mx-auto grid max-w-7xl gap-6 px-6 md:grid-cols-3">
        {items.map(([t, d]) => (
          <div key={t} className="rounded-sm border border-border bg-card p-6"><p className="font-display text-2xl">{t}</p><p className="mt-2 text-muted-foreground">{d}</p></div>
        ))}
      </div>
    </SiteShell>
  );
}

const EN = [["Storefront", "Portfolio, pricing, inventory and orders."], ["Auctions", "Reserve prices, scheduled open & close, live bids."], ["Exhibitions", "Virtual rooms, physical shows, ticketing and invites."], ["Prints", "Sizes, materials and unlimited reproductions."], ["Licensing", "Personal, commercial and extended licenses."], ["Analytics", "Sales, revenue, visitors and popularity."]];
const AR = [["المتجر", "معرض الأعمال والتسعير والمخزون والطلبات."], ["المزادات", "أسعار دنيا ومواعيد فتح وإغلاق ومزايدات حية."], ["المعارض", "قاعات افتراضية ومعارض واقعية وتذاكر ودعوات."], ["المطبوعات", "مقاسات وخامات ونسخ غير محدودة."], ["التراخيص", "تراخيص شخصية وتجارية وموسّعة."], ["التحليلات", "المبيعات والإيرادات والزوار والشعبية."]];
