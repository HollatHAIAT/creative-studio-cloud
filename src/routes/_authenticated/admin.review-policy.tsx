import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";
import { useStaff } from "@/lib/auth";
import { CATEGORIES } from "@/components/ReviewPath";

const sb = supabase as any;

export const Route = createFileRoute("/_authenticated/admin/review-policy")({
  head: () => ({
    meta: [
      { title: "Review policy — Arwiqa staff" },
      { name: "description", content: "Decide when sellers may publish directly and when platform review is required." },
      { property: "og:title", content: "Review policy — Arwiqa staff" },
      { property: "og:description", content: "Configure direct publishing and required platform review." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReviewPolicy,
});

function ReviewPolicy() {
  const { locale } = useLocale();
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const staff = useStaff();
  const [allow, setAllow] = useState(true);
  const [cats, setCats] = useState<string[]>([]);
  const [limit, setLimit] = useState("50000");

  useEffect(() => {
    void sb.from("review_policies").select("*").eq("id", 1).single().then(({ data }: any) => {
      if (data) { setAllow(data.allow_direct_publish); setCats(data.platform_review_categories); setLimit(String(data.platform_review_price_over)); }
    });
  }, []);

  const save = async () => {
    const { error } = await sb.from("review_policies").update({ allow_direct_publish: allow, platform_review_categories: cats,
      platform_review_price_over: Number(limit) || 0, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) toast.error(L("Couldn't save", "تعذّر الحفظ")); else toast.success(L("Policy saved", "حُفظت السياسة"));
  };

  if (!staff.data) return <SiteShell><p className="container mx-auto p-8">{L("Staff only.", "للفريق فقط.")}</p></SiteShell>;
  return (
    <SiteShell>
      <PageTitle title={L("Review policy", "سياسة المراجعة")} subtitle={L("Creative review is the seller's choice. These rules decide when Arwiqa staff must review first.", "المراجعة الفنية اختيار البائع. هذه القواعد تحدد متى يجب أن يراجع فريق أروقة أولاً.")} />
      <div className="container mx-auto max-w-2xl space-y-6 px-4 pb-16 text-sm">
        <label className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <input type="checkbox" checked={allow} onChange={(e) => setAllow(e.target.checked)} />
          <span><span className="block font-medium">{L("Allow sellers to publish directly", "السماح للبائعين بالنشر المباشر")}</span>
            <span className="text-muted-foreground">{L("Platform checks (readiness, suspended accounts, ownership declaration) still always run.", "فحوص المنصة (الجاهزية، الحسابات الموقوفة، إقرار الملكية) تعمل دائماً.")}</span></span>
        </label>
        <fieldset className="rounded-2xl border border-border bg-card p-4">
          <legend className="px-1 font-medium">{L("Categories that always need platform review", "تصنيفات تتطلب مراجعة المنصة دائماً")}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <label key={c} className={`cursor-pointer rounded-full border px-3 py-1 ${cats.includes(c) ? "border-primary bg-primary/10" : "border-border"}`}>
                <input type="checkbox" className="sr-only" checked={cats.includes(c)} onChange={() => setCats(cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c])} />{c}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block rounded-2xl border border-border bg-card p-4">
          <span className="block font-medium">{L("Platform review for prices above (USD)", "مراجعة المنصة للأسعار فوق (دولار)")}</span>
          <input type="number" min={0} value={limit} onChange={(e) => setLimit(e.target.value)} className="mt-2 w-48 rounded-lg border border-input bg-background px-3 py-2" />
        </label>
        <button type="button" onClick={save} className="rounded-full bg-primary px-6 py-2 text-primary-foreground">{L("Save policy", "احفظ السياسة")}</button>
      </div>
    </SiteShell>
  );
}
