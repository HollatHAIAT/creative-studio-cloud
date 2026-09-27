import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { Stars, StarInput } from "@/components/Reviews";
import { useLocale } from "@/lib/i18n";
import { DELETE_DAYS, EDIT_HOURS, ruleMessage } from "@/lib/marketplace";

export const Route = createFileRoute("/_authenticated/my-reviews")({
  head: () => ({ meta: [
    { title: "My reviews — Arwiqa أروقة" }, { name: "description", content: "Manage your artwork reviews, edit windows and appeals." },
    { property: "og:title", content: "My reviews — Arwiqa" }, { property: "og:description", content: "Manage your reviews on Arwiqa." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: MyReviews,
});

const left = (created: string, ms: number) => Math.max(0, new Date(created).getTime() + ms - Date.now());

function MyReviews() {
  const { locale, num } = useLocale();
  const ar = locale === "ar";
  const L = (en: string, a: string) => (ar ? a : en);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["my-reviews"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const [r, a] = await Promise.all([
        supabase.from("reviews").select("id, listing_id, rating, body, status, removed_reason, created_at, edited_at, owner_reply, verified, listings(title, title_ar)").eq("user_id", u.user!.id).neq("status", "deleted").order("created_at", { ascending: false }),
        supabase.from("review_appeals").select("review_id, status, decision_note, created_at"),
      ]);
      return { reviews: r.data ?? [], appeals: a.data ?? [] };
    },
  });
  const [edit, setEdit] = useState<{ id: string; rating: number; body: string } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["my-reviews"] });
  const run = async (p: PromiseLike<{ error: { message: string } | null }>, ok: string) => { const { error } = await p; if (error) toast.error(ruleMessage(new Error(error.message), ar)); else { toast.success(ok); refresh(); } };
  const dur = (ms: number) => { const h = Math.floor(ms / 3600_000); return h >= 24 ? `${num(Math.floor(h / 24))} ${L("days", "أيام")} ${num(h % 24)} ${L("h", "س")}` : `${num(h)} ${L("h", "س")} ${num(Math.floor((ms % 3600_000) / 60_000))} ${L("min", "د")}`; };

  return (
    <SiteShell>
      <PageTitle eyebrow={L("Account", "الحساب")} title={L("My reviews", "تقييماتي")} />
      <div className="mx-auto max-w-4xl px-6">
        <p className="text-sm text-muted-foreground">{L(`You can edit a review for ${EDIT_HOURS} hours and delete it for ${DELETE_DAYS} days after posting.`, `يمكنك تعديل التقييم خلال ${num(EDIT_HOURS)} ساعة وحذفه خلال ${num(DELETE_DAYS)} أيام من نشره.`)}</p>
        {q.isLoading && <p className="mt-6">…</p>}
        {q.data && !q.data.reviews.length && <p className="mt-6 text-muted-foreground">{L("You haven't reviewed anything yet.", "لم تقيّم أي عمل بعد.")}</p>}
        <ul className="mt-6 grid gap-6">
          {q.data?.reviews.map((r) => {
            const e = left(r.created_at, EDIT_HOURS * 3600_000), d = left(r.created_at, DELETE_DAYS * 86400_000);
            const appeal = q.data.appeals.find((a) => a.review_id === r.id);
            const title = r.listings ? (ar ? r.listings.title_ar || r.listings.title : r.listings.title) : r.listing_id;
            return (
              <li key={r.id} className="rounded-sm border border-border p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link to="/artwork/$id" params={{ id: r.listing_id }} className="font-display text-xl underline">{title}</Link>
                  <Stars n={r.rating} label={ar ? `${r.rating} من ٥` : `${r.rating} of 5`} />
                </div>
                {edit?.id === r.id ? (
                  <form className="mt-3" onSubmit={(ev) => { ev.preventDefault(); void run(supabase.rpc("edit_my_review", { _review: r.id, _rating: edit.rating, _body: edit.body }), L("Saved", "حُفظ")).then(() => setEdit(null)); }}>
                    <StarInput value={edit.rating} onChange={(n) => setEdit({ ...edit, rating: n })} label={L("Rating", "التقييم")} />
                    <label htmlFor={`b-${r.id}`} className="sr-only">{L("Review text", "نص التقييم")}</label>
                    <textarea id={`b-${r.id}`} value={edit.body} maxLength={2000} rows={3} onChange={(ev) => setEdit({ ...edit, body: ev.target.value })} className="mt-2 w-full rounded-sm border border-border bg-background px-3 py-2" />
                    <div className="mt-2 flex gap-2"><button className="rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground">{L("Save", "حفظ")}</button><button type="button" onClick={() => setEdit(null)} className="rounded-full border border-border px-4 py-1.5 text-sm">{L("Cancel", "إلغاء")}</button></div>
                  </form>
                ) : r.body && <p className="mt-2">{r.body}</p>}
                {r.status === "removed" && (
                  <div role="status" className="mt-3 rounded-sm border border-destructive p-3 text-sm">
                    <p className="text-destructive">{L("Removed by moderators", "أزاله المشرفون")}{r.removed_reason ? ` — ${r.removed_reason}` : ""}</p>
                    {appeal ? <p className="mt-1">{L("Appeal", "الاعتراض")}: <strong>{L(appeal.status, ({ pending: "قيد المراجعة", upheld: "رُفض", overturned: "قُبل" } as Record<string, string>)[appeal.status] ?? appeal.status)}</strong>{appeal.decision_note ? ` — ${appeal.decision_note}` : ""}</p>
                      : <button className="mt-2 underline" onClick={() => { const m = prompt(L("Explain why the review should be restored", "اشرح لماذا يجب إعادة التقييم")); if (m && m.trim().length >= 5) void run(supabase.from("review_appeals").insert({ review_id: r.id, message: m.trim().slice(0, 1000) }), L("Appeal sent", "أُرسل الاعتراض")); }}>{L("Appeal this decision", "اعترض على القرار")}</button>}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                  {r.status === "visible" && (e > 0
                    ? <button onClick={() => setEdit({ id: r.id, rating: r.rating, body: r.body })} className="underline">{L("Edit", "تعديل")} <span className="text-muted-foreground">({L("time left", "المتبقي")}: {dur(e)})</span></button>
                    : <span className="text-muted-foreground">{L("Editing closed", "انتهت مهلة التعديل")}</span>)}
                  {d > 0
                    ? <button onClick={() => { if (confirm(L("Delete this review?", "حذف هذا التقييم؟"))) void run(supabase.rpc("delete_my_review", { _review: r.id }), L("Deleted", "حُذف")); }} className="underline">{L("Delete", "حذف")} <span className="text-muted-foreground">({L("time left", "المتبقي")}: {dur(d)})</span></button>
                    : <span className="text-muted-foreground">{L("Deleting closed", "انتهت مهلة الحذف")}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </SiteShell>
  );
}
