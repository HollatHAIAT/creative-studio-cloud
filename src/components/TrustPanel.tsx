import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, FileCheck2, History, ScrollText, ShieldCheck, ShieldQuestion } from "lucide-react";
import type { ReactNode } from "react";
import { useLocale } from "@/lib/i18n";
import { getListingTrust } from "@/lib/listing-trust.functions";

const ROLE: Record<string, [string, string]> = {
  owner: ["Sold by the owner", "يبيعه المالك"], agent: ["Sold by an authorised agent", "يبيعه وكيل مفوّض"],
  consignment: ["Sold on consignment", "يُباع بالأمانة"], heir: ["Sold by an heir", "يبيعه وريث"], co_owner: ["Sold by a joint owner", "يبيعه مالك مشارك"],
};
const GRADE: Record<string, [string, string]> = { excellent: ["Excellent", "ممتازة"], very_good: ["Very good", "جيدة جدًا"], good: ["Good", "جيدة"], fair: ["Fair", "مقبولة"], poor: ["Poor", "ضعيفة"] };

function Row({ icon, title, ok, children }: { icon: ReactNode; title: string; ok: boolean | null; children: ReactNode }) {
  return (
    <li className="flex gap-3 py-3">
      <span aria-hidden className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${ok ? "bg-success/15 text-success" : ok === false ? "bg-muted text-muted-foreground" : "bg-warning/15 text-warning"}`}>{icon}</span>
      <div className="min-w-0 text-sm"><p className="font-medium">{title}</p><div className="text-muted-foreground">{children}</div></div>
    </li>
  );
}

/** Buyer-facing trust facts for a live listing: ownership approval, provenance, condition, export permit. */
export function TrustPanel({ listingId }: { listingId: string }) {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const fetchTrust = useServerFn(getListingTrust);
  const q = useQuery({ queryKey: ["listing-trust", listingId], queryFn: () => fetchTrust({ data: { id: listingId } }), staleTime: 60_000 });
  const t = q.data;
  const nr = L("Not recorded for this work.", "غير مسجّل لهذا العمل.");
  const date = (s: string) => new Date(s).toLocaleDateString(ar ? "ar" : "en", { year: "numeric", month: "long", day: "numeric" });

  return (
    <section aria-labelledby={`trust-${listingId}`} className="mt-8 rounded-2xl border border-border bg-card p-5">
      <h2 id={`trust-${listingId}`} className="flex items-center gap-2 font-display text-xl"><ShieldCheck aria-hidden className="h-5 w-5 text-primary" />{L("Trust & provenance", "الثقة والمصدر")}</h2>
      {q.isLoading ? <p className="mt-3 text-sm text-muted-foreground">{L("Loading…", "جارٍ التحميل…")}</p>
        : !t?.found ? <p className="mt-3 text-sm text-muted-foreground">{L("No ownership, provenance, condition or export records have been added for this work yet. Ask the seller for documents before buying.", "لم تُضف بعد سجلات ملكية أو مصدر أو حالة أو تصدير لهذا العمل. اطلب المستندات من البائع قبل الشراء.")}</p>
        : (
        <ul className="mt-2 divide-y divide-border">
          <Row icon={<BadgeCheck className="h-4 w-4" />} title={L("Ownership", "الملكية")} ok={t.ownerApprovedAt || t.sellerRole === "owner" ? true : t.ownerDeclared ? null : false}>
            <p>{t.sellerRole ? L(...(ROLE[t.sellerRole] ?? [t.sellerRole, t.sellerRole])) : L("Seller role not stated.", "لم يُذكر دور البائع.")}</p>
            {t.ownerApprovedAt ? <p className="text-success">{L("Owner approved this sale on", "وافق المالك على البيع في")} {date(t.ownerApprovedAt)}</p>
              : t.sellerRole && t.sellerRole !== "owner" ? <p>{L("Owner approval not recorded.", "لم تُسجّل موافقة المالك.")}</p> : null}
            {t.ownerDeclared && <p>{L("The seller declared they own it or are authorised to sell it.", "أقرّ البائع بأنه يملكه أو مفوّض ببيعه.")}</p>}
            {t.coOwners > 0 && <p>{L(`${t.coOwners} joint owner(s) listed.`, `${t.coOwners} مالك مشارك مُدرج.`)}</p>}
          </Row>
          <Row icon={<History className="h-4 w-4" />} title={L("Provenance history", "تاريخ المصدر")} ok={t.provenance.length ? true : false}>
            {(t.region || t.era || t.heritageType) && <p>{[t.heritageType, t.region, t.era].filter(Boolean).join(" · ")}</p>}
            {t.provenance.length ? (
              <ol className="mt-1 space-y-1 border-s border-border ps-3">{t.provenance.map((p, i) => (
                <li key={i}>{p.period} <span className={`ms-1 rounded-full px-2 py-0.5 text-xs ${p.documented ? "bg-success/15 text-success" : "bg-muted"}`}>{p.documented ? L("Documented", "موثّق") : L("No document", "بلا مستند")}</span></li>))}</ol>
            ) : <p>{nr}</p>}
            {t.provenance.length > 0 && <p className="mt-1 text-xs">{L("Previous holders' names are kept private.", "أسماء المالكين السابقين تبقى خاصة.")}</p>}
          </Row>
          <Row icon={<ScrollText className="h-4 w-4" />} title={L("Condition report", "تقرير الحالة")} ok={t.conditionGrade ? true : false}>
            {t.conditionGrade ? <p className="font-medium text-foreground">{L(...(GRADE[t.conditionGrade] ?? [t.conditionGrade, t.conditionGrade]))}</p> : <p>{nr}</p>}
            {t.conditionReport && <p className="mt-1 whitespace-pre-line">{t.conditionReport}</p>}
          </Row>
          {(t.isHeritage || t.exportPermit) && (
            <Row icon={t.exportPermit ? <FileCheck2 className="h-4 w-4" /> : <ShieldQuestion className="h-4 w-4" />} title={L("Export permit", "تصريح التصدير")} ok={t.exportPermit ? true : null}>
              {t.exportPermit ? <p>{L("Permit on file, reference", "التصريح مسجّل، الرقم")} <span dir="ltr" className="font-mono">{t.exportPermit}</span></p>
                : <p>{L("No export permit recorded. Heritage items may need one to leave Saudi Arabia — ask the seller.", "لا يوجد تصريح تصدير مسجّل. قد تحتاج القطع التراثية إلى تصريح لمغادرة السعودية — اسأل البائع.")}</p>}
            </Row>)}
        </ul>)}
      <p className="mt-3 text-xs text-muted-foreground">{L("Shown as provided by the seller. Arwiqa checks listings before they go live but doesn't certify authenticity.", "تُعرض كما قدّمها البائع. تراجع أروقة الإعلانات قبل نشرها لكنها لا تصادق على الأصالة.")}</p>
    </section>
  );
}
