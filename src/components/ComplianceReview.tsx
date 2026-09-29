import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck } from "lucide-react";
import { reviewSettingsAudit, type ComplianceReview as R } from "@/lib/settings-audit-qa.functions";
import { exportCompliancePdf, reportText } from "@/lib/compliance-pdf";

type Filters = { from: string | null; to: string | null; actor: string | null; field: string | null };
/** AI compliance review of every audit entry matching the filters (loaded server-side); findings link to entries. */
export function ComplianceReview({ filters, total, scope, L, ar, labels }: { filters: Filters; total: number; scope: string; L: (e: string, a: string) => string; ar: boolean; labels: Record<string, string> }) {
  const run = useServerFn(reviewSettingsAudit);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<R | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const sev: Record<string, string> = { info: L("Info", "معلومة"), low: L("Low", "منخفض"), medium: L("Medium", "متوسط"), high: L("High", "مرتفع") };
  const sevCls: Record<string, string> = { info: "bg-muted", low: "bg-secondary", medium: "bg-accent", high: "bg-destructive text-destructive-foreground" };
  const n = (x: number) => x.toLocaleString(ar ? "ar-SA" : "en-US");
  async function go() {
    setBusy(true); setErr(null); setRes(null);
    try { const r = await run({ data: { ...filters, scope } }); if (r.error) setErr(r.error); else setRes(r.result ?? null); }
    catch { setErr(L("Couldn't reach the assistant. Please try again.", "تعذّر الوصول إلى المساعد. حاول مجددًا.")); }
    finally { setBusy(false); }
  }
  function jump(id: string) {
    const el = document.getElementById(`audit-${id}`); if (!el) return false;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("bg-accent"); setTimeout(() => el.classList.remove("bg-accent"), 2000);
    return true;
  }
  return (
    <div className="mt-4 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="flex items-center gap-2 font-medium"><ShieldCheck aria-hidden className="h-4 w-4 text-primary" />{L("Compliance review", "مراجعة الامتثال")}</h3>
        <button type="button" disabled={busy || total === 0} onClick={() => void go()} className="ms-auto rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50">
          {busy ? L("Reviewing…", "جارٍ المراجعة…") : L(`Review all ${n(total)} matching entries`, `راجع كل السجلات المطابقة (${n(total)})`)}
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{L("AI reviews every entry matching your filters, not only those shown in the table. Each finding links to the entries it is based on.", "يراجع الذكاء الاصطناعي كل السجلات المطابقة للفلاتر، لا المعروضة في الجدول فقط، وكل ملاحظة مرتبطة بالسجلات التي تستند إليها.")}{total > 3000 && L(" Only the latest 3,000 are reviewed.", " تُراجع أحدث ٣٬٠٠٠ فقط.")}</p>
      <div aria-live="polite" className="text-sm">
        {err && <p role="alert" className="mt-3 text-destructive">{err}</p>}
        {res && <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2"><p className="text-xs text-muted-foreground">{L(`Reviewed ${n(res.reviewed)} of ${n(res.total)} matching entries.`, `رُوجع ${n(res.reviewed)} من ${n(res.total)} سجلًا مطابقًا.`)}</p>
            <button type="button" onClick={() => { if (!exportCompliancePdf({ title: L("Compliance review", "مراجعة الامتثال"), subtitle: L(`Reviewed ${res.reviewed} of ${res.total} matching changes`, `رُوجع ${res.reviewed} من ${res.total} تغييرًا مطابقًا`), scope, summary: ar ? res.overviewAr || res.overview : res.overview, evidence: res.evidence, ar, labels, t: reportText(L),
              sections: res.findings.map((f) => ({ badge: sev[f.severity], heading: ar ? f.titleAr || f.title : f.title, body: ar ? f.detailAr || f.detail : f.detail, entryIds: f.entryIds })),
              list: { heading: L("Recommendations", "التوصيات"), items: res.recommendations.map((r) => ar ? r.textAr || r.text : r.text) } })) setErr(L("Allow pop-ups for this site to export the PDF.", "اسمح بالنوافذ المنبثقة لهذا الموقع لتصدير الملف.")); }} className="ms-auto rounded-full border border-border px-3 py-1 text-xs hover:border-primary">{L("Export PDF", "تصدير PDF")}</button></div>
          <p className="leading-relaxed">{ar ? res.overviewAr || res.overview : res.overview}</p>
          {res.findings.length > 0 && <ul className="space-y-2">{res.findings.map((f, i) => (
            <li key={i} className="rounded-lg bg-muted p-3">
              <p className="flex flex-wrap items-center gap-2 font-medium"><span className={`rounded-full px-2 py-0.5 text-xs ${sevCls[f.severity]}`}>{sev[f.severity]}</span>{ar ? f.titleAr || f.title : f.title}</p>
              <p className="mt-1">{ar ? f.detailAr || f.detail : f.detail}</p>
              {f.entryIds.length > 0 && <div className="mt-2 flex flex-wrap gap-1 text-xs"><span className="text-muted-foreground">{L("Evidence:", "الدليل:")}</span>{f.entryIds.map((id) => { const e = res.evidence[id]; return e ? (
                <button key={id} type="button" onClick={() => jump(id)} title={`${e.who} · ${e.from ?? "—"} → ${e.to ?? "—"} · ${id}`} className="rounded-full border border-border bg-background px-2 py-0.5 hover:border-primary">
                  #{n(e.n)} · {labels[e.field] ?? e.field} · {e.from ?? "—"} → {e.to ?? "—"} · {new Date(e.created_at).toLocaleDateString(ar ? "ar-SA" : "en-GB")}
                </button>) : null; })}</div>}
            </li>))}</ul>}
          {res.recommendations.length > 0 && <div><p className="font-medium">{L("Recommendations", "التوصيات")}</p><ul className="mt-1 list-disc space-y-1 ps-5">{res.recommendations.map((r, i) => <li key={i}>{ar ? r.textAr || r.text : r.text}</li>)}</ul></div>}
        </div>}
      </div>
    </div>
  );
}
