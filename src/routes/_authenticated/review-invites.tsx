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

type Invite = { id: string; draft_id: string; permission: string; starts_at: string; expires_at: string | null; allow_download: boolean; watermark: boolean };
type Draft = { id: string; title: string; title_ar: string; description: string; description_ar: string; image_path: string | null };

function ReviewInvites() {
  const { locale } = useLocale();
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const email = (await supabase.auth.getUser()).data.user?.email?.toLowerCase() ?? "";
      const { data } = await sb.from("listing_reviewers").select("*").eq("email", email).order("created_at", { ascending: false });
      setInvites(data ?? []);
      const ids = (data ?? []).map((i: Invite) => i.draft_id);
      if (ids.length) {
        const { data: d } = await sb.from("listing_drafts").select("id,title,title_ar,description,description_ar,image_path").in("id", ids);
        setDrafts(Object.fromEntries((d ?? []).map((x: Draft) => [x.id, x])));
      }
    })();
  }, []);

  const now = Date.now();
  const state = (i: Invite) => new Date(i.starts_at).getTime() > now ? "upcoming" : i.expires_at && new Date(i.expires_at).getTime() <= now ? "expired" : "active";
  const stateL: Record<string, [string, string]> = { upcoming: ["Not open yet", "لم تبدأ بعد"], expired: ["Expired", "انتهت"], active: ["Open", "مفتوحة"] };

  return (
    <SiteShell>
      <PageTitle eyebrow={L("Arwiqa", "أروقة")} title={L("Review invitations", "دعوات المراجعة")} sub={L("Artworks artists asked you to review. You can't sell or change them.", "أعمال طلب منك أصحابها مراجعتها. لا يمكنك بيعها أو تعديلها.")} />
      <div className="container mx-auto max-w-4xl space-y-4 px-4 pb-16">
        {!invites.length && <p className="text-muted-foreground">{L("No invitations yet.", "لا دعوات بعد.")}</p>}
        {invites.map((i) => {
          const d = drafts[i.draft_id]; const s = state(i);
          return (
            <article key={i.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-lg">{d ? L(d.title || "Untitled", d.title_ar || "بلا عنوان") : L("Not available", "غير متاح")}</h2>
                <span className="rounded-full bg-muted px-3 py-1 text-xs">{L((stateL[s] ?? ["",""])[0], (stateL[s] ?? ["",""])[1])}{i.expires_at ? ` · ${L("until", "حتى")} ${new Date(i.expires_at).toLocaleDateString()}` : ""}</span>
              </div>
              {s === "active" && d && (open === i.id
                ? <ReviewPanel draft={d} invite={i} />
                : <button type="button" onClick={() => setOpen(i.id)} className="mt-3 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">{L("Open review", "افتح المراجعة")}</button>)}
            </article>
          );
        })}
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
