import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardCheck } from "lucide-react";
import { exportCompliancePdf, reportText } from "@/lib/compliance-pdf";
import { assessControl, type ControlAssessment } from "@/lib/settings-audit-qa.functions";

type Filters = { from: string | null; to: string | null; actor: string | null; field: string | null };
/** Admin writes a control/policy; AI assesses every matching audit entry, flags evidence gaps, links evidence. */
export function ControlCheck({ filters, total, L, ar, scope = "", labels = {} }: { filters: Filters; total: number; L: (e: string, a: string) => string; ar: boolean; scope?: string; labels?: Record<string, string> }) {
  const run = useServerFn(assessControl);
  const [control, setControl] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<ControlAssessment | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const n = (x: number) => x.toLocaleString(ar ? "ar-SA" : "en-US");
  const verdict: Record<string, string> = { met: L("Met", "مستوفى"), partially_met: L("Partially met", "مستوفى جزئيًا"), not_met: L("Not met", "غير مستوفى"), insufficient_evidence: L("Insufficient evidence", "أدلة غير كافية") };
  const status: Record<string, string> = { met: L("Met", "مستوفى"), violated: L("Violated", "مخالَف"), unclear: L("Unclear", "غير واضح") };
  const cls: Record<string, string> = { met: "bg-secondary", partially_met: "bg-accent", not_met: "bg-destructive text-destructive-foreground", violated: "bg-destructive text-destructive-foreground", insufficient_evidence: "bg-muted", unclear: "bg-muted" };
  const examples = [
    L("The return window must never drop below 14 days.", "يجب ألّا تقل مهلة الإرجاع عن ١٤ يومًا."),
    L("License multiplier changes must not exceed 50% at once and need a second admin's approval.", "لا يتجاوز تغيير مضاعِف الترخيص ٥٠٪ دفعة واحدة ويحتاج موافقة مشرف ثانٍ."),
  ];
  async function go() {
    if (control.trim().length < 10 || busy) return;
    setBusy(true); setErr(null); setRes(null); setNote(null);
    try { const r = await run({ data: { ...filters, control: control.trim() } }); if (r.error) setErr(r.error); else setRes(r.result ?? null); }
    catch { setErr(L("Couldn't reach the assistant. Please try again.", "تعذّر الوصول إلى المساعد. حاول مجددًا.")); }
    finally { setBusy(false); }
  }
  function jump(id: string) {
    const el = document.getElementById(`audit-${id}`);
    if (!el) { setNote(L("That entry isn't on the current table page. Use the page buttons or filters to find it.", "هذا السجل ليس في الصفحة الحالية من الجدول. استخدم أزرار الصفحات أو الفلاتر للوصول إليه.")); return; }
    setNote(null); el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("bg-accent"); setTimeout(() => el.classList.remove("bg-accent"), 2000);
  }
  const Chips = ({ ids }: { ids: string[] }) => !res || !ids.length ? null : (
    <div className="mt-2 flex flex-wrap gap-1 text-xs"><span className="text-muted-foreground">{L("Evidence:", "الدليل:")}</span>{ids.map((id) => { const e = res.evidence[id]; return e ? (
      <button key={id} type="button" onClick={() => jump(id)} title={e.who} className="rounded-full border border-border bg-background px-2 py-0.5 hover:border-primary">#{n(e.n)} · {e.field} · {e.from ?? "—"} → {e.to ?? "—"} · {new Date(e.created_at).toLocaleDateString(ar ? "ar-SA" : "en-GB")}</button>) : null; })}</div>);
  return (
    <div className="mt-4 rounded-xl border border-border p-4">
      <h3 className="flex items-center gap-2 font-medium"><ClipboardCheck aria-hidden className="h-4 w-4 text-primary" />{L("Check against a control", "افحص مقابل ضابط رقابي")}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{L(`Write a control or policy. AI checks all ${n(total)} changes matching your filters, flags what the history can't prove, and links the evidence.`, `اكتب ضابطًا أو سياسة. يفحص الذكاء الاصطناعي كل التغييرات المطابقة لفلاترك (${n(total)})، ويبيّن ما لا يستطيع السجل إثباته، ويربط الأدلة.`)}</p>
      <label htmlFor="ctl" className="sr-only">{L("Control or policy", "الضابط أو السياسة")}</label>
      <textarea id="ctl" value={control} onChange={(e) => setControl(e.target.value)} maxLength={2000} rows={3} placeholder={examples[0]} className="mt-2 w-full rounded-lg border border-input bg-background p-2 text-sm" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {examples.map((x) => <button key={x} type="button" onClick={() => setControl(x)} className="rounded-full border border-border px-3 py-1 text-xs hover:border-primary">{x}</button>)}
        <button type="button" onClick={go} disabled={busy || control.trim().length < 10} className="ms-auto rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50">{busy ? L("Assessing…", "جارٍ التقييم…") : L("Assess", "قيّم")}</button>
      </div>
      <div aria-live="polite" className="mt-3 text-sm">
        {err && <p role="alert" className="text-destructive">{err}</p>}
        {res && (<>
          <p className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-xs ${cls[res.verdict]}`}>{verdict[res.verdict]}</span><span className="text-xs text-muted-foreground">{L(`Assessed ${n(res.reviewed)} of ${n(res.total)} matching changes`, `قُيِّم ${n(res.reviewed)} من ${n(res.total)} تغييرًا مطابقًا`)}</span><button type="button" onClick={() => { if (!exportCompliancePdf({ title: L("Control assessment", "تقييم الضابط الرقابي"), subtitle: `${L("Control", "الضابط")}: ${control.trim()} — ${verdict[res.verdict]}`, scope: scope || L("all entries", "كل السجلات"), summary: ar ? res.summaryAr || res.summary : res.summary, evidence: res.evidence, ar, labels, t: reportText(L),
            sections: [...res.assessments.map((a) => ({ badge: status[a.status], heading: ar ? a.requirementAr || a.requirement : a.requirement, body: ar ? a.detailAr || a.detail : a.detail, entryIds: a.entryIds })),
              ...res.gaps.map((g) => ({ badge: L("Evidence gap", "فجوة أدلة"), heading: ar ? g.gapAr || g.gap : g.gap, note: g.needed ? L("Needed: ", "المطلوب: ") + (ar ? g.neededAr || g.needed : g.needed) : undefined, entryIds: g.entryIds }))] })) setErr(L("Allow pop-ups for this site to export the PDF.", "اسمح بالنوافذ المنبثقة لهذا الموقع لتصدير الملف.")); }} className="ms-auto rounded-full border border-border px-3 py-1 text-xs hover:border-primary">{L("Export PDF", "تصدير PDF")}</button></p>
          <p className="mt-2 leading-relaxed">{ar ? res.summaryAr || res.summary : res.summary}</p>
          {res.assessments.length > 0 && <div className="mt-3"><p className="font-medium">{L("Requirements", "المتطلبات")}</p><ul className="mt-1 space-y-2">{res.assessments.map((a, i) => <li key={i} className="rounded-lg bg-muted p-3"><p className="flex gap-2"><span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${cls[a.status]}`}>{status[a.status]}</span>{ar ? a.requirementAr || a.requirement : a.requirement}</p><p className="mt-1 text-xs text-muted-foreground">{ar ? a.detailAr || a.detail : a.detail}</p><Chips ids={a.entryIds} /></li>)}</ul></div>}
          {res.gaps.length > 0 && <div className="mt-3"><p className="font-medium">{L("Evidence gaps", "فجوات الأدلة")}</p><ul className="mt-1 space-y-2">{res.gaps.map((g, i) => <li key={i} className="rounded-lg border border-dashed border-border p-3"><p>{ar ? g.gapAr || g.gap : g.gap}</p>{g.needed && <p className="mt-1 text-xs text-muted-foreground">{L("Needed: ", "المطلوب: ")}{ar ? g.neededAr || g.needed : g.needed}</p>}<Chips ids={g.entryIds} /></li>)}</ul></div>}
          {note && <p role="status" className="mt-3 rounded-lg bg-muted p-2 text-xs">{note}</p>}
        </>)}
      </div>
    </div>
  );
}
