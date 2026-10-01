import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, Download, Undo2, ChevronDown, ChevronUp, Lock, FileText } from "lucide-react";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { StaffGate } from "@/components/StaffGate";
import { useLocale } from "@/lib/i18n";
import { rpc, toCsv, toPdfHtml, secureExport, fmtDate } from "@/lib/audit-admin";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({ meta: [
    { title: "Audit log — Arwiqa admin" }, { name: "description", content: "Tamper-evident log of role, content and order changes on Arwiqa." },
    { property: "og:title", content: "Audit log — Arwiqa admin" }, { property: "og:description", content: "Who changed what, when, with before and after values." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <StaffGate><Audit /></StaffGate>,
});

type Ev = { id: string; seq: number; created_at: string; actor_email: string | null; category: string; action: string; target_type: string; target_id: string;
  before: unknown; after: unknown; note: string; revert_of: string | null; reverted_by: string | null; archived: boolean; total: number };
type Facets = { actors: string[]; actions: string[]; retention: Record<string, number>; holds: { id: string; reason: string; category: string | null; created_at: string }[]; is_admin: boolean };
type Preview = { can_undo: boolean; reason: string | null; current: unknown; restore_to: unknown; changed_to: unknown; newer_event?: string };
type Report = { id: string; ran_at: string; trigger: string; first_seq: number | null; last_seq: number | null; checked: number; ok: boolean; gaps: unknown[]; failures: { seq: number; problem: string }[] };

const CATS = ["role", "content", "order", "alert", "security", "settings"] as const;
const CAT_AR: Record<string, string> = { role: "الصلاحيات", content: "المحتوى", order: "الطلبات", alert: "التنبيهات", security: "الأمان", settings: "الإعدادات" };
const PER = 100;

function Audit() {
  const { locale } = useLocale(); const ar = locale === "ar";
  const L = (en: string, a: string) => (ar ? a : en);
  const qc = useQueryClient();
  const [f, setF] = useState({ from: "", to: "", actor: "", category: "", action: "", q: "", archived: "active" });
  const [applied, setApplied] = useState(f); const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ ev: Ev; p: Preview } | null>(null);
  const [days, setDays] = useState(7);

  const args = (a: typeof f, limit: number, offset: number) => ({ _from: a.from || null, _to: a.to || null, _actor: a.actor, _category: a.category, _action: a.action, _q: a.q, _archived: a.archived, _limit: limit, _offset: offset });
  const events = useQuery({ queryKey: ["audit", applied, page], queryFn: () => rpc<Ev[]>("admin_audit_search", args(applied, PER, page * PER)) });
  const facets = useQuery({ queryKey: ["audit-facets"], queryFn: () => rpc<Facets>("admin_audit_facets") });
  const summary = useQuery({ queryKey: ["audit-summary", days], queryFn: () => rpc<{ total: number; sensitive: number; undone: number; alerts_open: number; by_category: Record<string, number>; top_actors: { actor: string; count: number }[] }>("admin_activity_summary", { _days: days }) });
  const reports = useQuery({ queryKey: ["audit-reports"], queryFn: () => rpc<Report[]>("admin_audit_reports", { _limit: 10 }) });
  const rows = events.data ?? []; const total = rows[0]?.total ?? 0;
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["audit"] }); void qc.invalidateQueries({ queryKey: ["audit-facets"] }); void qc.invalidateQueries({ queryKey: ["audit-reports"] }); };
  const err = (e: unknown) => toast.error(e instanceof Error ? e.message : String(e));

  const doExport = async (format: "csv" | "pdf") => {
    try {
      const all = await rpc<Ev[]>("admin_audit_search", args(applied, 5000, 0));
      const headers = ["#", "Time (UTC)", "Actor", "Category", "Action", "Target", "Before", "After", "Note", "Undo of"];
      const data = all.map((e) => [e.seq, e.created_at, e.actor_email ?? "", e.category, e.action, `${e.target_type}:${e.target_id}`, e.before, e.after, e.note, e.revert_of ?? ""]);
      const filt = Object.fromEntries(Object.entries(applied).filter(([, v]) => v));
      const content = format === "csv" ? toCsv(headers, data) : toPdfHtml({ title: L("Arwiqa audit log", "سجل تدقيق أروقة"), ar, headers, rows: data,
        summary: [[L("Filters", "الفلاتر"), JSON.stringify(filt)], [L("Events", "الأحداث"), String(all.length)], [L("Created", "وقت الإنشاء"), new Date().toISOString()]] });
      const r = await secureExport("audit", format, filt, content, all.length);
      if (!r.ok) toast.error(r.reason); else toast.success(L(`Exported ${all.length} events`, `تم تصدير ${all.length} حدث`));
    } catch (e) { err(e); }
  };
  const openUndo = async (ev: Ev) => { try { setPreview({ ev, p: await rpc<Preview>("admin_audit_undo_preview", { _id: ev.id }) }); } catch (e) { err(e); } };
  const applyUndo = async () => {
    if (!preview) return;
    if (!confirm(L("Apply this undo? It will be recorded in the audit log.", "تطبيق هذا التراجع؟ سيُسجَّل في سجل التدقيق."))) return;
    try {
      const res = await rpc<string | null>("admin_audit_undo", { _id: preview.ev.id, _note: "" });
      if (res) toast.success(L("Change undone", "تم التراجع عن التغيير")); else toast.error(L("Undo refused — a newer change exists. The attempt was logged.", "رُفض التراجع لوجود تعديل أحدث. سُجّلت المحاولة."));
      setPreview(null); refresh();
    } catch (e) { err(e); }
  };
  const verify = async () => {
    try { const r = await rpc<{ ok: boolean; checked: number; failures: unknown[]; gaps: unknown[] }>("admin_audit_verify");
      r.ok ? toast.success(L(`Chain intact — ${r.checked} events verified`, `السلسلة سليمة — تم التحقق من ${r.checked} حدث`)) : toast.error(L(`${r.failures.length} tampered events found`, `اكتُشف عبث في ${r.failures.length} حدث`));
      refresh();
    } catch (e) { err(e); }
  };
  const setRetention = async (cat: string, cur: number) => {
    const v = prompt(L(`Retention for ${cat} (days, 30–36500):`, `مدة الاحتفاظ لـ ${CAT_AR[cat] ?? cat} (بالأيام 30–36500):`), String(cur)); if (!v) return;
    const n = parseInt(v, 10); if (!(n >= 30 && n <= 36500)) return toast.error(L("Invalid number", "رقم غير صالح"));
    if (!confirm(L(`Change ${cat} retention from ${cur} to ${n} days?`, `تغيير مدة الاحتفاظ من ${cur} إلى ${n} يوم؟`))) return;
    try { await rpc("admin_set_retention", { _category: cat, _days: n }); toast.success(L("Saved", "تم الحفظ")); refresh(); } catch (e) { err(e); }
  };
  const hold = async (release?: string) => {
    try {
      if (release) { if (!confirm(L("Release this hold? Archiving resumes.", "رفع هذا الحجز؟ ستُستأنف الأرشفة."))) return; await rpc("admin_audit_hold", { _reason: "released", _category: "", _release: release }); }
      else { const reason = prompt(L("Reason for the review/compliance hold:", "سبب حجز المراجعة/الامتثال:"))?.trim(); if (!reason) return;
        const cat = prompt(L("Category (blank = all):", "الفئة (اتركها فارغة للكل):"), "")?.trim() ?? ""; await rpc("admin_audit_hold", { _reason: reason, _category: cat, _release: null }); }
      toast.success(L("Saved", "تم الحفظ")); refresh();
    } catch (e) { err(e); }
  };

  const inp = "rounded-md border border-border bg-card px-2 py-1.5 text-sm";
  const J = ({ v }: { v: unknown }) => <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-xs" dir="ltr">{v == null ? "—" : JSON.stringify(v, null, 2)}</pre>;
  const fa = facets.data;

  return (
    <SiteShell>
      <PageTitle eyebrow={L("Administration", "إدارة النظام")} title={L("Audit log", "سجل التدقيق")}
        sub={L("Every role, content and order change with who, when and the values before and after. Events can't be edited or deleted; each is chained to the previous one.", "كل تغيير في الصلاحيات والمحتوى والطلبات مع المنفّذ والتوقيت والقيم قبل وبعد. لا يمكن تعديل الأحداث أو حذفها، وكل حدث مرتبط بما قبله.")} />
      <div className="mx-auto max-w-7xl space-y-6 px-6 pb-20">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-md border border-border bg-card p-3 lg:col-span-1">
            <label className="text-xs text-muted-foreground">{L("Summary period", "فترة الملخص")}
              <select className={`${inp} mt-1 w-full`} value={days} onChange={(e) => setDays(+e.target.value)}>{[1, 7, 30, 90].map((d) => <option key={d} value={d}>{L(`${d} days`, `${d} يوم`)}</option>)}</select></label>
          </div>
          {[[L("Actions", "الإجراءات"), summary.data?.total], [L("Sensitive", "حساسة"), summary.data?.sensitive], [L("Undone", "تم التراجع"), summary.data?.undone], [L("Open incidents", "حوادث مفتوحة"), summary.data?.alerts_open]].map(([k, v]) => (
            <div key={String(k)} className="rounded-md border border-border bg-card p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="text-2xl font-semibold">{v ?? "…"}</p></div>))}
        </section>

        <form onSubmit={(e) => { e.preventDefault(); setPage(0); setApplied(f); }} className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-card p-3">
          <label className="text-xs">{L("From", "من")}<input type="date" className={`${inp} block`} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
          <label className="text-xs">{L("To", "إلى")}<input type="date" className={`${inp} block`} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
          <label className="text-xs">{L("Actor", "المنفّذ")}<select className={`${inp} block`} value={f.actor} onChange={(e) => setF({ ...f, actor: e.target.value })}><option value="">{L("All", "الكل")}</option>{fa?.actors.map((a) => <option key={a}>{a}</option>)}</select></label>
          <label className="text-xs">{L("Type", "النوع")}<select className={`${inp} block`} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">{L("All", "الكل")}</option>{CATS.map((c) => <option key={c} value={c}>{ar ? CAT_AR[c] : c}</option>)}</select></label>
          <label className="text-xs">{L("Action", "الإجراء")}<select className={`${inp} block`} value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })}><option value="">{L("All", "الكل")}</option>{fa?.actions.map((a) => <option key={a}>{a}</option>)}</select></label>
          <label className="text-xs">{L("Archive", "الأرشيف")}<select className={`${inp} block`} value={f.archived} onChange={(e) => setF({ ...f, archived: e.target.value })}>
            <option value="active">{L("Current", "الحالية")}</option><option value="archived">{L("Archived (restore for review)", "المؤرشفة (استعادة للمراجعة)")}</option><option value="all">{L("All", "الكل")}</option></select></label>
          <label className="flex-1 text-xs">{L("Search", "بحث")}<input className={`${inp} block w-full`} value={f.q} maxLength={100} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder={L("Target, value, note or email", "الهدف أو القيمة أو الملاحظة أو البريد")} /></label>
          <button className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground">{L("Apply", "تطبيق")}</button>
          <button type="button" onClick={() => { const z = { from: "", to: "", actor: "", category: "", action: "", q: "", archived: "active" }; setF(z); setApplied(z); setPage(0); }} className="text-sm underline">{L("Clear", "مسح")}</button>
        </form>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">{L(`${total} matching events`, `${total} حدث مطابق`)}</span>
          <span className="ms-auto" />
          <button onClick={() => void doExport("csv")} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5"><Download aria-hidden className="h-4 w-4" />CSV</button>
          <button onClick={() => void doExport("pdf")} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5"><FileText aria-hidden className="h-4 w-4" />PDF</button>
          <button onClick={() => void verify()} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5"><ShieldCheck aria-hidden className="h-4 w-4" />{L("Verify integrity", "تحقق من السلامة")}</button>
        </div>

        {events.isLoading ? <p className="text-muted-foreground">{L("Loading…", "جارٍ التحميل…")}</p> : events.error ? <p className="text-destructive">{(events.error as Error).message}</p> : rows.length === 0 ? <p className="text-muted-foreground">{L("No events match.", "لا توجد أحداث مطابقة.")}</p> : (
          <div className="overflow-x-auto rounded-md border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground"><tr>
                <th className="p-2 text-start">#</th><th className="p-2 text-start">{L("Time", "الوقت")}</th><th className="p-2 text-start">{L("Actor", "المنفّذ")}</th><th className="p-2 text-start">{L("Type", "النوع")}</th><th className="p-2 text-start">{L("Action", "الإجراء")}</th><th className="p-2 text-start">{L("Target", "الهدف")}</th><th className="p-2" /></tr></thead>
              <tbody>{rows.map((e) => (
                <Fragment key={e.id}>
                  <tr className="border-b border-border align-top">
                    <td className="p-2 font-mono text-xs">{e.seq}{e.archived && <Lock aria-label={L("Archived", "مؤرشف")} className="ms-1 inline h-3 w-3" />}</td>
                    <td className="p-2 whitespace-nowrap">{fmtDate(e.created_at, ar)}</td>
                    <td className="p-2">{e.actor_email ?? L("system", "النظام")}</td>
                    <td className="p-2">{ar ? CAT_AR[e.category] ?? e.category : e.category}</td>
                    <td className="p-2">{e.action}{e.revert_of && <span className="ms-1 rounded bg-muted px-1 text-xs">{L("undo", "تراجع")}</span>}{e.reverted_by && <span className="ms-1 rounded bg-muted px-1 text-xs">{L("undone", "تم التراجع عنه")}</span>}</td>
                    <td className="p-2 font-mono text-xs break-all">{e.target_type}:{e.target_id}</td>
                    <td className="p-2 whitespace-nowrap text-end">
                      <button aria-expanded={open === e.id} onClick={() => setOpen(open === e.id ? null : e.id)} className="inline-flex items-center gap-1 text-xs underline">{open === e.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}{L("Details", "التفاصيل")}</button>
                      {["content", "order", "role"].includes(e.category) && !e.reverted_by && <button onClick={() => void openUndo(e)} className="ms-2 inline-flex items-center gap-1 text-xs underline"><Undo2 className="h-3 w-3" />{L("Undo", "تراجع")}</button>}
                    </td>
                  </tr>
                  {open === e.id && <tr className="border-b border-border bg-muted/30"><td colSpan={7} className="p-3">
                    <div className="grid gap-3 md:grid-cols-2"><div><p className="mb-1 text-xs font-medium">{L("Before", "قبل")}</p><J v={e.before} /></div><div><p className="mb-1 text-xs font-medium">{L("After", "بعد")}</p><J v={e.after} /></div></div>
                    {e.note && <p className="mt-2 text-xs">{L("Note", "ملاحظة")}: {e.note}</p>}
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">{e.id}</p>
                  </td></tr>}
                </Fragment>))}</tbody>
            </table>
          </div>)}
        {total > PER && <div className="flex items-center justify-between text-sm">
          <button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-md border border-border px-3 py-1.5 disabled:opacity-40">{L("Newer", "الأحدث")}</button>
          <span>{page + 1} / {Math.ceil(total / PER)}</span>
          <button disabled={(page + 1) * PER >= total} onClick={() => setPage(page + 1)} className="rounded-md border border-border px-3 py-1.5 disabled:opacity-40">{L("Older", "الأقدم")}</button></div>}

        {preview && <div role="dialog" aria-modal className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg bg-card p-5">
            <h2 className="text-lg font-semibold">{L("Undo preview", "معاينة التراجع")} · #{preview.ev.seq}</h2>
            {!preview.p.can_undo && <p className="mt-2 rounded bg-destructive/10 p-2 text-sm text-destructive">{preview.p.reason === "NEWER_CHANGE" ? L("A newer change to the same item exists. Undo would overwrite it, so it is blocked.", "يوجد تعديل أحدث على العنصر نفسه، لذلك التراجع محظور.")
              : preview.p.reason === "CURRENT_DIFFERS" ? L("The current value no longer matches this change. Undo is blocked.", "القيمة الحالية لم تعد تطابق هذا التغيير، لذلك التراجع محظور.")
              : preview.p.reason === "ALREADY_UNDONE" ? L("Already undone.", "تم التراجع عنه مسبقًا.") : L("This change can't be undone.", "لا يمكن التراجع عن هذا التغيير.")}</p>}
            <div className="mt-3 grid gap-3 md:grid-cols-2"><div><p className="mb-1 text-xs font-medium">{L("Current value", "القيمة الحالية")}</p><J v={preview.p.current} /></div><div><p className="mb-1 text-xs font-medium">{L("Will be restored to", "ستُستعاد إلى")}</p><J v={preview.p.restore_to} /></div></div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setPreview(null)} className="rounded-md border border-border px-4 py-1.5 text-sm">{L("Cancel", "إلغاء")}</button>
              <button disabled={!preview.p.can_undo} onClick={() => void applyUndo()} className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-40">{L("Apply undo", "تطبيق التراجع")}</button>
            </div>
          </div></div>}

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-border bg-card p-4">
            <h2 className="font-medium">{L("Retention & archiving", "الاحتفاظ والأرشفة")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{L("Events older than their retention are archived: hidden by default, never deleted, and still part of the integrity chain. Active holds pause archiving.", "تُؤرشف الأحداث الأقدم من مدة احتفاظها: تُخفى افتراضيًا ولا تُحذف وتبقى ضمن سلسلة السلامة. الحجوزات النشطة توقف الأرشفة.")}</p>
            <ul className="mt-3 space-y-1 text-sm">{Object.entries(fa?.retention ?? {}).map(([c, d]) => <li key={c} className="flex items-center justify-between"><span>{ar ? CAT_AR[c] ?? c : c}</span><span>{L(`${d} days`, `${d} يوم`)} {fa?.is_admin && <button onClick={() => void setRetention(c, d)} className="ms-2 text-xs underline">{L("Change", "تغيير")}</button>}</span></li>)}</ul>
            <h3 className="mt-4 text-sm font-medium">{L("Review / compliance holds", "حجوزات المراجعة والامتثال")}</h3>
            {(fa?.holds ?? []).length === 0 ? <p className="text-xs text-muted-foreground">{L("No active holds.", "لا توجد حجوزات نشطة.")}</p> : <ul className="mt-1 space-y-1 text-sm">{fa!.holds.map((h) => <li key={h.id} className="flex items-center justify-between"><span>{h.reason} · {h.category ?? L("all", "الكل")}</span>{fa!.is_admin && <button onClick={() => void hold(h.id)} className="text-xs underline">{L("Release", "رفع")}</button>}</li>)}</ul>}
            {fa?.is_admin && <button onClick={() => void hold()} className="mt-2 rounded-md border border-border px-3 py-1 text-sm">{L("Place hold", "إضافة حجز")}</button>}
          </div>
          <div className="rounded-md border border-border bg-card p-4">
            <h2 className="font-medium">{L("Integrity reports", "تقارير التحقق من السلامة")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{L("Runs every Monday automatically, or on demand.", "يعمل كل يوم اثنين تلقائيًا أو عند الطلب.")}</p>
            <ul className="mt-3 space-y-2 text-sm">{(reports.data ?? []).map((r) => <li key={r.id} className="rounded border border-border p-2">
              <p className={r.ok ? "" : "text-destructive"}>{r.ok ? L("Intact", "سليم") : L("Failed", "فشل")} · {fmtDate(r.ran_at, ar)} · {r.trigger === "scheduled" ? L("scheduled", "مجدول") : L("manual", "يدوي")}</p>
              <p className="text-xs text-muted-foreground">{L(`Checked ${r.checked} events (#${r.first_seq ?? "—"}–#${r.last_seq ?? "—"}) · ${r.gaps.length} gaps · ${r.failures.length} failures`, `تم فحص ${r.checked} حدث (#${r.first_seq ?? "—"}–#${r.last_seq ?? "—"}) · ${r.gaps.length} فجوة · ${r.failures.length} إخفاق`)}</p>
              {r.failures.length > 0 && <p className="text-xs text-destructive">{r.failures.slice(0, 10).map((x) => `#${x.seq} ${x.problem}`).join(", ")}</p>}
            </li>)}</ul>
          </div>
        </section>
      </div>
    </SiteShell>
  );
}
