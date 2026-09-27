import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { SiteShell, ArtCard, PageTitle } from "@/components/SiteShell";
import { useListings } from "@/lib/store";
import { useLocale } from "@/lib/i18n";
import { recommendArtworks, type AdvisorResult } from "@/lib/advisor.functions";
import { ActionButton, useAction } from "@/components/ActionButton";

export const Route = createFileRoute("/advisor")({
  head: () => ({
    meta: [
      { title: "Art advisor — Arwiqa أروقة" },
      { name: "description", content: "Describe what you're looking for and get artwork recommendations from live listings." },
      { property: "og:title", content: "Art advisor — Arwiqa أروقة" },
      { property: "og:description", content: "Tell us your space, taste and budget — we'll suggest matching artworks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Advisor,
});

const EXAMPLES = [
  ["A calm piece for a living room, under $800", "عمل هادئ لغرفة المعيشة بأقل من ٨٠٠ دولار"],
  ["Calligraphy gift for my office", "هدية خط عربي لمكتبي"],
  ["Desert photography I can license for a website", "تصوير صحراوي يمكن ترخيصه لموقع إلكتروني"],
] as const;

function Advisor() {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const all = useListings();
  const call = useServerFn(recommendArtworks);
  const [need, setNeed] = useState("");
  const [res, setRes] = useState<AdvisorResult | null>(null);
  const act = useAction(async () => {
    const r = await call({ data: { need } });
    setRes(r);
    if (r.error) throw new Error(r.error);
  });
  const picks = (res?.picks ?? []).map((p) => ({ p, a: all.find((x) => x.id === p.id) })).filter((x) => x.a);

  return (
    <SiteShell>
      <PageTitle eyebrow={ar ? "مستشار فني" : "Art advisor"} title={ar ? "صِف ما تبحث عنه" : "Describe what you need"}
        sub={ar ? "اكتب المكان والذوق والميزانية، وسنقترح أعمالًا من المعروض حاليًا." : "Tell us the space, mood and budget — we'll suggest works from live listings."} />
      <div className="mx-auto max-w-4xl px-6 pb-20">
        <form onSubmit={(e) => { e.preventDefault(); if (need.trim().length >= 3) void act.run(); }} className="space-y-3">
          <label htmlFor="need" className="sr-only">{ar ? "ما تبحث عنه" : "What you need"}</label>
          <textarea id="need" value={need} onChange={(e) => setNeed(e.target.value)} maxLength={1000} rows={4}
            placeholder={ar ? "مثال: لوحة بألوان دافئة لمدخل المنزل بأقل من ١٠٠٠ دولار" : "e.g. A warm-toned painting for my entrance, under $1,000"}
            className="w-full rounded-md border border-border bg-card p-4 text-base outline-none focus:border-primary" />
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button key={ex[0]} type="button" onClick={() => setNeed(ar ? ex[1] : ex[0])}
                className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground hover:border-primary hover:text-foreground">{ar ? ex[1] : ex[0]}</button>
            ))}
          </div>
          <ActionButton type="submit" state={act.state} disabled={need.trim().length < 3}
            loadingLabel={ar ? "جارٍ البحث…" : "Finding matches…"} successLabel={ar ? "تم" : "Done"}
            errorLabel={res?.error ?? (ar ? "تعذّر الحصول على اقتراحات" : "Couldn't get suggestions")}
            onRetry={act.retry} retryLabel={ar ? "حاول مجددًا" : "Try again"}
            className="rounded-md bg-primary px-5 py-2.5 text-primary-foreground">
            <Sparkles aria-hidden className="h-4 w-4" />{ar ? "اقترح أعمالًا" : "Recommend artworks"}
          </ActionButton>
        </form>

        {res && !res.error && (
          <section aria-live="polite" className="mt-12">
            {picks.length === 0 ? (
              <p className="text-muted-foreground">{ar ? "لم نجد تطابقًا — جرّب وصفًا آخر." : "No close matches — try describing it differently."}</p>
            ) : (
              <div className="grid gap-8 sm:grid-cols-2">
                {picks.map(({ p, a }) => (
                  <div key={p.id} className="space-y-3">
                    <ArtCard a={a!} />
                    <p className="border-s-2 border-accent ps-3 text-sm text-muted-foreground">{ar ? p.reasonAr : p.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </SiteShell>
  );
}
