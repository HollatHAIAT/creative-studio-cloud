import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";
import { DeliveryDiagnosis } from "./DeliveryDiagnosis";

type Inv = { id: string; draft_id: string; email: string; status: string; starts_at: string; expires_at: string | null; created_at: string };
type Mail = { id: string; ref_id: string; kind: string; status: string; attempts: number; last_error: string | null; sent_at: string | null; created_at: string };
const sb = supabase as any;

const DS: Record<string, [string, string, string]> = {
  sent: ["Delivered", "تم التسليم", "bg-success/15 text-success"],
  bounced: ["Bounced", "ارتدّت", "bg-destructive/10 text-destructive"],
  failed: ["Failed", "فشل", "bg-destructive/10 text-destructive"],
  queued: ["Waiting to send", "بانتظار الإرسال", "bg-warning/15 text-warning"],
  sending: ["Sending", "جارٍ الإرسال", "bg-warning/15 text-warning"],
  cancelled: ["Cancelled", "أُلغيت", "bg-muted text-muted-foreground"],
  none: ["No email", "لا رسالة", "bg-muted text-muted-foreground"],
};
const FILTERS = ["all", "sent", "bounced", "failed", "queued", "cancelled"] as const;

/** Staff: delivery status of each reviewer invitation email, with resend. */
export function InviteDeliveryPanel() {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const qc = useQueryClient();
  const [f, setF] = useState<(typeof FILTERS)[number]>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["invite-delivery"],
    queryFn: async () => {
      const [inv, mail] = await Promise.all([
        sb.from("listing_reviewers").select("id,draft_id,email,status,starts_at,expires_at,created_at").order("created_at", { ascending: false }).limit(200),
        sb.from("email_outbox").select("id,ref_id,kind,status,attempts,last_error,sent_at,created_at").in("kind", ["review_invite", "review_reminder"]).order("created_at", { ascending: false }).limit(1000),
      ]);
      if (inv.error) throw inv.error; if (mail.error) throw mail.error;
      const ids = [...new Set((inv.data as Inv[]).map((i) => i.draft_id))];
      const { data: drafts } = ids.length ? await sb.from("listing_drafts").select("id,title,title_ar").in("id", ids) : { data: [] };
      return { inv: inv.data as Inv[], mail: mail.data as Mail[], drafts: (drafts ?? []) as { id: string; title: string; title_ar: string }[] };
    },
  });
  const rows = (q.data?.inv ?? []).map((i) => {
    const all = (q.data?.mail ?? []).filter((m) => m.ref_id === i.id);
    const mails = all.filter((m) => m.kind === "review_invite");
    const reminder = all.find((m) => m.kind === "review_reminder");
    const latest = mails[0];
    const d = q.data?.drafts.find((x) => x.id === i.draft_id);
    return { i, latest, reminder, sends: mails.length, title: (ar ? d?.title_ar || d?.title : d?.title) || "—", expired: !!i.expires_at && new Date(i.expires_at) <= new Date() };
  });
  const st = (r: (typeof rows)[number]) => r.latest?.status ?? "none";
  const shown = rows.filter((r) => f === "all" || st(r) === f);

  const mask = (e: string) => { const [u = "", d = ""] = e.split("@"); return `${u.slice(0, 1)}***@${d}`; };
  const prefill = shown.slice(0, 40).map((r) => [mask(r.i.email), `email: ${st(r)}`, r.latest ? `attempts: ${r.latest.attempts}` : "", r.latest?.last_error ? `error: ${r.latest.last_error.slice(0, 300)}` : "",
    `invite: ${r.expired ? "expired" : r.i.status}`, r.sends > 1 ? `sends: ${r.sends}` : ""].filter(Boolean).join(" — ")).join("\n");

  async function resend(id: string) {
    if (busy) return; setBusy(id);
    const { error } = await sb.rpc("admin_resend_reviewer_invite", { _invite: id });
    setBusy(null);
    if (error) {
      const m = String(error.message);
      toast.error(m.includes("EXPIRED") ? L("This invitation has ended — the seller must invite them again.", "انتهت هذه الدعوة — على البائع دعوته مجددًا.")
        : m.includes("TOO_MANY") ? L("Resent too many times (10).", "أُعيد الإرسال مرات كثيرة (10).")
        : L("Couldn't resend.", "تعذّرت إعادة الإرسال."));
      return;
    }
    toast.success(L("Invitation email queued again.", "أُعيدت رسالة الدعوة إلى قائمة الإرسال."));
    void qc.invalidateQueries({ queryKey: ["invite-delivery"] });
  }

  return (
    <section aria-labelledby="idp-h" className="mt-10 space-y-3">
      <h2 id="idp-h" className="font-display text-xl">{L("Reviewer invitation emails", "رسائل دعوات المراجعين")}</h2>
      <p className="text-sm text-muted-foreground">{L("Whether each invited reviewer's email was delivered or bounced. Resending cancels any waiting copy and queues a fresh one.", "هل وصلت رسالة كل مراجع مدعو أم ارتدّت. إعادة الإرسال تلغي أي نسخة منتظرة وتضع نسخة جديدة.")}</p>
      <div className="flex flex-wrap gap-1 text-xs" role="group" aria-label={L("Filter by delivery", "تصفية حسب التسليم")}>
        {FILTERS.map((k) => (
          <button key={k} type="button" aria-pressed={f === k} onClick={() => setF(k)} className={`rounded-full border px-3 py-1 ${f === k ? "border-primary bg-primary/10" : "border-border"}`}>
            {k === "all" ? L("All", "الكل") : L(DS[k]![0], DS[k]![1])} ({k === "all" ? rows.length : rows.filter((r) => st(r) === k).length})
          </button>))}
      </div>
      {q.isLoading ? <p className="text-sm">…</p> : q.error ? <p role="alert" className="text-sm text-destructive">{L("Couldn't load invitations.", "تعذّر تحميل الدعوات.")}</p>
        : shown.length === 0 ? <p className="text-sm text-muted-foreground">{L("No invitations here yet.", "لا توجد دعوات هنا بعد.")}</p> : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-start text-xs text-muted-foreground"><tr>
              <th className="p-2 text-start">{L("Reviewer", "المراجع")}</th><th className="p-2 text-start">{L("Listing", "الإعلان")}</th>
              <th className="p-2 text-start">{L("Email", "الرسالة")}</th><th className="p-2 text-start">{L("Invitation", "الدعوة")}</th><th className="p-2" />
            </tr></thead>
            <tbody>{shown.map((r) => { const s = DS[st(r)] ?? DS["none"]!; return (
              <tr key={r.i.id} className="border-t border-border align-top">
                <td className="p-2">{r.i.email}</td>
                <td className="p-2">{r.title}</td>
                <td className="p-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${s[2]}`}>{L(s[0], s[1])}</span>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {r.latest?.sent_at ? `${L("Sent", "أُرسلت")} ${new Date(r.latest.sent_at).toLocaleString()}` : r.latest ? `${L("Added", "أُضيفت")} ${new Date(r.latest.created_at).toLocaleString()}` : ""}
                    {r.sends > 1 ? ` · ${L("sent", "أُرسلت")} ${r.sends}×` : ""}
                  </div>
                  {r.reminder && <div className="mt-1 text-xs">{L("Deadline reminder", "تذكير الموعد")}: {L(DS[r.reminder.status]?.[0] ?? r.reminder.status, DS[r.reminder.status]?.[1] ?? r.reminder.status)}</div>}
                  {r.latest?.last_error && <div className="mt-1 text-xs text-destructive">{r.latest.last_error}</div>}
                </td>
                <td className="p-2 text-xs">{r.expired ? L("Ended", "انتهت") : r.i.status === "accepted" ? L("Accepted", "مقبولة") : r.i.status === "declined" ? L("Declined", "مرفوضة") : L("Pending", "بانتظار الرد")}</td>
                <td className="p-2 text-end">
                  <button type="button" disabled={busy === r.i.id || r.expired} onClick={() => void resend(r.i.id)}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs disabled:opacity-50">
                    <RefreshCw className="h-3 w-3" aria-hidden />{L("Resend", "أعد الإرسال")}</button>
                </td>
              </tr>); })}</tbody>
          </table>
        </div>)}
      <DeliveryDiagnosis prefill={prefill} />
    </section>
  );
}
