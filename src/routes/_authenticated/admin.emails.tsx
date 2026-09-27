import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCw, X } from "lucide-react";
import { toast } from "sonner";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";
import { useStaff } from "@/lib/useStaff";
import { fmtDateTime } from "@/lib/orders";

export const Route = createFileRoute("/_authenticated/admin/emails")({
  head: () => ({
    meta: [
      { title: "Email delivery — Arwiqa staff" },
      { name: "description", content: "Delivery status of order and shipment emails, with retry for failed sends." },
      { property: "og:title", content: "Email delivery — Arwiqa staff" },
      { property: "og:description", content: "Staff view of queued, sent and failed emails." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminEmails,
});

type Email = { id: string; kind: string; subject: string; subject_ar: string; status: string; attempts: number; last_error: string | null; last_attempt_at: string | null; sent_at: string | null; created_at: string; link: string | null };
const STATUSES = ["all", "queued", "sending", "sent", "failed", "cancelled"] as const;
const KINDS = ["order_shipping", "order", "refund", "shipping", "all"] as const;
const S_AR: Record<string, string> = { all: "الكل", queued: "في الانتظار", sending: "قيد الإرسال", sent: "أُرسل", failed: "فشل", cancelled: "ملغى" };
const K_LABEL: Record<string, [string, string]> = { order_shipping: ["Orders & shipments", "الطلبات والشحنات"], order: ["Orders", "الطلبات"], refund: ["Refunds", "الاسترداد"], shipping: ["Shipments", "الشحنات"], all: ["All emails", "كل الرسائل"] };
const tone: Record<string, string> = { sent: "text-success", failed: "text-destructive", queued: "text-warning", sending: "text-info", cancelled: "text-muted-foreground" };

function AdminEmails() {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const L = (en: string, a: string) => (ar ? a : en);
  const staff = useStaff();
  const qc = useQueryClient();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("order_shipping");
  const [busy, setBusy] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-emails", status, kind],
    enabled: !!staff.isStaff,
    queryFn: async () => {
      let r = (supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }).from("email_outbox").select("*").order("created_at", { ascending: false }).limit(200);
      if (status !== "all") r = r.eq("status", status);
      if (kind === "order_shipping") r = r.in("kind", ["order", "refund", "shipping"]);
      else if (kind !== "all") r = r.eq("kind", kind);
      const { data, error } = await r;
      if (error) throw error;
      return (data ?? []) as unknown as Email[];
    },
  });

  const act = async (fn: "admin_retry_email" | "admin_cancel_email", e: Email) => {
    setBusy(e.id);
    const { error } = await (supabase.rpc as unknown as (f: string, a: object) => Promise<{ error: { message: string } | null }>)(fn, { _id: e.id });
    setBusy(null);
    if (error) {
      const m = error.message;
      toast.error(m.includes("TOO_MANY") ? L("Retry limit reached (10 attempts).", "تم بلوغ حد المحاولات (١٠).") : m.includes("NOT_RETRYABLE") || m.includes("NOT_CANCELLABLE") ? L("This email's status changed — refreshing.", "تغيّرت حالة الرسالة — جارٍ التحديث.") : L("Action failed.", "تعذّر تنفيذ الإجراء."));
    } else toast.success(fn === "admin_retry_email" ? L("Email re-queued for sending.", "أُعيدت الرسالة إلى قائمة الإرسال.") : L("Email cancelled.", "أُلغيت الرسالة."));
    void qc.invalidateQueries({ queryKey: ["admin-emails"] });
  };

  if (staff.loading) return <SiteShell><p className="p-10 text-muted-foreground">{L("Loading…", "جارٍ التحميل…")}</p></SiteShell>;
  if (!staff.isStaff) return <SiteShell><p className="p-10">{L("Staff only.", "للموظفين فقط.")}</p></SiteShell>;

  const rows = q.data ?? [];
  const counts = rows.reduce<Record<string, number>>((m, e) => ((m[e.status] = (m[e.status] ?? 0) + 1), m), {});

  return (
    <SiteShell>
      <PageTitle eyebrow={L("Staff", "الموظفون")} title={L("Email delivery", "حالة إرسال البريد")}
        sub={L("Order and shipment emails waiting, sent or failed. Retry a failed send to put it back in the queue.", "رسائل الطلبات والشحن في الانتظار أو المُرسلة أو الفاشلة. أعد المحاولة لإرجاع الرسالة الفاشلة إلى القائمة.")} />
      <div className="mx-auto max-w-6xl space-y-6 px-6 pb-20">
        <div className="flex flex-wrap gap-6 text-sm">
          {["queued", "sent", "failed"].map((s) => <div key={s}><span className={`font-display text-3xl ${tone[s]}`}>{counts[s] ?? 0}</span> <span className="text-muted-foreground">{ar ? S_AR[s] : s}</span></div>)}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label={L("Status", "الحالة")} className="flex flex-wrap gap-2">
            {STATUSES.map((s) => <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)}
              className={`rounded-full border px-3 py-1 text-sm ${status === s ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{ar ? S_AR[s] : s[0]!.toUpperCase() + s.slice(1)}</button>)}
          </div>
          <select aria-label={L("Email type", "نوع الرسالة")} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="rounded-md border border-border bg-card px-3 py-1.5 text-sm">
            {KINDS.map((k) => <option key={k} value={k}>{ar ? K_LABEL[k]![1] : K_LABEL[k]![0]}</option>)}
          </select>
          <button type="button" onClick={() => void q.refetch()} className="ms-auto text-sm underline">{L("Refresh", "تحديث")}</button>
        </div>

        {q.isLoading ? <p className="text-muted-foreground">{L("Loading…", "جارٍ التحميل…")}</p>
          : q.isError ? <p className="text-destructive">{L("Couldn't load emails.", "تعذّر تحميل الرسائل.")}</p>
          : !rows.length ? <p className="text-muted-foreground">{L("No emails match these filters.", "لا توجد رسائل تطابق الفلاتر.")}</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-start text-xs uppercase tracking-wider text-muted-foreground">
                  <tr><th className="py-2 text-start">{L("Email", "الرسالة")}</th><th className="text-start">{L("Status", "الحالة")}</th><th className="text-start">{L("Attempts", "المحاولات")}</th><th className="text-start">{L("Queued", "أُضيفت")}</th><th className="text-start">{L("Last update", "آخر تحديث")}</th><th /></tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id} className="border-b border-border align-top">
                      <td className="py-3 pe-4">
                        <div className="font-medium">{ar ? e.subject_ar : e.subject}</div>
                        <div className="text-xs text-muted-foreground">{ar ? K_LABEL[e.kind]?.[1] ?? e.kind : K_LABEL[e.kind]?.[0] ?? e.kind}
                          {e.link?.startsWith("/orders/") && <> · <Link to="/orders/$id" params={{ id: e.link.slice(8) }} className="underline">{L("Order", "الطلب")}</Link></>}</div>
                        {e.last_error && <div className="mt-1 text-xs text-destructive">{e.last_error}</div>}
                      </td>
                      <td className={`pe-4 ${tone[e.status] ?? ""}`}>{ar ? S_AR[e.status] ?? e.status : e.status}</td>
                      <td className="pe-4 tabular-nums">{e.attempts}</td>
                      <td className="pe-4 whitespace-nowrap">{fmtDateTime(e.created_at, locale)}</td>
                      <td className="pe-4 whitespace-nowrap">{e.sent_at ? fmtDateTime(e.sent_at, locale) : e.last_attempt_at ? fmtDateTime(e.last_attempt_at, locale) : "—"}</td>
                      <td className="whitespace-nowrap text-end">
                        {(e.status === "failed" || e.status === "cancelled") && (
                          <button type="button" disabled={busy === e.id} onClick={() => void act("admin_retry_email", e)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 disabled:opacity-50">
                            <RotateCw aria-hidden className="h-3.5 w-3.5" />{L("Retry", "إعادة المحاولة")}</button>)}
                        {(e.status === "queued" || e.status === "failed") && (
                          <button type="button" disabled={busy === e.id} onClick={() => void act("admin_cancel_email", e)} aria-label={L("Cancel email", "إلغاء الرسالة")} className="ms-2 inline-flex rounded-md border border-border p-1 text-muted-foreground disabled:opacity-50"><X aria-hidden className="h-3.5 w-3.5" /></button>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        <p className="text-xs text-muted-foreground">{L("No sender domain is set up yet, so emails stay queued until one is configured.", "لم يُضبط نطاق مرسل بعد، لذا تبقى الرسائل في الانتظار حتى يتم ضبطه.")}</p>
      </div>
    </SiteShell>
  );
}
