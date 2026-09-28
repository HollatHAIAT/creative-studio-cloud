import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { compareResubmission, type VersionCompareResult } from "@/lib/policy-review.functions";
import { useLocale } from "@/lib/i18n";

const STATUS: Record<string, [string, string, string]> = {
  addressed: ["Addressed", "تمت المعالجة", "bg-success/15 text-success"],
  partly: ["Partly", "جزئيًا", "bg-warning/15 text-warning"],
  not_addressed: ["Not addressed", "لم تُعالج", "bg-destructive/10 text-destructive"],
  unclear: ["Needs a look", "يحتاج مراجعة", "bg-muted text-muted-foreground"],
};

export function ResubmissionCheck({ draftId, version, initialNotes }: { draftId: string; version: number; initialNotes: string }) {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const run = useServerFn(compareResubmission);
  const [notes, setNotes] = useState(initialNotes);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<VersionCompareResult | null>(null);

  async function go() {
    if (busy) return; setBusy(true); setErr(null);
    try {
      const r = await run({ data: { draftId, version, notes } });
      if (r.error) setErr(r.error); else setRes(r.result ?? null);
    } catch (e) { setErr(e instanceof Error ? e.message : "Error"); } finally { setBusy(false); }
  }
  const pill = (s: string) => { const x = STATUS[s] ?? STATUS["unclear"]!; return <span className={`rounded-full px-2 py-0.5 text-xs ${x[2]}`}>{L(x[0], x[1])}</span>; };

  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <p className="font-medium">{L("AI check: were the requested changes made?", "فحص ذكي: هل نُفذت التعديلات المطلوبة؟")}</p>
      <label className="block text-sm">{L("Decision notes", "ملاحظات القرار")}
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-border bg-background p-2" />
      </label>
      <button type="button" onClick={go} disabled={busy || notes.trim().length < 5} aria-busy={busy} className="rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50">
        {busy ? L("Checking…", "جارٍ الفحص…") : res ? L("Check again", "افحص مجددًا") : L("Check resubmission", "افحص الإرسال الجديد")}
      </button>
      <div aria-live="polite">
        {err && <p role="alert" className="text-sm text-destructive">{err} <button type="button" className="underline" onClick={go}>{L("Try again", "حاول مجددًا")}</button></p>}
        {res && (
          <div className="space-y-3 text-sm">
            <p className="flex flex-wrap items-center gap-2">{pill(res.verdict)} <span>{ar ? res.summaryAr : res.summary}</span></p>
            {res.requests.length > 0 && <ul className="space-y-2">{res.requests.map((r, i) => (
              <li key={i} className="rounded-lg bg-muted/40 p-2"><div className="flex flex-wrap items-center gap-2">{pill(r.status)}<span className="font-medium">{ar ? r.requestAr : r.request}</span></div><p className="mt-1 text-muted-foreground">{ar ? r.evidenceAr : r.evidence}</p></li>))}</ul>}
            <div><p className="font-medium">{L("Still needs review", "ما زال يحتاج مراجعة")}</p>
              {res.flags.length === 0 ? <p className="text-muted-foreground">{L("Nothing flagged.", "لا شيء مُعلَّم.")}</p> :
                <ul className="mt-1 space-y-1">{res.flags.map((f, i) => <li key={i}><span className="text-xs uppercase text-muted-foreground">{f.area} · {f.severity}</span> — {ar ? f.reasonAr : f.reason}</li>)}</ul>}
            </div>
            <p className="text-xs text-muted-foreground">{L("Advice only — you make the decision.", "للاستئناس فقط — القرار لك.")}</p>
          </div>)}
      </div>
    </div>
  );
}
