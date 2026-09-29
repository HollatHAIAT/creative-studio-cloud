import { usePlatformSettings, num } from "@/lib/platform-settings";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { useLocale } from "@/lib/i18n";

export const Route = createFileRoute("/licensing")({
  head: () => ({
    meta: [
      { title: "Licensing — Arwiqa أروقة" },
      { name: "description", content: "Compare personal, commercial and extended digital licenses for artworks on Arwiqa." },
      { property: "og:title", content: "Artwork licensing on Arwiqa" },
      { property: "og:description", content: "Personal, commercial and extended licenses explained." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Licensing,
});

function Licensing() {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const ps = usePlatformSettings();
  const tiers = [L("Personal", "شخصي"), L("Commercial", "تجاري"), L("Extended", "موسّع")];
  const rows: [string, boolean, boolean, boolean][] = [
    [L("Home, wallpaper, personal gifts", "المنزل وخلفيات الشاشة والهدايا الشخصية"), true, true, true],
    [L("Websites, social media, marketing", "المواقع ووسائل التواصل والتسويق"), false, true, true],
    [L(`Print runs up to ${num(ps.commercial_print_limit, false)} copies`, `طباعة حتى ${num(ps.commercial_print_limit, true)} نسخة`), false, true, true],
    [L("Products for resale (merch, packaging)", "منتجات لإعادة البيع (هدايا وتغليف)"), false, false, true],
    [L("Unlimited print runs", "طباعة غير محدودة"), false, false, true],
  ];
  const steps = [
    L("Open an artwork and choose a license", "افتح العمل واختر الترخيص"),
    L("Pay at checkout", "ادفع عند إتمام الطلب"),
    L("Download the file and certificate from your order", "حمّل الملف والشهادة من صفحة طلبك"),
    L("Credit the artist where possible", "اذكر اسم الفنان متى أمكن"),
  ];
  return (
    <SiteShell>
      <PageTitle eyebrow={L("Company", "الشركة")} title={L("Licensing", "التراخيص")} sub={L("Every license is non-exclusive. The artist keeps copyright; you get the right to use the work as described.", "كل الترخيصات غير حصرية؛ يحتفظ الفنان بحقوق المؤلف وتحصل أنت على حق الاستخدام الموضّح.")} />
      <div className="mx-auto max-w-4xl px-6">
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted"><tr><th className="p-3 text-start">{L("Use", "الاستخدام")}</th>{tiers.map((t) => <th key={t} className="p-3">{t}</th>)}</tr></thead>
            <tbody>{rows.map(([u, ...v]) => (
              <tr key={u} className="border-t border-border"><td className="p-3">{u}</td>{v.map((ok, i) => <td key={i} className="p-3 text-center">{ok ? <Check aria-label={L("Allowed", "مسموح")} className="mx-auto h-4 w-4 text-primary" /> : <X aria-label={L("Not allowed", "غير مسموح")} className="mx-auto h-4 w-4 text-muted-foreground" />}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{L(`Commercial is priced at ${ps.commercial_multiplier}× and extended at ${ps.extended_multiplier}× the personal license. Not allowed with any license: reselling the file itself, trademarks, or AI training.`, `الترخيص التجاري بـ${num(ps.commercial_multiplier, true)} أضعاف الشخصي والموسّع بـ${num(ps.extended_multiplier, true)} أضعافه. غير مسموح بأي ترخيص: إعادة بيع الملف نفسه أو تسجيله علامة تجارية أو تدريب نماذج الذكاء الاصطناعي عليه.`)}</p>
        <h2 className="mt-10 font-display text-2xl">{L("How it works", "كيف يعمل")}</h2>
        <ol className="mt-4 grid gap-3 md:grid-cols-4">{steps.map((s, i) => <li key={i} className="rounded-xl bg-muted p-4 text-sm"><span className="font-display text-primary">{i + 1}</span> {s}</li>)}</ol>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/explore" search={{ format: "license" }} className="rounded-full bg-primary px-5 py-2 text-primary-foreground">{L("Browse licensable works", "تصفّح الأعمال القابلة للترخيص")}</Link>
          <Link to="/support" className="rounded-full border border-border px-5 py-2">{L("Need a custom license?", "تحتاج ترخيصًا خاصًا؟")}</Link>
        </div>
      </div>
    </SiteShell>
  );
}
