import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck } from "lucide-react";
import { reviewSettingsAudit, type ComplianceReview as R } from "@/lib/settings-audit-qa.functions";

type Row = { id: string; created_at: string; field: string };
/** Generates an AI compliance summary for the currently filtered audit rows; findings link to rows. */
export function ComplianceReview({ rows, scope, L, ar, labels }: { rows: Row[]; scope: string; L: (e: string, a: string) => string; ar: boolean; labels: Record<string, string> }) {
  const run = useServerFn(reviewSettingsAudit);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<R | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const byId = new Map(rows.map((r, i) => [r.id, { ...r, n: i + 1 }]));
  const sev: Record<string, string> = { info: L("Info", "معلومة"), low: L("Low", "منخفض"), medium: L("Medium", "متوسط"), high: L("High", "مرتفع") };
  const sevCls: Record<string, string> = { info: "bg-muted", low: "bg-secondary", medium: "bg-accent", high: "bg-destructive text-destructive-foreground" };
  async function go() {
    setBusy(true); setErr(null); setRes(null);
    try { const r = await run({ data: { ids: rows.slice(0, 300).map((r) => r.id), scope } }); if (r.error) setErr(r.error); else setRes(r.result ?? null); }
    catch { setErr(L("Couldn't reach the assistant. Please try again.", "تعذّر الوصول إلى المساعد. حاول مجددًا.")); }
    finally { setBusy(false); }
  }
  function jump(id: string) {
    const el = document.getElementById(`audit-${id}`); if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("bg-accent"); setTimeout(() => el.classList.remove("bg-accent"), 2000);
  }
  return (
    <div className="mt-4 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="flex items-center gap-2 font-medium"><ShieldCheck aria-hidden className="h-4 w-4 text-primary" />{L("Compliance review", "مراجعة الامتثال")}</h3>
        <button type="button" disabled={busy || rows.length === 0} onClick={() => void go()} className="ms-auto rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50">
          {busy ? L("Reviewing…", "جارٍ المراجعة…") : L(`Review ${Math.min(rows.length, 300)} shown entries`, `راجع ${Math.min(rows.length, 300)} سجلًا معروضًا`)}
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{L("AI summarizes the filtered entries for a compliance review. Each finding links to the entries it is based on.", "يلخّص الذكاء الاصطناعي السجلات المفلترة لمراجعة الامتثال، وكل ملاحظة مرتبطة بالسجلات التي تستند إليها.")}{rows.length > 300 && L(" Only the latest 300 are reviewed.", " تُراجع أحدث ٣٠٠ فقط.")}</p>
      <div aria-live="polite" className="text-sm">
        {err && <p role="alert" className="mt-3 text-destructive">{err}</p>}
        {res && <div className="mt-3 space-y-3">
          <p className="leading-relaxed">{ar ? res.overviewAr || res.overview : res.overview}</p>
          {res.findings.length > 0 && <ul className="space-y-2">{res.findings.map((f, i) => (
            <li key={i} className="rounded-lg bg-muted p-3">
              <p className="flex flex-wrap items-center gap-2 font-medium"><span className={`rounded-full px-2 py-0.5 text-xs ${sevCls[f.severity]}`}>{sev[f.severity]}</span>{ar ? f.titleAr || f.title : f.title}</p>
              <p className="mt-1">{ar ? f.detailAr || f.detail : f.detail}</p>
              {f.entryIds.length > 0 && <div className="mt-2 flex flex-wrap gap-1 text-xs"><span className="text-muted-foreground">{L("Evidence:", "الدليل:")}</span>{f.entryIds.map((id) => { const r = byId.get(id); return r ? (
                <button key={id} type="button" onClick={() => jump(id)} title={id} className="rounded-full border border-border bg-background px-2 py-0.5 hover:border-primary">
                  #{r.n} · {labels[r.field] ?? r.field} · {new Date(r.created_at).toLocaleDateString(ar ? "ar-SA" : "en-GB")}
                </button>) : null; })}</div>}
            </li>))}</ul>}
          {res.recommendations.length > 0 && <div><p className="font-medium">{L("Recommendations", "التوصيات")}</p><ul className="mt-1 list-disc space-y-1 ps-5">{res.recommendations.map((r, i) => <li key={i}>{ar ? r.textAr || r.text : r.text}</li>)}</ul></div>}
        </div>}
      </div>
    </div>
  );
}
