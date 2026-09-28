import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { findRecurringIssues, type RecurringIssuesResult } from "@/lib/policy-review.functions";
import { useLocale } from "@/lib/i18n";
import { useCanViewPrivateComments } from "./FieldComments";

const ST: Record<string, [string, string, string]> = {
  unresolved: ["Unresolved", "لم تُحل", "bg-destructive/10 text-destructive"],
  resolved: ["Resolved", "حُلّت", "bg-success/15 text-success"],
  unclear: ["Needs a look", "يحتاج نظرة", "bg-muted text-muted-foreground"],
};
const PR: Record<string, [string, string]> = { high: ["High", "عالية"], medium: ["Medium", "متوسطة"], low: ["Low", "منخفضة"] };

/** Staff-only AI: recurring unresolved issues across all versions + private comments, and focused checks for the next review. */
export function RecurringIssues({ draftId }: { draftId: string }) {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const run = useServerFn(findRecurringIssues);
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<RecurringIssuesResult | null>(null);
  async function go() {
    if (busy) return; setBusy(true); setErr(null);
    try { const r = await run({ data: { draftId, extra } }); if (r.error) setErr(r.error); else setRes(r.result ?? null); }
    catch (e) { setErr(e instanceof Error ? e.message : "Error"); } finally { setBusy(false); }
  }
  const { allowed } = useCanViewPrivateComments();
  const unresolved = res?.issues.filter((i) => i.status !== "resolved") ?? [];
  const resolved = res?.issues.filter((i) => i.status === "resolved") ?? [];
  const Item = ({ i }: { i: RecurringIssuesResult["issues"][number] }) => { const s = ST[i.status] ?? ST["unclear"]!; return (
    <li className="rounded-lg bg-muted/40 p-2"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-xs ${s[2]}`}>{L(s[0], s[1])}</span>
      <span className="font-medium">{ar ? i.issueAr || i.issue : i.issue}</span><span className="text-xs text-muted-foreground">{i.field}{i.versions.length ? ` · v${i.versions.join(", v")}` : ""}</span></div>
      <p className="mt-1 text-muted-foreground">{ar ? i.evidenceAr || i.evidence : i.evidence}</p></li>); };
  if (!allowed) return null;
  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <p className="font-medium">{L("AI: recurring issues & checks for the next review", "ذكاء اصطناعي: المشكلات المتكررة وفحوص المراجعة القادمة")}</p>
      <p className="text-sm text-muted-foreground">{L("Uses every version, the reviewer notes and all private field comments on this listing.", "يستخدم كل الإصدارات وملاحظات المراجعين وجميع التعليقات الخاصة على هذا الإعلان.")}</p>
      <label className="block text-sm">{L("Extra context (optional)", "سياق إضافي (اختياري)")}
        <textarea value={extra} onChange={(e) => setExtra(e.target.value)} maxLength={3000} rows={2} className="mt-1 w-full rounded-xl border border-border bg-background p-2" /></label>
      <button type="button" onClick={go} disabled={busy} aria-busy={busy} className="rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50">
        {busy ? L("Analysing…", "جارٍ التحليل…") : res ? L("Analyse again", "حلّل مجددًا") : L("Find recurring issues", "ابحث عن المشكلات المتكررة")}
      </button>
      <div aria-live="polite">
        {err && <p role="alert" className="text-sm text-destructive">{err} <button type="button" className="underline" onClick={go}>{L("Try again", "حاول مجددًا")}</button></p>}
        {res && (
          <div className="space-y-3 text-sm">
            <p>{ar ? res.summaryAr || res.summary : res.summary}</p>
            <div><p className="font-medium">{L("Recurring & unresolved", "متكررة ولم تُحل")}</p>
              {unresolved.length ? <ul className="mt-1 space-y-2">{unresolved.map((i, k) => <Item key={k} i={i} />)}</ul> : <p className="text-muted-foreground">{L("Nothing recurring is still open.", "لا مشكلات متكررة مفتوحة.")}</p>}</div>
            {resolved.length > 0 && <details><summary className="cursor-pointer">{L(`Resolved recurring issues (${resolved.length})`, `مشكلات متكررة حُلّت (${resolved.length})`)}</summary><ul className="mt-1 space-y-2">{resolved.map((i, k) => <Item key={k} i={i} />)}</ul></details>}
            <div><p className="font-medium">{L("Focused checks for the next review", "فحوص مركّزة للمراجعة القادمة")}</p>
              <ol className="mt-1 list-decimal space-y-1 ps-5">{res.checks.map((c, k) => <li key={k}><span className="text-xs uppercase text-muted-foreground">{c.field} · {L(...(PR[c.priority] ?? ["", ""]) as [string, string])}</span> — {ar ? c.checkAr || c.check : c.check}</li>)}</ol></div>
            <p className="text-xs text-muted-foreground">{L("Advice only — you make the decision. Comments stay private to staff.", "للاستئناس فقط — القرار لك. تبقى التعليقات خاصة بالفريق.")}</p>
          </div>)}
      </div>
    </div>
  );
}
