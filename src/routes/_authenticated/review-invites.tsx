import { ReviewerChecklist } from "@/components/ReviewerChecklist";
import { ChecklistProgress } from "@/components/ChecklistProgress";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";

const sb = supabase as any;

export const Route = createFileRoute("/_authenticated/review-invites")({
  head: () => ({
    meta: [
      { title: "Review invitations — Arwiqa" },
      { name: "description", content: "Artworks you've been invited to review on Arwiqa." },
      { property: "og:title", content: "Review invitations — Arwiqa" },
      { property: "og:description", content: "Comment, score and recommend on artworks you were invited to review." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReviewInvites,
});

type Invite = { id: string; draft_id: string; email: string; permission: string; starts_at: string; expires_at: string | null; allow_download: boolean; watermark: boolean; status?: "pending" | "accepted" | "declined"; responded_at?: string | null };
type Draft = { id: string; title: string; title_ar: string; description: string; description_ar: string; image_path: string | null };

type Status = "pending" | "accepted" | "declined" | "expired";
const STATUS: Record<Status, [string, string, string]> = {
  pending: ["Pending", "بانتظار الرد", "bg-warning/15 text-warning"],
  accepted: ["Accepted", "مقبولة", "bg-success/15 text-success"],
  declined: ["Declined", "مرفوضة", "bg-destructive/10 text-destructive"],
  expired: ["Expired", "منتهية", "bg-muted text-muted-foreground"],
};
const statusOf = (i: Invite): Status => (i.expires_at && new Date(i.expires_at).getTime() <= Date.now() ? "expired" : (i.status ?? "pending"));

function StatusPill({ s, L }: { s: Status; L: (e: string, a: string) => string }) {
  const x = STATUS[s];
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${x[2]}`}>{L(x[0], x[1])}</span>;
}

function ReviewInvites() {
  const { locale } = useLocale();
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [sent, setSent] = useState<Invite[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<Status | "all">("all");

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    const email = u.user?.email?.toLowerCase() ?? "";
    const [mine, out] = await Promise.all([
      sb.from("listing_reviewers").select("*").eq("email", email).order("created_at", { ascending: false }),
      sb.from("listing_reviewers").select("*").eq("invited_by", u.user?.id ?? "").order("created_at", { ascending: false }),
    ]);
    setInvites(mine.data ?? []); setSent(out.data ?? []);
    const ids = [...new Set([...(mine.data ?? []), ...(out.data ?? [])].map((i: Invite) => i.draft_id))];
    if (ids.length) {
      const { data: d } = await sb.from("listing_drafts").select("id,title,title_ar,description,description_ar,image_path").in("id", ids);
      setDrafts(Object.fromEntries((d ?? []).map((x: Draft) => [x.id, x])));
    }
  };
  useEffect(() => { void load(); }, []);

  const respond = async (id: string, accept: boolean) => {
    const { error } = await sb.rpc("respond_review_invite", { _id: id, _accept: accept });
    if (error) { toast.error(error.message.includes("expired") ? L("This invitation has expired.", "انتهت هذه الدعوة.") : L("Couldn't send your answer.", "تعذّر إرسال ردك.")); return; }
    toast.success(accept ? L("Invitation accepted", "قُبلت الدعوة") : L("Invitation declined", "رُفضت الدعوة"));
    void load();
  };

  const title = (id: string) => { const d = drafts[id]; return d ? L(d.title || "Untitled", d.title_ar || "بلا عنوان") : L("Listing", "إعلان"); };
  const dates = (i: Invite) => `${new Date(i.starts_at).toLocaleDateString()}${i.expires_at ? ` → ${new Date(i.expires_at).toLocaleDateString()}` : ` · ${L("no end date", "بلا تاريخ انتهاء")}`}`;
  const counts = (["pending", "accepted", "declined", "expired"] as Status[]).map((s) => [s, sent.filter((i) => statusOf(i) === s).length] as const);
  const shown = sent.filter((i) => filter === "all" || statusOf(i) === filter);

  return (
    <SiteShell>
      <PageTitle eyebrow={L("Arwiqa", "أروقة")} title={L("Review invitations", "دعوات المراجعة")} sub={L("Invitations you've received, and the ones you've sent for your listings.", "الدعوات التي وصلتك، والتي أرسلتها لإعلاناتك.")} />
      <div className="container mx-auto max-w-4xl space-y-10 px-4 pb-16">
        <section aria-labelledby="sent-h" className="space-y-3">
          <h2 id="sent-h" className="font-display text-xl">{L("Invitations you sent", "دعوات أرسلتها")}</h2>
          <div className="flex flex-wrap gap-2 text-sm" role="group" aria-label={L("Filter by status", "تصفية حسب الحالة")}>
            <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")} className={`rounded-full border px-3 py-1 ${filter === "all" ? "border-primary bg-primary/10" : "border-border"}`}>{L("All", "الكل")} ({sent.length})</button>
            {counts.map(([s, n]) => (
              <button key={s} type="button" aria-pressed={filter === s} onClick={() => setFilter(s)} className={`rounded-full border px-3 py-1 ${filter === s ? "border-primary bg-primary/10" : "border-border"}`}>{L(STATUS[s][0], STATUS[s][1])} ({n})</button>
            ))}
          </div>
          {!sent.length ? <p className="text-muted-foreground">{L("You haven't invited anyone yet. Invite reviewers from the AI listing writer.", "لم تدعُ أحداً بعد. ادعُ المراجعين من كاتب الإعلانات الذكي.")}</p> : (
            <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
              {shown.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                  <div><p className="font-medium">{i.email}</p><p className="text-muted-foreground">{title(i.draft_id)} · {dates(i)}{i.responded_at ? ` · ${L("answered", "ردّ في")} ${new Date(i.responded_at).toLocaleDateString()}` : ""}</p></div>
                  <StatusPill s={statusOf(i)} L={L} />
                </li>
              ))}
              {!shown.length && <li className="p-4 text-muted-foreground">{L("No invitations with this status.", "لا دعوات بهذه الحالة.")}</li>}
            </ul>
          )}
        </section>

        <section aria-labelledby="recv-h" className="space-y-4">
          <h2 id="recv-h" className="font-display text-xl">{L("Invitations for you", "دعوات لك")}</h2>
          {!invites.length && <p className="text-muted-foreground">{L("No invitations yet.", "لا دعوات بعد.")}</p>}
          {invites.map((i) => {
            const d = drafts[i.draft_id]; const s = statusOf(i);
            const notOpen = new Date(i.starts_at).getTime() > Date.now();
            return (
              <article key={i.id} id={i.draft_id} className="scroll-mt-24 rounded-2xl border border-border bg-card p-5 target:ring-2 target:ring-primary">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-lg">{title(i.draft_id)}</h3>
                  <StatusPill s={s} L={L} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{L("Review dates", "مدة المراجعة")}: {dates(i)}{notOpen ? ` · ${L("not open yet", "لم تبدأ بعد")}` : ""}</p>
                {s === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => respond(i.id, true)} className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">{L("Accept", "اقبل")}</button>
                    <button type="button" onClick={() => respond(i.id, false)} className="rounded-full border border-border px-4 py-2 text-sm">{L("Decline", "اعتذر")}</button>
                  </div>)}
                {s === "accepted" && !notOpen && d && (open === i.id
                  ? <ReviewPanel draft={d} invite={i} />
                  : <button type="button" onClick={() => setOpen(i.id)} className="mt-3 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">{L("Open review", "افتح المراجعة")}</button>)}
              </article>
            );
          })}
        </section>
      </div>
    </SiteShell>
  );
}

function ReviewPanel({ draft, invite }: { draft: Draft; invite: Invite }) {
  const { locale } = useLocale();
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [img, setImg] = useState<string | null>(null);
  const [body, setBody] = useState(""); const [score, setScore] = useState(""); const [rec, setRec] = useState("");
  const [vis, setVis] = useState("artist");
  const [comments, setComments] = useState<any[]>([]);
  const canComment = invite.permission !== "view";
  const load = async () => { const { data } = await sb.from("listing_review_comments").select("*").eq("draft_id", draft.id).order("created_at"); setComments(data ?? []); };
  useEffect(() => {
    void load();
    if (draft.image_path) void supabase.storage.from("artwork-images").createSignedUrl(draft.image_path, 900).then(({ data }) => setImg(data?.signedUrl ?? null));
  }, [draft.id]);
  const post = async () => {
    if (!body.trim()) return;
    const { error } = await sb.from("listing_review_comments").insert({ draft_id: draft.id, body: body.trim(), visibility: vis,
      score: score ? Number(score) : null, recommendation: rec || null });
    if (error) { toast.error(L("Couldn't send — your invitation may not allow this.", "تعذّر الإرسال — قد لا تسمح دعوتك بذلك.")); return; }
    setBody(""); setScore(""); setRec(""); void load(); toast.success(L("Sent", "أُرسل"));
  };
  return (
    <div className="mt-4 grid gap-5 md:grid-cols-2">
      <div className="relative overflow-hidden rounded-xl bg-muted" onContextMenu={(e) => { if (!invite.allow_download) e.preventDefault(); }}>
        {img && <img src={img} alt={draft.title} draggable={invite.allow_download} className="w-full object-cover" />}
        {invite.watermark && <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center font-display text-3xl text-foreground/25 -rotate-12 select-none">ARWIQA · {L("REVIEW ONLY", "للمراجعة فقط")}</div>}
      </div>
      <div className="space-y-3 text-sm">
        <p className="whitespace-pre-wrap">{L(draft.description, draft.description_ar)}</p>
        <ul className="space-y-2">{comments.map((c) => <li key={c.id} className="rounded-xl bg-muted/50 p-3">{c.score ? `★${c.score} · ` : ""}{c.recommendation ? `${c.recommendation} · ` : ""}{c.body}</li>)}</ul>
        <ChecklistProgress draftId={draft.id} canEdit={false} refreshKey={comments.length} />
        {canComment && <ReviewerChecklist draftId={draft.id} onSent={() => void load()} />}
        {canComment ? (
          <div className="space-y-2">
            <textarea aria-label={L("Your comment", "تعليقك")} value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="w-full rounded-lg border border-input bg-background px-3 py-2" />
            <div className="flex flex-wrap gap-2">
              <select aria-label={L("Who can see it", "من يراه")} value={vis} onChange={(e) => setVis(e.target.value)} className="rounded-lg border border-input bg-background px-2 py-2">
                <option value="artist">{L("Artist-visible", "يراه الفنان")}</option>
                <option value="reviewers">{L("Reviewers + artist", "المراجعون والفنان")}</option>
                <option value="anonymous">{L("Anonymous jury", "لجنة مجهولة")}</option>
              </select>
              {(invite.permission === "score" || invite.permission === "recommend") && (
                <select aria-label={L("Score", "التقييم")} value={score} onChange={(e) => setScore(e.target.value)} className="rounded-lg border border-input bg-background px-2 py-2">
                  <option value="">{L("Score", "التقييم")}</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>★{n}</option>)}
                </select>)}
              {invite.permission === "recommend" && (
                <select aria-label={L("Recommendation", "التوصية")} value={rec} onChange={(e) => setRec(e.target.value)} className="rounded-lg border border-input bg-background px-2 py-2">
                  <option value="">{L("Recommendation", "التوصية")}</option>
                  <option value="approve">{L("Approve", "اعتماد")}</option><option value="changes">{L("Needs changes", "يحتاج تعديلات")}</option><option value="reject">{L("Reject", "رفض")}</option>
                </select>)}
              <button type="button" onClick={post} className="rounded-full bg-primary px-4 py-2 text-primary-foreground">{L("Send", "أرسل")}</button>
            </div>
          </div>
        ) : <p className="text-muted-foreground">{L("Your invitation is view only.", "دعوتك للمشاهدة فقط.")}</p>}
      </div>
    </div>
  );
}
