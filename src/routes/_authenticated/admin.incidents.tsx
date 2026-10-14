import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileText, CheckSquare, Square } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line, CartesianGrid } from "recharts";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { StaffGate } from "@/components/StaffGate";
import { useLocale } from "@/lib/i18n";
import { rpc, toCsv, toPdfHtml, secureExport, fmtDate, sevClass, SEV_AR, STATUS_AR } from "@/lib/audit-admin";

export const Route = createFileRoute("/_authenticated/admin/incidents")({
  head: () => ({ meta: [
    { title: "Incidents — Arwiqa admin" }, { name: "description", content: "Security incidents, escalation, checklists and response metrics for Arwiqa staff." },
    { property: "og:title", content: "Incidents — Arwiqa admin" }, { property: "og:description", content: "Track, assign and close security incidents." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <StaffGate><Incidents /></StaffGate>,
});

type Step = { en: string; ar: string };
type Inc = { id: string; created_at: string; severity: string; kind: string; reason: string; reason_ar: string; status: string; assignee: string | null; assignee_email: string | null;
  occurrences: number; last_seen_at: string; acknowledged_at: string | null; resolved_at: string | null; closed_at: string | null; resolution: string | null; escalation_level: number;
  checklist: Step[]; done: { step: number; at: string; by: string; note: string }[]; history: { at: string; action: string; by: string | null; note: string }[] };
type Staff = { user_id: string; email: string };
type Config = { rules: { severity: string; after_minutes: number; notify: string[] }[]; checklists: Record<string, Step[]> };
const SEVS = ["critical", "high", "medium", "low"] as const;
const STATUSES = ["open", "acknowledged", "assigned", "investigating", "resolved", "closed"] as const;
const SEV_COLOR: Record<string, string> = { critical: "var(--destructive)", high: "var(--primary)", medium: "var(--accent)", low: "var(--muted-foreground)" };
const hrs = (a: string, b: string | null) => (b ? (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000 : null);
const avg = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const iso = (d: Date) => d.toISOString().slice(0, 10);

function Incidents() {
  const { locale } = useLocale(); const ar = locale === "ar";
  const L = (en: string, a: string) => (ar ? a : en);
  const qc = useQueryClient();
  const [from, setFrom] = useState(iso(new Date(Date.now() - 30 * 864e5))); const [to, setTo] = useState(iso(new Date()));
  const [staff, setStaff] = useState(""); const [sev, setSev] = useState(""); const [status, setStatus] = useState("");
  const [bucket, setBucket] = useState<"day" | "week">("day");
  const [drill, setDrill] = useState<{ from: string; to: string; severity: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const list = useQuery({ queryKey: ["incidents", from, to, staff, sev], queryFn: () => rpc<Inc[]>("admin_incidents", { _from: from || null, _to: to || null, _severity: sev, _status: "", _assignee: staff || null }) });
  const staffQ = useQuery({ queryKey: ["staff-list"], queryFn: () => rpc<Staff[]>("admin_staff_list") });
  const facets = useQuery({ queryKey: ["audit-facets"], queryFn: () => rpc<{ is_admin: boolean }>("admin_audit_facets") });
  const config = useQuery({ queryKey: ["incident-config"], queryFn: () => rpc<Config>("admin_incident_config") });
  const all = list.data ?? [];
  const err = (e: unknown) => toast.error(e instanceof Error ? e.message : String(e));
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["incidents"] }); void qc.invalidateQueries({ queryKey: ["incident-config"] }); };

  const keyOf = (d: string) => { const x = new Date(d); if (bucket === "week") { const day = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - day); } return iso(x); };
  const series = useMemo(() => {
    const m = new Map<string, Inc[]>();
    for (const i of all) { const k = keyOf(i.created_at); m.set(k, [...(m.get(k) ?? []), i]); }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, xs]) => ({
      period: k, ...Object.fromEntries(SEVS.map((s) => [s, xs.filter((x) => x.severity === s).length])),
      response: +(avg(xs.map((x) => hrs(x.created_at, x.acknowledged_at))) ?? 0).toFixed(2),
      close: +(avg(xs.map((x) => hrs(x.created_at, x.closed_at ?? x.resolved_at))) ?? 0).toFixed(2),
    }));
  }, [all, bucket]);
  const bySev = SEVS.map((s) => { const xs = all.filter((x) => x.severity === s);
    return { s, n: xs.length, resp: avg(xs.map((x) => hrs(x.created_at, x.acknowledged_at))), close: avg(xs.map((x) => hrs(x.created_at, x.closed_at ?? x.resolved_at))) }; });

  const shown = all.filter((i) => (!status || i.status === status) && (!drill || (i.severity === drill.severity || !drill.severity) && i.created_at.slice(0, 10) >= drill.from && i.created_at.slice(0, 10) <= drill.to));
  const onBar = (sevKey: string) => (d: { period?: string; payload?: { period: string } }) => {
    const p = d.payload?.period ?? d.period; if (!p) return;
    const end = bucket === "week" ? iso(new Date(new Date(p).getTime() + 6 * 864e5)) : p;
    setDrill({ from: p, to: end, severity: sevKey }); document.getElementById("incident-list")?.scrollIntoView({ behavior: "smooth" });
  };

  const act = async (i: Inc, action: string) => {
    try {
      let assignee: string | null = null; let note = "";
      if (action === "assign") { const pick = prompt(L("Assign to (staff email):", "إسناد إلى (بريد الموظف):"), staffQ.data?.[0]?.email ?? ""); const s = staffQ.data?.find((x) => x.email === pick?.trim()); if (!s) { toast.error(L("Not a staff member", "ليس من فريق العمل")); return; } assignee = s.user_id; }
      if (action === "resolve") { note = prompt(L("How was it handled? (required)", "كيف تمت المعالجة؟ (مطلوب)"))?.trim() ?? ""; if (note.length < 3) return; }
      if (!confirm(L(`Confirm: ${action} this incident? The step is logged.`, `تأكيد: ${action} لهذه الحادثة؟ ستُسجَّل الخطوة.`))) return;
      await rpc("admin_incident_action", { _id: i.id, _action: action, _assignee: assignee, _note: note }); toast.success(L("Done", "تم")); refresh();
    } catch (e) { err(e); }
  };
  const tick = async (i: Inc, step: number) => {
    if (!confirm(L("Mark this step done? It can't be undone and is logged.", "تحديد هذه الخطوة كمكتملة؟ لا يمكن التراجع وستُسجَّل."))) return;
    try { await rpc("admin_incident_check_step", { _id: i.id, _step: step, _note: "" }); refresh(); } catch (e) { err(e); }
  };

  const filterSummary = (): [string, string][] => [[L("Period", "الفترة"), `${from || "—"} → ${to || "—"}`], [L("Severity", "الخطورة"), sev || L("All", "الكل")],
    [L("Staff", "المشرف"), staffQ.data?.find((s) => s.user_id === staff)?.email ?? L("All", "الكل")], [L("Created", "وقت الإنشاء"), new Date().toISOString()]];
  const exportIncidents = async (format: "csv" | "pdf") => {
    const headers = ["Created", "Severity", "Kind", "Status", "Assignee", "Occurrences", "Acknowledged", "Resolved", "Closed", "Escalation", "Reason", "Resolution", "Checklist done", "Action history"];
    const rows = shown.map((i) => [i.created_at, i.severity, i.kind, i.status, i.assignee_email ?? "", i.occurrences, i.acknowledged_at ?? "", i.resolved_at ?? "", i.closed_at ?? "", i.escalation_level, i.reason, i.resolution ?? "",
      i.done.map((d) => `${d.step + 1}. ${d.by} ${d.at}`).join(" | "), i.history.map((h) => `${h.at} ${h.action} ${h.by ?? "system"} ${h.note}`).join(" | ")]);
    const filters = { from, to, severity: sev, staff, status, drill };
    const content = format === "csv" ? toCsv(filterSummary().map(([k]) => k).concat(), [filterSummary().map(([, v]) => v)]) + "\n\n" + toCsv(headers, rows)
      : toPdfHtml({ title: L("Arwiqa incidents", "حوادث أروقة"), ar, summary: filterSummary(), headers, rows });
    try { const r = await secureExport("incidents", format, filters, content, rows.length); r.ok ? toast.success(L("Exported", "تم التصدير")) : toast.error(r.reason); } catch (e) { err(e); }
  };
  const exportChart = async (format: "csv" | "pdf") => {
    const headers = [L("Period", "الفترة"), ...SEVS, L("Avg response (h)", "متوسط الاستجابة (س)"), L("Avg close (h)", "متوسط الإغلاق (س)")];
    const rows = series.map((r) => [r.period, ...SEVS.map((s) => (r as Record<string, unknown>)[s]), r.response, r.close]);
    const summary: [string, string][] = [...filterSummary(), [L("Grouping", "التجميع"), bucket === "day" ? L("Daily", "يومي") : L("Weekly", "أسبوعي")]];
    const content = format === "csv" ? summary.map(([k, v]) => `# ${k}: ${v}`).join("\n") + "\n" + toCsv(headers, rows) : toPdfHtml({ title: L("Incident trends", "اتجاهات الحوادث"), ar, summary, headers, rows });
    try { const r = await secureExport("chart", format, { from, to, severity: sev, staff, bucket }, content, rows.length); r.ok ? toast.success(L("Exported", "تم التصدير")) : toast.error(r.reason); } catch (e) { err(e); }
  };
  const editRule = async (r: Config["rules"][number]) => {
    const m = prompt(L(`Escalate ${r.severity} after how many minutes? (15–10080)`, `التصعيد لمستوى ${SEV_AR[r.severity]} بعد كم دقيقة؟ (15–10080)`), String(r.after_minutes)); if (!m) return;
    const emails = prompt(L("Extra staff to notify (emails, comma-separated; blank = all staff):", "مشرفون إضافيون للإشعار (بريد مفصول بفواصل، فارغ = الجميع):"), r.notify.map((u) => staffQ.data?.find((s) => s.user_id === u)?.email ?? u).join(", ")) ?? "";
    const ids = emails.split(",").map((e) => e.trim()).filter(Boolean).map((e) => staffQ.data?.find((s) => s.email === e)?.user_id);
    if (ids.some((x) => !x)) { toast.error(L("Unknown staff email", "بريد غير معروف")); return; }
    if (!confirm(L("Save this escalation rule?", "حفظ قاعدة التصعيد؟"))) return;
    try { await rpc("admin_set_escalation_rule", { _severity: r.severity, _minutes: +m, _notify: ids }); refresh(); } catch (e) { err(e); }
  };
  const editChecklist = async (kind: string, steps: Step[]) => {
    const en = prompt(L("Steps in English, one per line separated by |", "الخطوات بالإنجليزية مفصولة بـ |"), steps.map((s) => s.en).join(" | ")); if (en == null) return;
    const arT = prompt(L("Same steps in Arabic, separated by |", "الخطوات نفسها بالعربية مفصولة بـ |"), steps.map((s) => s.ar).join(" | ")); if (arT == null) return;
    const e = en.split("|").map((x) => x.trim()).filter(Boolean), a = arT.split("|").map((x) => x.trim()).filter(Boolean);
    if (e.length !== a.length) { toast.error(L("Both languages need the same number of steps", "يجب تساوي عدد الخطوات باللغتين")); return; }
    try { await rpc("admin_set_checklist", { _kind: kind, _steps: e.map((x, i) => ({ en: x, ar: a[i] })) }); refresh(); } catch (er) { err(er); }
  };

  const inp = "rounded-md border border-border bg-card px-2 py-1.5 text-sm";
  const h = (x: number | null) => (x == null ? "—" : L(`${x.toFixed(1)} h`, `${x.toFixed(1)} س`));
  const isAdmin = facets.data?.is_admin;

  return (
    <SiteShell>
      <PageTitle eyebrow={L("Administration", "إدارة النظام")} title={L("Incidents", "الحوادث")} sub={L("Repeated alerts about the same activity are grouped into one incident. Every step is recorded in the audit log.", "تُجمَّع التنبيهات المتكررة عن النشاط نفسه في حادثة واحدة، وتُسجَّل كل خطوة في سجل التدقيق.")} />
      <div className="mx-auto max-w-7xl space-y-6 px-6 pb-20">
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-card p-3">
          <label className="text-xs">{L("From", "من")}<input type="date" className={`${inp} block`} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="text-xs">{L("To", "إلى")}<input type="date" className={`${inp} block`} value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <label className="text-xs">{L("Staff", "المشرف")}<select className={`${inp} block`} value={staff} onChange={(e) => setStaff(e.target.value)}><option value="">{L("All", "الكل")}</option>{staffQ.data?.map((s) => <option key={s.user_id} value={s.user_id}>{s.email}</option>)}</select></label>
          <label className="text-xs">{L("Severity", "الخطورة")}<select className={`${inp} block`} value={sev} onChange={(e) => setSev(e.target.value)}><option value="">{L("All", "الكل")}</option>{SEVS.map((s) => <option key={s} value={s}>{ar ? SEV_AR[s] : s}</option>)}</select></label>
          <label className="text-xs">{L("Chart grouping", "تجميع المخطط")}<select className={`${inp} block`} value={bucket} onChange={(e) => setBucket(e.target.value as "day" | "week")}><option value="day">{L("Daily", "يومي")}</option><option value="week">{L("Weekly", "أسبوعي")}</option></select></label>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {bySev.map((b) => <div key={b.s} className="rounded-md border border-border bg-card p-3">
            <span className={`rounded-full px-2 py-0.5 text-xs ${sevClass[b.s]}`}>{ar ? SEV_AR[b.s] : b.s}</span>
            <p className="mt-2 text-2xl font-semibold">{b.n}</p>
            <p className="text-xs text-muted-foreground">{L("Avg response", "متوسط الاستجابة")}: {h(b.resp)} · {L("Avg close", "متوسط الإغلاق")}: {h(b.close)}</p>
          </div>)}
        </section>
        <section className="flex flex-wrap gap-2 text-sm">{STATUSES.map((s) => <span key={s} className="rounded-full border border-border px-3 py-1">{ar ? STATUS_AR[s] : s}: {all.filter((i) => i.status === s).length}</span>)}</section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-medium">{L("Incidents per period (click a bar to open)", "الحوادث لكل فترة (اضغط على عمود للفتح)")}</h2>
              <span className="flex gap-1"><button onClick={() => void exportChart("csv")} className="rounded border border-border px-2 py-0.5 text-xs">CSV</button><button onClick={() => void exportChart("pdf")} className="rounded border border-border px-2 py-0.5 text-xs">PDF</button></span></div>
            <div className="h-64" dir="ltr"><ResponsiveContainer><BarChart data={series}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Legend />
              {SEVS.map((s) => <Bar key={s} dataKey={s} name={(ar ? SEV_AR[s] : s) ?? s} stackId="a" fill={SEV_COLOR[s]} cursor="pointer" onClick={onBar(s) as never} />)}</BarChart></ResponsiveContainer></div>
          </div>
          <div className="rounded-md border border-border bg-card p-3">
            <h2 className="mb-2 text-sm font-medium">{L("Average response and close time (hours)", "متوسط زمن الاستجابة والإغلاق (ساعات)")}</h2>
            <div className="h-64" dir="ltr"><ResponsiveContainer><LineChart data={series}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Legend />
              <Line dataKey="response" name={L("Response", "الاستجابة")} stroke="var(--primary)" /><Line dataKey="close" name={L("Close", "الإغلاق")} stroke="var(--destructive)" /></LineChart></ResponsiveContainer></div>
          </div>
        </section>

        <section id="incident-list" className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-medium">{L("Incident list", "قائمة الحوادث")}</h2>
            {drill && <button onClick={() => setDrill(null)} className="rounded-full bg-primary/10 px-3 py-1 text-xs">{drill.from} → {drill.to} · {ar ? SEV_AR[drill.severity] : drill.severity} ✕</button>}
            <select aria-label={L("Status", "الحالة")} className={inp} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">{L("All statuses", "كل الحالات")}</option>{STATUSES.map((s) => <option key={s} value={s}>{ar ? STATUS_AR[s] : s}</option>)}</select>
            <span className="ms-auto" />
            <button onClick={() => void exportIncidents("csv")} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm"><Download className="h-4 w-4" />CSV</button>
            <button onClick={() => void exportIncidents("pdf")} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm"><FileText className="h-4 w-4" />PDF</button>
          </div>
          {list.isLoading ? <p className="text-muted-foreground">{L("Loading…", "جارٍ التحميل…")}</p> : shown.length === 0 ? <p className="text-muted-foreground">{L("No incidents match.", "لا توجد حوادث مطابقة.")}</p> : shown.map((i) => (
            <article key={i.id} className="rounded-md border border-border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs ${sevClass[i.severity]}`}>{ar ? SEV_AR[i.severity] : i.severity}</span>
                <span className="rounded-full border border-border px-2 py-0.5 text-xs">{ar ? STATUS_AR[i.status] : i.status}</span>
                {i.occurrences > 1 && <span className="text-xs text-muted-foreground">×{i.occurrences}</span>}
                {i.escalation_level > 0 && <span className="text-xs text-destructive">{L(`escalated L${i.escalation_level}`, `مُصعَّدة م${i.escalation_level}`)}</span>}
                <p className="flex-1 text-sm">{ar ? i.reason_ar : i.reason}</p>
                <span className="text-xs text-muted-foreground">{fmtDate(i.created_at, ar)}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {!i.acknowledged_at && i.status !== "closed" && <button onClick={() => void act(i, "acknowledge")} className="rounded border border-border px-2 py-1">{L("Acknowledge", "تأكيد الاستلام")}</button>}
                {!["resolved", "closed"].includes(i.status) && <><button onClick={() => void act(i, "assign")} className="rounded border border-border px-2 py-1">{L("Assign", "إسناد")}</button>
                  <button onClick={() => void act(i, "investigate")} className="rounded border border-border px-2 py-1">{L("Start handling", "بدء المعالجة")}</button>
                  <button onClick={() => void act(i, "resolve")} className="rounded border border-border px-2 py-1">{L("Resolve", "تمت المعالجة")}</button></>}
                {i.status === "resolved" && <button onClick={() => void act(i, "close")} className="rounded bg-primary px-2 py-1 text-primary-foreground">{L("Close", "إغلاق")}</button>}
                <span className="text-muted-foreground">{L("Assignee", "المسؤول")}: {i.assignee_email ?? "—"}</span>
                <button onClick={() => setOpen(open === i.id ? null : i.id)} className="ms-auto underline">{open === i.id ? L("Hide", "إخفاء") : L("Checklist & history", "القائمة والسجل")}</button>
              </div>
              {open === i.id && <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div><p className="mb-1 text-xs font-medium">{L("Checklist", "قائمة التحقق")}</p>
                  <ul className="space-y-1 text-sm">{i.checklist.map((s, n) => { const d = i.done.find((x) => x.step === n); return <li key={n}>
                    <button disabled={!!d || i.status === "closed"} onClick={() => void tick(i, n)} className="inline-flex items-start gap-2 text-start">{d ? <CheckSquare className="h-4 w-4 shrink-0 text-primary" /> : <Square className="h-4 w-4 shrink-0" />}<span>{ar ? s.ar : s.en}{d && <span className="block text-xs text-muted-foreground">{d.by} · {fmtDate(d.at, ar)}</span>}</span></button></li>; })}</ul>
                  {i.resolution && <p className="mt-2 text-xs">{L("Resolution", "المعالجة")}: {i.resolution}</p>}</div>
                <div><p className="mb-1 text-xs font-medium">{L("Action history", "سجل الإجراءات")}</p>
                  <ol className="max-h-56 space-y-1 overflow-auto text-xs">{i.history.map((x, n) => <li key={n}><span className="text-muted-foreground">{fmtDate(x.at, ar)}</span> · {x.action} · {x.by ?? L("system", "النظام")}{x.note && ` — ${x.note}`}</li>)}</ol></div>
              </div>}
            </article>))}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-border bg-card p-4">
            <h2 className="font-medium">{L("Escalation rules", "قواعد التصعيد")}</h2>
            <p className="text-xs text-muted-foreground">{L("If an incident isn't handled in time, it escalates (up to 3 levels) and the listed staff are notified. Checked hourly.", "إذا لم تُعالج الحادثة في الوقت المحدد تُصعَّد (حتى 3 مستويات) ويُشعَر المشرفون المحددون. يُفحص كل ساعة.")}</p>
            <ul className="mt-2 space-y-1 text-sm">{config.data?.rules.map((r) => <li key={r.severity} className="flex items-center justify-between"><span>{ar ? SEV_AR[r.severity] : r.severity}: {L(`${r.after_minutes} min`, `${r.after_minutes} دقيقة`)} · {r.notify.length ? r.notify.map((u) => staffQ.data?.find((s) => s.user_id === u)?.email ?? u).join(", ") : L("all staff", "كل الفريق")}</span>
              {isAdmin && <button onClick={() => void editRule(r)} className="text-xs underline">{L("Edit", "تعديل")}</button>}</li>)}</ul>
          </div>
          <div className="rounded-md border border-border bg-card p-4">
            <h2 className="font-medium">{L("Checklists per incident type", "قوائم التحقق لكل نوع حادثة")}</h2>
            <ul className="mt-2 space-y-2 text-sm">{Object.entries(config.data?.checklists ?? {}).map(([k, st]) => <li key={k}><div className="flex items-center justify-between"><span className="font-medium">{k}</span>{isAdmin && <button onClick={() => void editChecklist(k, st)} className="text-xs underline">{L("Edit", "تعديل")}</button>}</div>
              <ol className="list-decimal ps-5 text-xs text-muted-foreground">{st.map((s, n) => <li key={n}>{ar ? s.ar : s.en}</li>)}</ol></li>)}</ul>
          </div>
        </section>
      </div>
    </SiteShell>
  );
}
