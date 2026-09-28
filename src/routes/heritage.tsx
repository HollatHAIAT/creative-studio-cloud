import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { useLocale } from "@/lib/i18n";

export const Route = createFileRoute("/heritage")({
  head: () => ({ meta: [
    { title: "Explore Saudi Arabia & the Gulf — heritage map | Arwiqa أروقة" },
    { name: "description", content: "A heritage map of Saudi and Gulf crafts — Sadu weaving, Al-Qatt Al-Asiri, pottery, calligraphy — with museum-style labels and works to discover." },
    { property: "og:title", content: "Explore Saudi Arabia & the Gulf — Arwiqa" },
    { property: "og:description", content: "Discover regional crafts and heritage art on an interactive map." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Heritage,
});

type Region = { id: string; en: string; ar: string; x: number; y: number; gulf?: boolean; crafts: { en: string; ar: string; cat?: string }[]; label: [string, string] };
// Approximate positions on a stylised map (percent of the frame).
const REGIONS: Region[] = [
  { id: "najd", en: "Najd", ar: "نجد", x: 50, y: 45, crafts: [{ en: "Sadu weaving", ar: "نسيج السدو", cat: "Sadu" }, { en: "Najdi doors & woodwork", ar: "الأبواب النجدية والأعمال الخشبية" }],
    label: ["Heartland of mud-brick architecture and Bedouin Sadu weaving, with geometric bands in red, black and white.", "قلب العمارة الطينية ونسيج السدو البدوي، بشرائط هندسية بالأحمر والأسود والأبيض."] },
  { id: "hijaz", en: "Hijaz", ar: "الحجاز", x: 26, y: 50, crafts: [{ en: "Rawashin latticework", ar: "الرواشين الخشبية" }, { en: "Calligraphy", ar: "الخط العربي", cat: "Calligraphy" }],
    label: ["Red Sea trading coast known for carved wooden rawashin windows and a long tradition of calligraphy.", "ساحل تجاري على البحر الأحمر يشتهر برواشين الخشب المنقوشة وتقاليد عريقة في الخط العربي."] },
  { id: "asir", en: "Asir", ar: "عسير", x: 34, y: 76, crafts: [{ en: "Al-Qatt Al-Asiri", ar: "القط العسيري", cat: "Qatt" }],
    label: ["Mountain villages where women paint bold geometric Al-Qatt murals inside homes — listed by UNESCO.", "قرى جبلية ترسم فيها النساء جداريات القط العسيري الهندسية داخل البيوت — مسجّل في اليونسكو."] },
  { id: "jazan", en: "Jazan", ar: "جازان", x: 30, y: 88, crafts: [{ en: "Palm-frond basketry", ar: "الخوص وسعف النخيل" }],
    label: ["Southern coast with palm-weaving, straw hats and fishing-village crafts.", "ساحل جنوبي يشتهر بالخوص وقبعات القش وحِرف قرى الصيد."] },
  { id: "najran", en: "Najran", ar: "نجران", x: 48, y: 84, crafts: [{ en: "Silver jewellery", ar: "الحُلي الفضية" }, { en: "Mud towers", ar: "القصور الطينية" }],
    label: ["Known for multi-storey mud palaces and finely worked silver jewellery.", "تشتهر بالقصور الطينية متعددة الأدوار والحلي الفضية الدقيقة."] },
  { id: "ahsa", en: "Al-Ahsa", ar: "الأحساء", x: 68, y: 50, crafts: [{ en: "Pottery", ar: "الفخار", cat: "Pottery" }, { en: "Bisht tailoring", ar: "خياطة البشت" }],
    label: ["A vast palm oasis with centuries-old pottery workshops and master bisht tailors.", "واحة نخيل واسعة فيها ورش فخار عمرها قرون وخيّاطو بشوت مهرة."] },
  { id: "north", en: "Northern Borders & Hail", ar: "الحدود الشمالية وحائل", x: 44, y: 20, crafts: [{ en: "Rock art", ar: "الفنون الصخرية" }, { en: "Tent weaving", ar: "نسج بيوت الشعر" }],
    label: ["Home to ancient rock art at Jubbah and Shuwaymis and to woven goat-hair tents.", "موطن الفنون الصخرية القديمة في جبة والشويمس وبيوت الشعر المنسوجة."] },
  { id: "eastern", en: "Eastern Province", ar: "المنطقة الشرقية", x: 74, y: 34, crafts: [{ en: "Pearl-diving heritage", ar: "تراث الغوص على اللؤلؤ" }, { en: "Photography", ar: "التصوير", cat: "Photography" }],
    label: ["Gulf coast of pearling, dhow building and a lively contemporary art scene.", "ساحل خليجي عُرف بالغوص على اللؤلؤ وبناء السفن ومشهد فني معاصر نابض."] },
  { id: "kuwait", en: "Kuwait", ar: "الكويت", x: 70, y: 12, gulf: true, crafts: [{ en: "Al Sadu House textiles", ar: "نسيج بيت السدو" }], label: ["Sadu weaving is a living tradition preserved at Kuwait's Al Sadu House.", "السدو تقليد حيّ يحفظه بيت السدو في الكويت."] },
  { id: "bahrain", en: "Bahrain", ar: "البحرين", x: 82, y: 38, gulf: true, crafts: [{ en: "Pearling crafts", ar: "حرف اللؤلؤ" }], label: ["Its pearling path is a UNESCO World Heritage site.", "طريق اللؤلؤ فيها موقع تراث عالمي لليونسكو."] },
  { id: "qatar", en: "Qatar", ar: "قطر", x: 86, y: 46, gulf: true, crafts: [{ en: "Contemporary art", ar: "الفن المعاصر", cat: "Painting" }], label: ["Major museums and a growing contemporary art collection.", "متاحف كبرى ومجموعة متنامية من الفن المعاصر."] },
  { id: "uae", en: "UAE", ar: "الإمارات", x: 90, y: 58, gulf: true, crafts: [{ en: "Talli braiding", ar: "التلي" }], label: ["Talli braided embroidery and Al Sadu are inscribed UNESCO traditions.", "التلي والسدو من التقاليد المسجّلة في اليونسكو."] },
  { id: "oman", en: "Oman", ar: "عُمان", x: 92, y: 74, gulf: true, crafts: [{ en: "Silver khanjar", ar: "الخنجر الفضي" }, { en: "Pottery", ar: "الفخار", cat: "Pottery" }], label: ["Renowned for silver khanjars and Bahla pottery.", "تشتهر بالخناجر الفضية وفخار بهلاء."] },
];

function Heritage() {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const [sel, setSel] = useState<Region>(REGIONS[0]!);
  return (
    <SiteShell>
      <PageTitle eyebrow={L("Heritage map", "خريطة التراث")} title={L("Explore Saudi Arabia & the Gulf", "استكشف السعودية والخليج")} sub={L("Choose a region to read its museum label and find works in its crafts.", "اختر منطقة لتقرأ بطاقتها المتحفية وتجد أعمالاً من حِرفها.")} />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-16 md:grid-cols-[1.4fr_1fr]">
        <div role="group" aria-label={L("Regions", "المناطق")} className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-border bg-[radial-gradient(ellipse_at_45%_55%,hsl(var(--accent)/0.25),transparent_65%)] sadu-bg">
          <div aria-hidden className="absolute inset-y-6 end-[18%] w-px bg-border" />
          <span aria-hidden className="absolute bottom-3 end-4 text-xs text-muted-foreground">{L("Arabian Gulf", "الخليج العربي")}</span>
          <span aria-hidden className="absolute bottom-3 start-4 text-xs text-muted-foreground">{L("Red Sea", "البحر الأحمر")}</span>
          {REGIONS.map((r) => (
            <button key={r.id} type="button" aria-pressed={sel.id === r.id} onClick={() => setSel(r)}
              style={{ insetInlineStart: `${ar ? 100 - r.x : r.x}%`, top: `${r.y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rtl:translate-x-1/2 rounded-full border px-2.5 py-1 text-xs shadow-sm transition ${sel.id === r.id ? "border-primary bg-primary text-primary-foreground scale-110" : r.gulf ? "border-border bg-card/90" : "border-accent bg-card"}`}>
              {ar ? r.ar : r.en}
            </button>))}
        </div>
        <article aria-live="polite" className="space-y-4 self-start rounded-3xl border border-border bg-card p-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{sel.gulf ? L("Gulf", "الخليج") : L("Saudi Arabia", "المملكة العربية السعودية")}</p>
          <h2 className="font-display text-3xl">{ar ? sel.ar : sel.en}</h2>
          <div className="border-s-2 border-accent ps-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{L("Museum label", "البطاقة المتحفية")}</p>
            <p className="mt-1 leading-relaxed">{ar ? sel.label[1] : sel.label[0]}</p>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">{L("Crafts & traditions", "الحِرف والتقاليد")}</p>
            <ul className="flex flex-wrap gap-2">{sel.crafts.map((c) => (
              <li key={c.en}>{c.cat
                ? <Link to="/explore" search={{ cat: c.cat }} className="inline-block rounded-full border border-primary px-3 py-1 text-sm hover:bg-primary/10">{ar ? c.ar : c.en} →</Link>
                : <span className="inline-block rounded-full border border-border px-3 py-1 text-sm">{ar ? c.ar : c.en}</span>}</li>))}</ul>
          </div>
          <p className="text-xs text-muted-foreground">{L("Heritage items on Arwiqa always pass staff review, with ownership history and a condition report.", "القطع التراثية في أروقة تمر دائماً بمراجعة الفريق مع سجل الملكية وتقرير الحالة.")}</p>
        </article>
      </div>
    </SiteShell>
  );
}
