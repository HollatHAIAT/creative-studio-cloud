import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, RefreshCw } from "lucide-react";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { StaffGate } from "@/components/StaffGate";
import { useLocale } from "@/lib/i18n";
import { rpc, downloadExport, fmtDate } from "@/lib/audit-admin";

export const Route = createFileRoute("/_authenticated/admin/exports")({
  head: () => ({ meta: [
    { title: "Exports — Arwiqa admin" }, { name: "description", content: "Watermarked, expiring exports with download and alert delivery tracking." },
    { property: "og:title", content: "Exports — Arwiqa admin" }, { property: "og:description", content: "Track every export, download and expiry alert." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <StaffGate><Exports /></StaffGate>,
});

type Exp = { id: string; created_at: string; created_by_email: string | null; kind: string; format: string; filters: Record<string, unknown>; row_count: number; expires_at: string; expired: boolean;
  downloads: { at: string; by: string | null; allowed: boolean; reason: string }[] };
type Del = { id: number; export_id: string; export_kind: string; export_format: string; expires_at: string; recipient: string; recipient_email: string | null; channel: string; status: string;
  attempts: number; last_error: string | null; sent_at: string | null; created_at: string; history: { at: string; ok: boolean; error: string | null; manual: boolean; by: string | null }[] };
type Staff = { user_id: string; email: string };
type Settings = { expiry_hours: number; alert_lead_hours: number; recipients: string[] };

function Exports() {
  const { locale } = useLocale(); const ar = locale === "ar";
  const L = (en: string, a: string) => (ar ? a : en);
  const qc = useQueryClient();
  const [df, setDf] = useState({ status: "", recipient: "", from: "", to: "" });
  const [open, setOpen] = useState<string | null>(null); const [openD, setOpenD] = useState<number | null>(null);
  const exps = useQuery({ queryKey: ["exports"], queryFn: () => rpc<Exp[]>("admin_exports_list") });
  const dels = useQuery({ queryKey: ["deliveries", df], queryFn: () => rpc<Del[]>("admin_alert_deliveries", { _status: df.status, _recipient: df.recipient || null, _from: df.from || null, _to: df.to || null }) });
  const staffQ = useQuery({ queryKey: ["staff-list"], queryFn: () => rpc<Staff[]>("admin_staff_list") });
  const cfg = useQuery({ queryKey: ["incident-config"], queryFn: () => rpc<{ export: Settings }>("admin_incident_config") });
  const facets = useQuery({ queryKey: ["audit-facets"], queryFn: () => rpc<{ is_admin: boolean }>("admin_audit_facets") });
  const err = (e: unknown) => toast.error(e instanceof Error ? e.message : String(e));
  const s = cfg.data?.export;
  const [form, setForm] = useState<Settings | null>(null);
  const cur = form ?? s;

  const dl = async (x: Exp) => { try { const r = await downloadExport(x.id); r.ok ? toast.success(L("Download logged", "تم تسجيل التنزيل")) : toast.error(r.reason === "EXPIRED" ? L("Expired — download blocked and logged", "منتهي الصلاحية — حُظر التنزيل وسُجّل") : r.reason); void qc.invalidateQueries({ queryKey: ["exports"] }); } catch (e) { err(e); } };
  const resend = async (d: Del) => {
    if (!confirm(L("Resend this alert now? The attempt is logged.", "إعادة إرسال هذا التنبيه الآن؟ ستُسجَّل المحاولة."))) return;
    try { const ok = await rpc<boolean>("admin_resend_alert_delivery", { _id: d.id }); ok ? toast.success(L("Sent", "تم الإرسال")) : toast.error(L("Failed — see attempt details", "فشل — راجع تفاصيل المحاولة")); void qc.invalidateQueries({ queryKey: ["deliveries"] }); } catch (e) { err(e); }
  };
  const save = async () => {
    if (!cur) return;
    if (!confirm(L("Save export settings?", "حفظ إعدادات التصدير؟"))) return;
    try { await rpc("admin_set_export_settings", { _expiry: cur.expiry_hours, _lead: cur.alert_lead_hours, _recipients: cur.recipients }); toast.success(L("Saved", "تم الحفظ")); setForm(null); void qc.invalidateQueries({ queryKey: ["incident-config"] }); } catch (e) { err(e); }
  };
  const inp = "rounded-md border border-border bg-card px-2 py-1.5 text-sm";
  const ST_AR: Record<string, string> = { pending: "قيد الانتظار", sent: "أُرسل", failed: "فشل", gave_up: "توقفت المحاولات" };

  return (
    <SiteShell>
      <PageTitle eyebrow={L("Administration", "إدارة النظام")} title={L("Exports", "الملفات المصدّرة")} sub={L("Each export is watermarked and expires. Every download is recorded, and downloads after expiry are blocked.", "كل ملف مصدَّر يحمل علامة مائية وله مدة صلاحية، ويُسجَّل كل تنزيل، ويُحظر التنزيل بعد انتهاء الصلاحية.")} />
      <div className="mx-auto max-w-7xl space-y-8 px-6 pb-20">
        {cur && <section className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-card p-4">
          <label className="text-xs">{L("Files expire after (hours)", "تنتهي صلاحية الملفات بعد (ساعات)")}<input type="number" min={1} max={720} disabled={!facets.data?.is_admin} className={`${inp} block w-28`} value={cur.expiry_hours} onChange={(e) => setForm({ ...cur, expiry_hours: +e.target.value })} /></label>
          <label className="text-xs">{L("Alert before expiry (hours)", "التنبيه قبل الانتهاء (ساعات)")}<input type="number" min={1} max={168} disabled={!facets.data?.is_admin} className={`${inp} block w-28`} value={cur.alert_lead_hours} onChange={(e) => setForm({ ...cur, alert_lead_hours: +e.target.value })} /></label>
          <fieldset className="text-xs"><legend>{L("Alert recipients (none = the person who exported)", "مستلمو التنبيه (لا أحد = من قام بالتصدير)")}</legend>
            <div className="mt-1 flex flex-wrap gap-2">{staffQ.data?.map((st) => <label key={st.user_id} className="flex items-center gap-1"><input type="checkbox" disabled={!facets.data?.is_admin} checked={cur.recipients.includes(st.user_id)}
              onChange={(e) => setForm({ ...cur, recipients: e.target.checked ? [...cur.recipients, st.user_id] : cur.recipients.filter((x) => x !== st.user_id) })} />{st.email}</label>)}</div></fieldset>
          {facets.data?.is_admin && <button disabled={!form} onClick={() => void save()} className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-40">{L("Save", "حفظ")}</button>}
        </section>}

        <section>
          <h2 className="mb-2 font-medium">{L("Export log", "سجل التصدير")}</h2>
          <div className="overflow-x-auto rounded-md border border-border bg-card"><table className="w-full text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground"><tr><th className="p-2 text-start">{L("Created", "الإنشاء")}</th><th className="p-2 text-start">{L("By", "بواسطة")}</th><th className="p-2 text-start">{L("Type", "النوع")}</th><th className="p-2 text-start">{L("Rows", "السجلات")}</th><th className="p-2 text-start">{L("Expires", "الانتهاء")}</th><th className="p-2 text-start">{L("Downloads", "التنزيلات")}</th><th className="p-2" /></tr></thead>
            <tbody>{(exps.data ?? []).map((x) => <Fragment key={x.id}>
              <tr className="border-b border-border">
                <td className="p-2">{fmtDate(x.created_at, ar)}</td><td className="p-2">{x.created_by_email}</td><td className="p-2">{x.kind} · {x.format.toUpperCase()}</td><td className="p-2">{x.row_count}</td>
                <td className={`p-2 ${x.expired ? "text-destructive" : ""}`}>{x.expired ? L("Expired — link blocked", "منتهي — الرابط محظور") : fmtDate(x.expires_at, ar)}</td>
                <td className="p-2">{x.downloads.filter((d) => d.allowed).length}{x.downloads.some((d) => !d.allowed) && <span className="ms-1 text-xs text-destructive">({x.downloads.filter((d) => !d.allowed).length} {L("blocked", "محظور")})</span>}</td>
                <td className="p-2 text-end whitespace-nowrap"><button onClick={() => setOpen(open === x.id ? null : x.id)} className="text-xs underline">{L("Details", "التفاصيل")}</button>
                  <button disabled={x.expired} onClick={() => void dl(x)} className="ms-2 inline-flex items-center gap-1 text-xs underline disabled:opacity-40"><Download className="h-3 w-3" />{L("Download", "تنزيل")}</button></td>
              </tr>
              {open === x.id && <tr className="border-b border-border bg-muted/30"><td colSpan={7} className="p-3 text-xs">
                <p>{L("Filters", "الفلاتر")}: <code dir="ltr">{JSON.stringify(x.filters)}</code></p>
                <p className="mt-1 font-medium">{L("Download history", "سجل التنزيل")}</p>
                {x.downloads.length === 0 ? <p className="text-muted-foreground">—</p> : <ul>{x.downloads.map((d, n) => <li key={n} className={d.allowed ? "" : "text-destructive"}>{fmtDate(d.at, ar)} · {d.by} · {d.allowed ? L("downloaded", "تم التنزيل") : L(`blocked (${d.reason})`, `محظور (${d.reason})`)}</li>)}</ul>}
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">{x.id}</p>
              </td></tr>}
            </Fragment>)}</tbody></table></div>
        </section>

        <section>
          <h2 className="mb-2 font-medium">{L("Expiry alert deliveries", "سجل تسليم تنبيهات انتهاء الصلاحية")}</h2>
          <div className="mb-2 flex flex-wrap items-end gap-2">
            <label className="text-xs">{L("Status", "الحالة")}<select className={`${inp} block`} value={df.status} onChange={(e) => setDf({ ...df, status: e.target.value })}><option value="">{L("All", "الكل")}</option>{["pending", "sent", "failed", "gave_up"].map((x) => <option key={x} value={x}>{ar ? ST_AR[x] : x}</option>)}</select></label>
            <label className="text-xs">{L("Staff", "المشرف")}<select className={`${inp} block`} value={df.recipient} onChange={(e) => setDf({ ...df, recipient: e.target.value })}><option value="">{L("All", "الكل")}</option>{staffQ.data?.map((st) => <option key={st.user_id} value={st.user_id}>{st.email}</option>)}</select></label>
            <label className="text-xs">{L("From", "من")}<input type="date" className={`${inp} block`} value={df.from} onChange={(e) => setDf({ ...df, from: e.target.value })} /></label>
            <label className="text-xs">{L("To", "إلى")}<input type="date" className={`${inp} block`} value={df.to} onChange={(e) => setDf({ ...df, to: e.target.value })} /></label>
          </div>
          {(dels.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">{L("No deliveries match.", "لا توجد عمليات تسليم مطابقة.")}</p> :
          <div className="overflow-x-auto rounded-md border border-border bg-card"><table className="w-full text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground"><tr><th className="p-2 text-start">{L("Queued", "الإدراج")}</th><th className="p-2 text-start">{L("To", "إلى")}</th><th className="p-2 text-start">{L("Channel", "القناة")}</th><th className="p-2 text-start">{L("Status", "الحالة")}</th><th className="p-2 text-start">{L("Attempts", "المحاولات")}</th><th className="p-2" /></tr></thead>
            <tbody>{dels.data!.map((d) => <Fragment key={d.id}>
              <tr className="border-b border-border"><td className="p-2">{fmtDate(d.created_at, ar)}</td><td className="p-2">{d.recipient_email}</td><td className="p-2">{d.channel === "email" ? L("Email", "البريد") : L("In-app", "داخل المنصة")}</td>
                <td className={`p-2 ${d.status === "sent" ? "" : "text-destructive"}`}>{ar ? ST_AR[d.status] : d.status}{d.last_error && <span className="block text-xs">{d.last_error}</span>}</td><td className="p-2">{d.attempts}</td>
                <td className="p-2 text-end whitespace-nowrap"><button onClick={() => setOpenD(openD === d.id ? null : d.id)} className="text-xs underline">{L("Attempts", "المحاولات")}</button>
                  <button onClick={() => void resend(d)} className="ms-2 inline-flex items-center gap-1 text-xs underline"><RefreshCw className="h-3 w-3" />{L("Resend", "إعادة الإرسال")}</button></td></tr>
              {openD === d.id && <tr className="border-b border-border bg-muted/30"><td colSpan={6} className="p-3 text-xs">
                <p>{L("Export", "الملف")}: {d.export_kind} · {d.export_format.toUpperCase()} · {L("expires", "ينتهي")} {fmtDate(d.expires_at, ar)}</p>
                <ul className="mt-1">{d.history.length === 0 ? <li className="text-muted-foreground">—</li> : d.history.map((h, n) => <li key={n} className={h.ok ? "" : "text-destructive"}>{fmtDate(h.at, ar)} · {h.ok ? L("delivered", "تم التسليم") : L("failed", "فشل")}{h.error && ` — ${h.error}`} · {h.manual ? L(`manual by ${h.by}`, `يدوي بواسطة ${h.by}`) : L("automatic", "تلقائي")}</li>)}</ul>
              </td></tr>}
            </Fragment>)}</tbody></table></div>}
        </section>
      </div>
    </SiteShell>
  );
}
