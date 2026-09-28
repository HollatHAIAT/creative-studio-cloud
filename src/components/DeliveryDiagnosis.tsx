import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Stethoscope } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { diagnoseInviteDelivery, type DeliveryDiagnosis as D } from "@/lib/delivery-diagnosis.functions";

const LK: Record<string, [string, string, string]> = {
  high: ["Likely", "مرجّح", "bg-destructive/10 text-destructive"],
  medium: ["Possible", "محتمل", "bg-warning/15 text-warning"],
  low: ["Unclear", "غير مؤكد", "bg-muted text-muted-foreground"],
};
const WHO: Record<string, [string, string]> = { moderator: ["Moderator", "المشرف"], seller: ["Seller", "البائع"], reviewer: ["Reviewer", "المراجع"], admin: ["Admin", "المسؤول"] };

/** Staff: AI diagnosis of reviewer-invitation delivery problems. `prefill` is built from the panel rows. */
export function DeliveryDiagnosis({ prefill }: { prefill: string }) {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const run = useServerFn(diagnoseInviteDelivery);
  const [report, setReport] = useState(""); const [ctx, setCtx] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<D | null>(null);

  async function go() {
    if (busy || report.trim().length < 10) return; setBusy(true); setErr(null);
    try { const r = await run({ data: { report, context: ctx } }); if (r.error) setErr(r.error); else setRes(r.diagnosis!); }
    catch (e) { setErr(e instanceof Error ? e.message : "Error"); } finally { setBusy(false); }
  }
  const box = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";

  return (
    <section aria-labelledby="dd-h" className="space-y-3 rounded-2xl border border-border p-4">
      <h3 id="dd-h" className="flex items-center gap-2 font-medium"><Stethoscope aria-hidden className="h-4 w-4 text-primary" />{L("AI: diagnose delivery problems", "ذكاء اصطناعي: شخّص مشكلات التسليم")}</h3>
      <p className="text-sm text-muted-foreground">{L("Paste delivery statuses and error messages, or fill them in from the table above. The AI suggests likely causes and next steps.", "الصق حالات التسليم ورسائل الخطأ، أو املأها من الجدول أعلاه. يقترح الذكاء الاصطناعي الأسباب المرجّحة والخطوات التالية.")}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setReport(prefill)} disabled={!prefill} className="rounded-full border border-border px-3 py-1 text-sm disabled:opacity-50">{L("Fill from the table (shown rows)", "املأ من الجدول (الصفوف الظاهرة)")}</button>
      </div>
      <textarea value={report} onChange={(e) => setReport(e.target.value)} rows={6} maxLength={8000} aria-label={L("Delivery statuses and errors", "حالات التسليم والأخطاء")}
        placeholder={L("e.g. j***@gmial.com — failed ×3 — 550 5.1.1 user unknown", "مثال: j***@gmial.com — فشل ×3 — 550 5.1.1 user unknown")} className={`${box} font-mono`} dir="ltr" />
      <input value={ctx} onChange={(e) => setCtx(e.target.value)} maxLength={1000} aria-label={L("Extra context (optional)", "سياق إضافي (اختياري)")}
        placeholder={L("Extra context (optional) — e.g. reviewer says nothing arrived", "سياق إضافي (اختياري) — مثال: المراجع يقول لم يصله شيء")} className={box} />
      <button type="button" onClick={go} disabled={busy || report.trim().length < 10} aria-busy={busy} className="rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50">
        {busy ? L("Diagnosing…", "جارٍ التشخيص…") : res ? L("Diagnose again", "شخّص مجددًا") : L("Diagnose", "شخّص")}
      </button>
      <div aria-live="polite" className="space-y-3">
        {err && <p role="alert" className="text-sm text-destructive">{err} <button type="button" className="underline" onClick={go}>{L("Try again", "حاول مجددًا")}</button></p>}
        {res && (<>
          <p className="text-sm">{ar ? res.summaryAr || res.summary : res.summary}</p>
          {res.problems.length > 0 && (<>
            <h4 className="text-sm font-medium">{L("Likely problems", "المشكلات المرجّحة")}</h4>
            <ul className="space-y-2">{res.problems.map((p, i) => { const k = LK[p.likelihood] ?? LK["medium"]!; return (
              <li key={i} className="rounded-lg bg-muted/40 p-2 text-sm">
                <span className={`me-2 rounded-full px-2 py-0.5 text-xs ${k[2]}`}>{L(k[0], k[1])}</span>
                <span className="font-medium">{ar ? p.causeAr || p.cause : p.cause}</span>
                {(p.evidence || p.evidenceAr) && <span className="block text-muted-foreground">{ar ? p.evidenceAr || p.evidence : p.evidence}</span>}
                {p.affected && <span dir="ltr" className="block text-xs text-muted-foreground">{p.affected}</span>}
              </li>); })}</ul>
          </>)}
          {res.nextSteps.length > 0 && (<>
            <h4 className="text-sm font-medium">{L("Next steps", "الخطوات التالية")}</h4>
            <ol className="list-decimal space-y-1 ps-5 text-sm">{res.nextSteps.map((s, i) => (
              <li key={i}><span className="me-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{L(...(WHO[s.who] ?? WHO["moderator"]!))}</span>{ar ? s.stepAr || s.step : s.step}</li>))}</ol>
          </>)}
          {(res.resendAdvice || res.resendAdviceAr) && <p className="rounded-lg border border-border p-2 text-sm"><span className="font-medium">{L("Resend?", "إعادة الإرسال؟")} </span>{ar ? res.resendAdviceAr || res.resendAdvice : res.resendAdvice}</p>}
          <p className="text-xs text-muted-foreground">{L("This is advice only, based on the details you gave.", "هذا رأي استشاري فقط، مبني على التفاصيل التي قدّمتها.")}</p>
        </>)}
      </div>
    </section>
  );
}
