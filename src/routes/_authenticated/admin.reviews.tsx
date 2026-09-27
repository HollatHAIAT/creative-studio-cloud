import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { StaffGate } from "@/components/StaffGate";
import { Stars } from "@/components/Reviews";
import { useLocale } from "@/lib/i18n";
import { reinstateUser, suspendUser } from "@/lib/moderation.functions";

export const Route = createFileRoute("/_authenticated/admin/reviews")({
  head: () => ({ meta: [
    { title: "Moderation queue — Arwiqa أروقة" }, { name: "description", content: "Review reports, appeals, suspensions and the moderation log." },
    { property: "og:title", content: "Moderation — Arwiqa" }, { property: "og:description", content: "Moderator tools for reviews." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <StaffGate><Queue /></StaffGate>,
});

type Tab = "reports" | "appeals" | "all" | "decisions" | "users";

function Queue() {
  const { locale, num } = useLocale();
  const ar = locale === "ar";
  const L = (en: string, a: string) => (ar ? a : en);
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("reports");
  const [stars, setStars] = useState<number | null>(null);
  const [days, setDays] = useState(30);
  const suspend = useServerFn(suspendUser);
  const reinstate = useServerFn(reinstateUser);
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  const q = useQuery({
    queryKey: ["mod", days],
    queryFn: async () => {
      const [reviews, reports, appeals, audit, blocks, revs, listings] = await Promise.all([
        supabase.from("reviews").select("id, listing_id, user_id, author_name, rating, body, status, verified, helpful_count, created_at, removed_reason").gte("created_at", since).order("created_at", { ascending: false }),
        supabase.from("review_reports").select("id, review_id, reason, created_at, resolved_at").is("resolved_at", null).order("created_at"),
        supabase.from("review_appeals").select("id, review_id, user_id, message, status, created_at").eq("status", "pending").order("created_at"),
        supabase.from("moderation_audit").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(200),
        supabase.from("user_blocks").select("*").is("lifted_at", null).order("created_at", { ascending: false }),
        supabase.from("review_revisions").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("listings").select("id, title, owner_can_reply"),
      ]);
      return { reviews: reviews.data ?? [], reports: reports.data ?? [], appeals: appeals.data ?? [], audit: audit.data ?? [], blocks: (blocks.data ?? []).filter((b) => !b.blocked_until || new Date(b.blocked_until) > new Date()), revs: revs.data ?? [], listings: listings.data ?? [] };
    },
  });
  const d = q.data;
  const refresh = () => qc.invalidateQueries({ queryKey: ["mod"] });
  const rpc = async (p: PromiseLike<{ error: { message: string } | null }>, ok: string) => { const { error } = await p; if (error) toast.error(error.message); else { toast.success(ok); refresh(); } };
  const reviewById = (id: string) => d?.reviews.find((r) => r.id === id);
  const reason = (label: string) => { const r = prompt(label); return r && r.trim().length > 1 ? r.trim() : null; };
  const doSuspend = async (uid: string) => {
    const why = reason(L("Reason for suspension", "سبب الإيقاف")); if (!why) return;
    const len = prompt(L("Days (leave empty for permanent)", "عدد الأيام (اتركه فارغًا للإيقاف الدائم)"), "7");
    const n = len && len.trim() ? Number(len) : null;
    if (n !== null && (!Number.isInteger(n) || n < 1)) { toast.error(L("Enter whole days", "أدخل أيامًا صحيحة")); return; }
    const r = await suspend({ data: { userId: uid, days: n, reason: why } });
    if (!r.ok) toast.error(r.error); else { toast.success(L("User suspended", "أُوقف المستخدم")); if ("warning" in r && r.warning) toast.warning(r.warning); refresh(); }
  };

  const avg = d?.reviews.filter((r) => r.status === "visible").reduce((s, r, _i, a) => s + r.rating / a.length, 0) ?? 0;
  const tabs: [Tab, string, (number | undefined)?][] = [["reports", L("Reported", "مُبلّغ عنها"), d?.reports.length], ["appeals", L("Appeals", "الاعتراضات"), d?.appeals.length], ["all", L("All reviews", "كل التقييمات")], ["decisions", L("Recent decisions", "القرارات الأخيرة")], ["users", L("Suspensions", "الإيقافات"), d?.blocks.length]];
  const row = "rounded-sm border border-border p-4";
  const small = "rounded-full border border-border px-3 py-1 text-sm hover:border-primary";

  const ReviewCard = ({ id }: { id: string }) => { const r = reviewById(id); if (!r) return <p className="text-sm text-muted-foreground">{L("Review outside date range", "التقييم خارج الفترة")}</p>;
    return (<div><div className="flex flex-wrap items-center gap-2"><Stars n={r.rating} label={`${r.rating}/5`} /><strong>{r.author_name}</strong>{r.verified && <span className="text-xs text-primary">✓ {L("Verified", "موثّق")}</span>}<span className="text-xs text-muted-foreground">{r.listing_id} · {r.status}</span></div>{r.body && <p className="mt-1">{r.body}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {r.status === "visible" ? <button className={small} onClick={() => { const w = reason(L("Reason for removal (sent to the reviewer)", "سبب الحذف (يُرسل للمقيّم)")); if (w) void rpc(supabase.rpc("admin_moderate_review", { _review: r.id, _remove: true, _reason: w }), L("Removed", "حُذف")); }}>{L("Remove", "حذف")}</button>
          : <button className={small} onClick={() => void rpc(supabase.rpc("admin_moderate_review", { _review: r.id, _remove: false, _reason: "" }), L("Restored", "أُعيد"))}>{L("Restore", "إعادة")}</button>}
        <button className={small} onClick={() => void doSuspend(r.user_id)}>{L("Suspend author", "إيقاف الكاتب")}</button>
      </div>
      {d!.revs.filter((v) => v.review_id === r.id).length > 0 && <details className="mt-2 text-sm"><summary className="cursor-pointer">{L("Edit history", "سجل التعديلات")}</summary><ul className="mt-1 grid gap-1">{d!.revs.filter((v) => v.review_id === r.id).map((v) => <li key={v.id}><time dateTime={v.created_at}>{new Date(v.created_at).toLocaleString(ar ? "ar-SA" : "en-US")}</time> · {v.action} · {v.old_rating}★ “{v.old_body}”{v.new_body !== null ? ` → ${v.new_rating}★ “${v.new_body}”` : ""}</li>)}</ul></details>}
    </div>); };

  return (
    <SiteShell>
      <PageTitle eyebrow={L("Moderation", "الإشراف")} title={L("Reviews queue", "قائمة التقييمات")} />
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[[L("Reviews", "التقييمات"), num(d?.reviews.length ?? 0)], [L("Average rating", "متوسط التقييم"), num(Math.round(avg * 10) / 10)], [L("Open reports", "بلاغات مفتوحة"), num(d?.reports.length ?? 0)], [L("Pending appeals", "اعتراضات معلّقة"), num(d?.appeals.length ?? 0)]].map(([k, v]) => <div key={k} className={row}><p className="text-sm text-muted-foreground">{k}</p><p className="font-display text-3xl">{v}</p></div>)}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div role="tablist" aria-label={L("Queue", "القائمة")} className="flex flex-wrap gap-2">
            {tabs.map(([k, label, n]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-full border px-4 py-2 text-sm ${tab === k ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{label}{n !== undefined ? ` (${num(n)})` : ""}</button>)}
          </div>
          <label className="text-sm">{L("Period", "الفترة")} <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-sm border border-border bg-background px-2 py-1">{[7, 30, 90, 365].map((n) => <option key={n} value={n}>{num(n)} {L("days", "يوم")}</option>)}</select></label>
          {tab === "all" && <label className="text-sm">{L("Rating", "التقييم")} <select value={stars ?? ""} onChange={(e) => setStars(e.target.value ? Number(e.target.value) : null)} className="rounded-sm border border-border bg-background px-2 py-1"><option value="">{L("All", "الكل")}</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}★</option>)}</select></label>}
        </div>

        <div role="tabpanel" className="mt-6 grid gap-4">
          {q.isLoading && <p>…</p>}
          {tab === "reports" && (d?.reports.length ? d.reports.map((r) => <div key={r.id} className={row}><p className="text-sm text-destructive">{L("Report", "بلاغ")}: {r.reason}</p><div className="mt-2"><ReviewCard id={r.review_id} /></div>
            <button className={`${small} mt-2`} onClick={() => void rpc(supabase.rpc("admin_moderate_review", { _review: r.review_id, _remove: false, _reason: "Report dismissed" }), L("Dismissed", "رُفض البلاغ"))}>{L("Dismiss report", "رفض البلاغ")}</button></div>) : <p className="text-muted-foreground">{L("No open reports.", "لا بلاغات مفتوحة.")}</p>)}
          {tab === "appeals" && (d?.appeals.length ? d.appeals.map((a) => <div key={a.id} className={row}><p className="text-sm">{L("Appeal", "اعتراض")}: “{a.message}”</p><div className="mt-2"><ReviewCard id={a.review_id} /></div>
            <div className="mt-2 flex gap-2"><button className={small} onClick={() => void rpc(supabase.rpc("admin_decide_appeal", { _appeal: a.id, _overturn: true, _note: reason(L("Note to reviewer", "ملاحظة للمقيّم")) ?? "" }), L("Review restored", "أُعيد التقييم"))}>{L("Accept & restore", "قبول وإعادة")}</button>
              <button className={small} onClick={() => { const n = reason(L("Why the removal stands", "سبب إبقاء الحذف")); if (n) void rpc(supabase.rpc("admin_decide_appeal", { _appeal: a.id, _overturn: false, _note: n }), L("Removal upheld", "أُبقي الحذف")); }}>{L("Uphold removal", "إبقاء الحذف")}</button></div></div>) : <p className="text-muted-foreground">{L("No pending appeals.", "لا اعتراضات معلّقة.")}</p>)}
          {tab === "all" && d?.reviews.filter((r) => !stars || r.rating === stars).map((r) => <div key={r.id} className={row}><ReviewCard id={r.id} /></div>)}
          {tab === "decisions" && (
            <table className="w-full text-sm"><caption className="sr-only">{L("Moderation log", "سجل الإشراف")}</caption>
              <thead><tr className="text-start text-muted-foreground"><th scope="col" className="text-start">{L("When", "الوقت")}</th><th scope="col" className="text-start">{L("Action", "الإجراء")}</th><th scope="col" className="text-start">{L("Target", "الهدف")}</th><th scope="col" className="text-start">{L("Reason", "السبب")}</th><th scope="col" className="text-start">{L("By", "بواسطة")}</th></tr></thead>
              <tbody>{d?.audit.map((e) => <tr key={e.id} className="border-t border-border"><td className="py-2"><time dateTime={e.created_at}>{new Date(e.created_at).toLocaleString(ar ? "ar-SA" : "en-US")}</time></td><td>{e.action}</td><td className="font-mono text-xs">{e.target_type}:{e.target_id.slice(0, 8)}</td><td>{e.reason}</td><td className="font-mono text-xs">{e.actor.slice(0, 8)}</td></tr>)}</tbody></table>
          )}
          {tab === "users" && (<>
            {d?.blocks.length ? d.blocks.map((b) => <div key={b.id} className={`${row} flex flex-wrap items-center justify-between gap-2`}><div><p className="font-mono text-xs">{b.user_id}</p><p className="text-sm">{b.reason} · {b.blocked_until ? `${L("until", "حتى")} ${new Date(b.blocked_until).toLocaleString(ar ? "ar-SA" : "en-US")}` : L("permanent", "دائم")}</p></div>
              <button className={small} onClick={async () => { const r = await reinstate({ data: { userId: b.user_id, reason: reason(L("Reason for reinstating", "سبب إعادة التفعيل")) ?? "" } }); if (!r.ok) toast.error(r.error); else { toast.success(L("Reinstated", "أُعيد التفعيل")); refresh(); } }}>{L("Reinstate", "إعادة التفعيل")}</button></div>) : <p className="text-muted-foreground">{L("No active suspensions.", "لا إيقافات سارية.")}</p>}
            <h3 className="mt-6 font-display text-xl">{L("Seller reply permissions", "صلاحية رد البائع")}</h3>
            {d?.listings.map((l) => <label key={l.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={l.owner_can_reply} onChange={(e) => void rpc(supabase.rpc("admin_set_reply_permission", { _listing: l.id, _allowed: e.target.checked }), L("Updated", "حُدّث"))} />{l.title}</label>)}
          </>)}
        </div>
      </div>
    </SiteShell>
  );
}
