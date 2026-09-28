import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ShoppingBag, MapPin } from "lucide-react";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { supplies, supplyTypes, fmt } from "@/lib/data";
import { actions } from "@/lib/store";
import { useLocale } from "@/lib/i18n";
import hero from "@/assets/supplies.jpg";

const TYPE: Record<string, [string, string]> = { paint: ["Paints", "ألوان"], brush: ["Brushes", "فرش"], canvas: ["Canvas", "كانفس"], calligraphy: ["Calligraphy", "أدوات الخط"], clay: ["Clay & pottery", "طين وفخار"], textile: ["Sadu & textile", "السدو والنسيج"] };

export const Route = createFileRoute("/supplies")({
  head: () => ({ meta: [
    { title: "Saudi art supplies — paints, brushes, qalam, clay | Arwiqa أروقة" },
    { name: "description", content: "Shop paints, brushes, calligraphy reeds, pottery clay and Sadu yarn from makers across Saudi Arabia." },
    { property: "og:title", content: "Saudi art supplies — Arwiqa" },
    { property: "og:description", content: "Paints, brushes, qalam, clay and Sadu yarn from Saudi makers." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Supplies,
});

function Supplies() {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const [type, setType] = useState<string>("all");
  const [qty, setQty] = useState<Record<string, number>>({});
  const shown = type === "all" ? supplies : supplies.filter((s) => s.type === type);
  return (
    <SiteShell>
      <PageTitle eyebrow={L("Made in Saudi Arabia", "صُنع في السعودية")} title={L("Art supplies", "مستلزمات الفن")} sub={L("Paints, brushes, qalam, clay and Sadu yarn from makers in Riyadh, Abha, Al-Ahsa, Madinah and beyond.", "ألوان وفرش وأقلام قصب وطين وصوف السدو من صنّاع في الرياض وأبها والأحساء والمدينة وغيرها.")} />
      <div className="mx-auto max-w-7xl space-y-8 px-6 pb-16">
        <img src={hero} alt={L("Paint tubes, brushes, reed pens and small canvases on linen", "أنابيب ألوان وفرش وأقلام قصب ولوحات صغيرة على قماش كتان")} width={1536} height={864} className="aspect-[21/8] w-full rounded-3xl object-cover" />
        <div role="group" aria-label={L("Filter by type", "التصفية حسب النوع")} className="flex flex-wrap gap-2">
          {["all", ...supplyTypes].map((t) => (
            <button key={t} aria-pressed={type === t} onClick={() => setType(t)} className={`rounded-md border px-4 py-2 text-sm ${type === t ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}`}>
              {t === "all" ? L("All", "الكل") : ar ? TYPE[t]![1] : TYPE[t]![0]}
            </button>))}
        </div>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((s) => {
            const n = qty[s.id] ?? 1;
            return (
              <li key={s.id} className="flex flex-col rounded-3xl border border-border bg-card p-5">
                <div className="flex items-center gap-4">
                  <span aria-hidden className="h-14 w-14 shrink-0 rounded-2xl shadow-inner" style={{ background: s.swatch }} />
                  <div className="min-w-0"><h2 className="font-medium leading-snug">{ar ? s.nameAr : s.name}</h2>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{ar ? `${s.makerAr} · ${s.cityAr}` : `${s.maker} · ${s.city}`}</p></div>
                </div>
                <p className="mt-3 flex-1 text-sm text-muted-foreground">{ar ? s.descriptionAr : s.description}</p>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <span className="font-display text-xl">{fmt(s.price)}</span>
                  <span className="flex items-center gap-2">
                    <input type="number" min={1} max={20} value={n} onChange={(e) => setQty({ ...qty, [s.id]: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} aria-label={L("Quantity", "الكمية")} className="w-16 rounded-md border border-border bg-background px-2 py-2 text-center" />
                    <button onClick={() => { actions.addToCart({ key: `supply:${s.id}`, kind: "supply", supplyId: s.id, qty: n }); toast.success(L("Added to basket", "أُضيف إلى السلة")); }} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"><ShoppingBag className="h-4 w-4" />{L("Add", "أضف")}</button>
                  </span>
                </div>
              </li>);
          })}
        </ul>
        <p className="text-xs text-muted-foreground">{L("Sample catalogue: maker names and products are placeholders until real Saudi suppliers are onboarded.", "كتالوج تجريبي: أسماء الصنّاع والمنتجات مؤقتة حتى ينضم موردون سعوديون حقيقيون.")}</p>
      </div>
    </SiteShell>
  );
}
