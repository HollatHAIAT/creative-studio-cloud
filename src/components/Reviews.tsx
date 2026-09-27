import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { EDIT_HOURS, filterReviews, ruleMessage, summarize, useReviews, type Review, type ReviewFilter } from "@/lib/marketplace";

/** Accessible 1–5 rating: a radio group operable with arrow keys. */
export function StarInput({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const { locale } = useLocale();
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1"
      onKeyDown={(e) => {
        const fwd = locale === "ar" ? "ArrowLeft" : "ArrowRight", back = locale === "ar" ? "ArrowRight" : "ArrowLeft";
        if (e.key === fwd || e.key === "ArrowUp") { e.preventDefault(); onChange(Math.min(5, value + 1)); }
        if (e.key === back || e.key === "ArrowDown") { e.preventDefault(); onChange(Math.max(1, value - 1)); }
      }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} tabIndex={value === n || (!value && n === 1) ? 0 : -1}
          aria-label={locale === "ar" ? `${n} من ٥ نجوم` : `${n} of 5 stars`} onClick={() => onChange(n)}
          className="rounded-sm p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <Star aria-hidden className={`h-6 w-6 ${n <= value ? "fill-primary text-primary" : "text-muted-foreground"}`} />
        </button>
      ))}
    </div>
  );
}

export function Stars({ n, label }: { n: number; label: string }) {
  return (
    <span role="img" aria-label={label} className="inline-flex">
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} aria-hidden className={`h-4 w-4 ${i <= Math.round(n) ? "fill-primary text-primary" : "text-muted-foreground"}`} />)}
    </span>
  );
}

export function Reviews({ listingId }: { listingId: string }) {
  const { locale, num } = useLocale();
  const ar = locale === "ar";
  const L = (en: string, a: string) => (ar ? a : en);
  const r = useReviews(listingId);
  const [f, setF] = useState<ReviewFilter>({ stars: null, verified: false, sort: "helpful" });
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const data = r.data;
  const reviews = data?.reviews ?? [];
  const sum = summarize(reviews);
  const list = filterReviews(reviews.filter((x) => x.status === "visible" || x.user_id === r.user?.id), f);
  const mine = reviews.find((x) => x.user_id === r.user?.id);
  const act = async (fn: () => Promise<void>, ok: string) => { setBusy(true); try { await fn(); toast.success(ok); } catch (e) { toast.error(ruleMessage(e, ar)); } finally { setBusy(false); } };
  const openFilter = (stars: number | null, verified = false) => { setF({ ...f, stars, verified }); document.getElementById("review-list")?.focus(); };
  const starsLabel = (n: number) => (ar ? `التقييم ${num(Math.round(n * 10) / 10)} من ٥` : `Rated ${n.toFixed(1)} out of 5`);
  const field = "w-full rounded-sm border border-border bg-background px-3 py-2";

  return (
    <section aria-labelledby="reviews-h" className="mx-auto max-w-7xl px-6 pt-16">
      <h2 id="reviews-h" className="font-display text-3xl">{L("Ratings & reviews", "التقييمات والمراجعات")}</h2>
      <div className="mt-6 grid gap-10 md:grid-cols-3">
        <div>
          <p className="font-display text-5xl">{sum.total ? num(Math.round(sum.avg * 10) / 10) : "—"}</p>
          <Stars n={sum.avg} label={starsLabel(sum.avg)} />
          <p className="mt-1 text-sm text-muted-foreground">{num(sum.total)} {L("reviews", "تقييم")} · {num(sum.verified)} {L("verified purchases", "شراء موثّق")}</p>
          <ul className="mt-4 grid gap-1" aria-label={L("Rating distribution", "توزيع التقييمات")}>
            {sum.dist.map((d) => {
              const pct = sum.total ? Math.round((d.count / sum.total) * 100) : 0;
              return (
                <li key={d.stars}>
                  <button onClick={() => openFilter(d.stars)} aria-pressed={f.stars === d.stars}
                    aria-label={ar ? `${d.stars} نجوم: ${num(d.count)} تقييم، اعرضها` : `${d.stars} stars: ${d.count} reviews, show them`}
                    className="flex w-full items-center gap-2 rounded-sm p-1 text-sm hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                    <span className="w-6">{num(d.stars)}★</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-primary" style={{ width: `${pct}%` }} /></span>
                    <span className="w-10 text-end">{num(pct)}%</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {sum.verified > 0 && <button onClick={() => openFilter(null, true)} className="mt-2 text-sm underline">{L("Show verified purchases only", "اعرض المشتريات الموثّقة فقط")}</button>}

          <div className="mt-8 rounded-sm border border-border p-4">
            {!r.user ? <p className="text-sm">{L("Sign in to review this work.", "سجّل الدخول لتقييم هذا العمل.")} <Link to="/auth" className="underline">{L("Sign in", "تسجيل الدخول")}</Link></p>
              : mine && !editing ? <p className="text-sm text-muted-foreground">{L("You've reviewed this work.", "قيّمت هذا العمل.")} <Link to="/my-reviews" className="underline">{L("Manage my reviews", "إدارة تقييماتي")}</Link></p>
              : !data?.canReview && !editing ? <p className="text-sm text-muted-foreground">{L("Only buyers who purchased this work can review it.", "التقييم متاح فقط لمن اشترى هذا العمل.")}</p>
              : (
                <form onSubmit={(e) => { e.preventDefault(); if (!rating) { toast.error(L("Choose a rating", "اختر تقييمًا")); return; }
                  const name = (r.user?.user_metadata?.["full_name"] as string | undefined) ?? r.user?.email?.split("@")[0] ?? "";
                  void act(async () => { if (editing) await r.edit(editing.id, rating, body); else await r.post(rating, body, name); setEditing(null); setBody(""); setRating(0); }, L("Review saved", "حُفظ التقييم")); }}>
                  <p className="mb-2 text-sm font-medium">{editing ? L("Edit your review", "عدّل تقييمك") : L("Write a review", "اكتب تقييمًا")}</p>
                  <StarInput value={rating} onChange={setRating} label={L("Your rating", "تقييمك")} />
                  <label htmlFor="rv-body" className="sr-only">{L("Your review", "مراجعتك")}</label>
                  <textarea id="rv-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={4} className={`${field} mt-3`} placeholder={L("What did you think?", "ما رأيك؟")} />
                  <button disabled={busy} className="mt-3 rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground disabled:opacity-50">{L("Submit", "إرسال")}</button>
                </form>
              )}
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="flex flex-wrap items-center gap-3" role="group" aria-label={L("Filter and sort reviews", "تصفية وترتيب التقييمات")}>
            <label className="text-sm">{L("Rating", "التقييم")}{" "}
              <select value={f.stars ?? ""} onChange={(e) => setF({ ...f, stars: e.target.value ? Number(e.target.value) : null })} className="rounded-sm border border-border bg-background px-2 py-1">
                <option value="">{L("All", "الكل")}</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{num(n)}★</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.verified} onChange={(e) => setF({ ...f, verified: e.target.checked })} />{L("Verified purchase", "شراء موثّق")}</label>
            <label className="text-sm">{L("Sort", "الترتيب")}{" "}
              <select value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value as ReviewFilter["sort"] })} className="rounded-sm border border-border bg-background px-2 py-1">
                <option value="helpful">{L("Most helpful", "الأكثر فائدة")}</option><option value="newest">{L("Newest", "الأحدث")}</option><option value="oldest">{L("Oldest", "الأقدم")}</option>
                <option value="highest">{L("Highest rating", "الأعلى تقييمًا")}</option><option value="lowest">{L("Lowest rating", "الأدنى تقييمًا")}</option>
              </select>
            </label>
            {(f.stars || f.verified) && <button onClick={() => setF({ ...f, stars: null, verified: false })} className="text-sm underline">{L("Clear filters", "مسح التصفية")}</button>}
          </div>
          <p className="sr-only" aria-live="polite">{ar ? `${num(list.length)} تقييم معروض` : `${list.length} reviews shown`}</p>
          <ul id="review-list" tabIndex={-1} className="mt-6 grid gap-6 outline-none" aria-label={L("Reviews", "التقييمات")}>
            {!list.length && <li className="text-muted-foreground">{L("No reviews match.", "لا توجد تقييمات مطابقة.")}</li>}
            {list.map((x) => {
              const own = x.user_id === r.user?.id;
              const canEdit = own && Date.now() - new Date(x.created_at).getTime() < EDIT_HOURS * 3600_000;
              return (
                <li key={x.id} className="border-b border-border pb-6">
                  <article aria-label={`${x.author_name}, ${ar ? `${x.rating} من ٥` : `${x.rating} of 5`}`}>
                    <div className="flex flex-wrap items-center gap-3">
                      <Stars n={x.rating} label={ar ? `${x.rating} من ٥ نجوم` : `${x.rating} of 5 stars`} />
                      <span className="font-medium">{x.author_name}</span>
                      {x.verified && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">✓ {L("Verified purchase", "شراء موثّق")}</span>}
                      <time dateTime={x.created_at} className="text-xs text-muted-foreground">{new Date(x.created_at).toLocaleDateString(ar ? "ar-SA" : "en-US")}{x.edited_at ? ` · ${L("edited", "معدّل")}` : ""}</time>
                      {x.status === "removed" && <span className="text-xs text-destructive">{L("Removed by moderators", "أزاله المشرفون")}</span>}
                    </div>
                    {x.body && <p className="mt-2 whitespace-pre-line">{x.body}</p>}
                    {x.owner_reply && <div className="mt-3 border-s-2 border-primary ps-3 text-sm"><p className="font-medium">{L("Seller response", "ردّ البائع")}</p><p>{x.owner_reply}</p></div>}
                    <div className="mt-3 flex flex-wrap gap-3 text-sm">
                      {r.user && !own && (
                        <button aria-pressed={data?.voted.has(x.id)} onClick={() => act(() => r.vote(x.id, !data?.voted.has(x.id)), L("Thanks for your feedback", "شكرًا لملاحظتك"))} className="rounded-full border border-border px-3 py-1">
                          {L("Helpful", "مفيد")} ({num(x.helpful_count)})
                        </button>
                      )}
                      {!r.user && x.helpful_count > 0 && <span className="text-muted-foreground">{num(x.helpful_count)} {L("found this helpful", "وجدوه مفيدًا")}</span>}
                      {r.user && !own && <button onClick={() => { const why = prompt(L("Why are you reporting this review?", "لماذا تبلّغ عن هذا التقييم؟")); if (why && why.trim().length > 1) void act(() => r.report(x.id, why.trim().slice(0, 500)), L("Reported to moderators", "أُبلغ المشرفون")); }} className="underline">{L("Report", "إبلاغ")}</button>}
                      {canEdit && <button onClick={() => { setEditing(x); setRating(x.rating); setBody(x.body); document.getElementById("rv-body")?.focus(); }} className="underline">{L("Edit", "تعديل")}</button>}
                      {(data?.isOwner || r.user && data && false) && data.ownerCanReply && !x.owner_reply && (
                        <button onClick={() => { const t = prompt(L("Your response", "ردّك")); if (t && t.trim()) void act(() => r.reply(x.id, t.trim()), L("Response posted", "نُشر الرد")); }} className="underline">{L("Respond", "رد")}</button>
                      )}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
