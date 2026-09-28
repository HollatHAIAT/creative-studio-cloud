import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { StaffGate } from "@/components/StaffGate";
import { ActionButton, useAction } from "@/components/ActionButton";
import { useLocale } from "@/lib/i18n";
import { listSubmittedDrafts, reviewListingPolicy, type PolicyReview } from "@/lib/policy-review.functions";

export const Route = createFileRoute("/_authenticated/admin/policy-review")({
  head: () => ({ meta: [
    { title: "Listing policy review — Arwiqa أروقة" },
    { name: "description", content: "Staff AI screening of submitted listings for policy issues and review risk." },
    { property: "og:title", content: "Listing policy review — Arwiqa" },
    { property: "og:description", content: "AI-assisted policy screening for submitted artwork listings." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: () => <StaffGate><PolicyReviewPage /></StaffGate>,
});

const tone = { low: "border-success text-success", medium: "border-warning text-warning", high: "border-destructive text-destructive" } as const;

function PolicyReviewPage() {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const L = (en: string, a: string) => (ar ? a : en);
  const list = useServerFn(listSubmittedDrafts);
  const review = useServerFn(reviewListingPolicy);
  const q = useQuery({ queryKey: ["admin", "submitted-drafts"], queryFn: () => list() });
  const [sel, setSel] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, PolicyReview>>({});
  const [err, setErr] = useState("");
  const d = q.data?.find((x) => x.id === sel) ?? null;
  const r = sel ? results[sel] : undefined;

  const run = useAction(async () => {
    if (!sel) return;
    setErr("");
    const res = await review({ data: { draftId: sel } });
    if (res.error || !res.review) { setErr(res.error ?? ""); throw new Error(res.error); }
    setResults((m) => ({ ...m, [sel]: res.review! }));
  });

  const riskLabel = (k: "low" | "medium" | "high") => ({ low: L("Low risk", "خطورة منخفضة"), medium: L("Medium risk", "خطورة متوسطة"), high: L("High risk", "خطورة عالية") })[k];
  const recLabel = (k: PolicyReview["recommendation"]) => ({ approve: L("Suggest: approve", "المقترح: قبول"), request_changes: L("Suggest: request changes", "المقترح: طلب تعديلات"), reject: L("Suggest: reject", "المقترح: رفض") })[k];
  const area = (k: string) => ({ image: L("Image", "الصورة"), title: L("Title", "العنوان"), description: L("Description", "الوصف"), altText: L("Alt text", "النص البديل"), tags: L("Tags", "الوسوم") } as Record<string, string>)[k] ?? k;

  return (
    <SiteShell>
      <PageTitle eyebrow={L("Staff", "الفريق")} title={L("Listing policy review", "مراجعة سياسات الإعلانات")}
        sub={L("Pick a submitted listing and let the AI screen its image and copy for policy issues. It's advice only — you make the decision.", "اختر إعلاناً مُرسلاً ليفحص الذكاء الاصطناعي صورته ونصوصه بحثاً عن مخالفات. النتيجة استشارية فقط والقرار لك.")} />
      <div className="mx-auto grid max-w-6xl gap-8 px-6 pb-16 lg:grid-cols-[280px_1fr]">
        <aside aria-label={L("Submitted listings", "الإعلانات المرسلة")} className="space-y-2">
          <h2 className="font-medium">{L("Submitted listings", "الإعلانات المرسلة")} {q.data && `(${q.data.length})`}</h2>
          {q.isLoading && <p className="text-sm text-muted-foreground">…</p>}
          {q.error && <p role="alert" className="text-sm text-destructive">{L("Couldn't load listings.", "تعذّر تحميل الإعلانات.")}</p>}
          {q.data?.length === 0 && <p className="text-sm text-muted-foreground">{L("No listings are waiting for review.", "لا توجد إعلانات بانتظار المراجعة.")}</p>}
          <ul className="space-y-2">
            {q.data?.map((x) => (
              <li key={x.id}>
                <button type="button" onClick={() => { setSel(x.id); setErr(""); }} aria-pressed={sel === x.id}
                  className={`flex w-full items-center gap-3 rounded-sm border p-2 text-start ${sel === x.id ? "border-primary" : "border-border hover:border-primary"}`}>
                  {x.imageUrl ? <img src={x.imageUrl} alt="" className="h-12 w-12 rounded-sm object-cover" /> : <span className="h-12 w-12 rounded-sm bg-muted" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{(ar ? x.title_ar : x.title) || L("Untitled", "بدون عنوان")}</span>
                    {results[x.id] && <span className={`mt-1 inline-block rounded-sm border px-1.5 text-xs ${tone[results[x.id].risk]}`}>{riskLabel(results[x.id].risk)}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {!d ? (
          <p className="rounded-sm border border-border p-6 text-muted-foreground">{L("Select a listing to review.", "اختر إعلاناً لمراجعته.")}</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-3">
              {d.imageUrl ? <img src={d.imageUrl} alt={(ar ? d.alt_text_ar : d.alt_text) || ""} className="max-h-[380px] w-full rounded-sm border border-border object-contain" />
                : <p className="rounded-sm border border-destructive p-4 text-sm text-destructive">{L("No image attached.", "لا توجد صورة.")}</p>}
              <dl className="space-y-2 text-sm">
                {([["Title", "العنوان", d.title, d.title_ar], ["Description", "الوصف", d.description, d.description_ar], ["Alt text", "النص البديل", d.alt_text, d.alt_text_ar]] as const).map(([en, a, v, va]) => (
                  <div key={en}><dt className="font-medium">{L(en, a)}</dt><dd dir="ltr" lang="en" className="text-start">{v || "—"}</dd><dd dir="rtl" lang="ar">{va || "—"}</dd></div>
                ))}
                <div><dt className="font-medium">{L("Medium & tags", "الوسيط والوسوم")}</dt><dd>{[d.medium, ...d.tags].filter(Boolean).join(" · ") || "—"}</dd></div>
              </dl>
              <ActionButton state={run.state} onClick={() => run.run()} onRetry={run.retry}
                loadingLabel={L("Screening…", "جارٍ الفحص…")} successLabel={L("Review ready", "المراجعة جاهزة")}
                errorLabel={err || L("Couldn't screen the listing.", "تعذّر فحص الإعلان.")} retryLabel={L("Try again", "حاول مجدداً")}
                className="w-full rounded-sm bg-primary px-5 py-3 text-primary-foreground">
                {r ? L("Screen again", "افحص مجدداً") : L("Screen for policy issues", "افحص المخالفات")}
              </ActionButton>
            </section>
            <section aria-live="polite" className="space-y-4">
              {!r ? <p className="rounded-sm border border-border p-6 text-muted-foreground">{L("The risk summary and any issues will appear here.", "سيظهر ملخص المخاطر والمخالفات هنا.")}</p> : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-sm border px-3 py-1 text-sm font-medium ${tone[r.risk]}`}>{riskLabel(r.risk)}</span>
                    <span className="rounded-sm border border-border px-3 py-1 text-sm">{recLabel(r.recommendation)}</span>
                  </div>
                  <p>{ar ? r.summaryAr : r.summary}</p>
                  {r.issues.length === 0 ? <p className="text-sm text-success">{L("No policy issues found.", "لم تُرصد مخالفات.")}</p> : (
                    <ul className="space-y-2">
                      {r.issues.map((i, n) => (
                        <li key={n} className="rounded-sm border border-border p-3 text-sm">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className={`rounded-sm border px-1.5 text-xs ${tone[i.severity]}`}>{riskLabel(i.severity)}</span>
                            <span className="font-medium">{area(i.area)}</span><span className="text-muted-foreground">· {i.policy}</span>
                          </div>
                          <p>{ar ? i.detailAr : i.detail}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-muted-foreground">{L("AI screening can miss or over-flag issues. Check the listing yourself before deciding.", "قد يخطئ الفحص الآلي أو يبالغ. راجع الإعلان بنفسك قبل القرار.")}</p>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </SiteShell>
  );
}
