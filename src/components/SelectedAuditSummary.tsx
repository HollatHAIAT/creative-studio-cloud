import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { summarizeSelectedAudit, type SelectedSummary } from "@/lib/selected-audit-summary.functions";

/** Summarizes the Change history rows the admin ticked and flags unusual activity. */
export function SelectedAuditSummary({ ids, clear, L, ar }: { ids: string[]; clear: () => void; L: (e: string, a: string) => string; ar: boolean }) {
  const run = useServerFn(summarizeSelectedAudit);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<SelectedSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const n = (x: number) => x.toLocaleString(ar ? "ar-SA" : "en-US");
  async function go() {
    setBusy(true); setErr(null); setRes(null); setNote(null);
    try { const r = await run({ data: { ids } }); if (r.error) setErr(r.error); else setRes(r.result ?? null); }
    catch { setErr(L("Couldn't reach the assistant. Please try again.", "تعذّر الوصول إلى المساعد. حاول مجددًا.")); }
    finally { setBusy(false); }
  }
  function jump(id: string) {
    const el = document.getElementById(`audit-${id}`);
    if (!el) { setNote(L("That entry isn't on the current page. Use the page buttons or filters to find it.", "هذا السجل ليس في الصفحة الحالية. استخدم أزرار الصفحات أو الفلاتر للوصول إليه.")); return; }
    setNote(null); el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("bg-accent"); setTimeout(() => el.classList.remove("bg-accent"), 2000);
  }
  const Chips = ({ list }: { list: string[] }) => !res || !list.length ? null : (
    <div className="mt-1 flex flex-wrap gap-1 text-xs">{list.map((id) => { const e = res.evidence[id]; return e ? (
      <button key={id} type="button" onClick={() => jump(id)} title={e.who} className="rounded-full border border-border bg-background px-2 py-0.5 hover:border-primary">
        {e.field} · {e.from ?? "—"} → {e.to ?? "—"} · {new Date(e.created_at).toLocaleDateString(ar ? "ar-SA" : "en-GB")}
      </button>) : null; })}</div>);
  const lvl = { low: L("Low", "منخفض"), medium: L("Medium", "متوسط"), high: L("High", "مرتفع") };
  const lvlCls = { low: "border-border", medium: "border-primary", high: "border-destructive text-destructive" };

  return (
    <div className="mt-4 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <p className="font-medium">{L("Summarize selected changes", "لخّص التغييرات المحددة")}</p>
        <span className="text-xs text-muted-foreground">{ids.length ? L(`${n(ids.length)} selected`, `${n(ids.length)} محدد`) : L("Tick rows in the table below (up to 200).", "حدّد صفوفًا في الجدول أدناه (حتى ٢٠٠).")}</span>
        {ids.length > 0 && <button type="button" onClick={clear} className="text-xs underline">{L("Clear selection", "إلغاء التحديد")}</button>}
        <button type="button" disabled={busy || !ids.length || ids.length > 200} onClick={() => void go()} className="ms-auto rounded-full bg-primary px-4 py-1.5 text-primary-foreground disabled:opacity-50">{busy ? L("Summarizing…", "جارٍ التلخيص…") : L("Summarize", "لخّص")}</button>
      </div>
      <div aria-live="polite" className="text-sm">
        {err && <p role="alert" className="mt-3 text-destructive">{err}</p>}
        {res && (<div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">{L(`Based on ${n(res.count)} selected changes.`, `بناءً على ${n(res.count)} تغييرًا محددًا.`)}</p>
          <p className="leading-relaxed">{ar ? res.summaryAr || res.summary : res.summary}</p>
          {res.keyChanges.length > 0 && <div><p className="font-medium">{L("Key changes", "أبرز التغييرات")}</p><ul className="mt-1 space-y-2">{res.keyChanges.map((k, i) => <li key={i}><p>{ar ? k.textAr || k.text : k.text}</p><Chips list={k.entryIds} /></li>)}</ul></div>}
          <div><p className="font-medium">{L("Unusual activity", "نشاط غير معتاد")}</p>
            {res.flags.length === 0 ? <p className="mt-1 text-muted-foreground">{L("Nothing unusual found in these changes.", "لم يُرصد شيء غير معتاد في هذه التغييرات.")}</p>
              : <ul className="mt-1 space-y-2">{res.flags.map((f, i) => <li key={i} className="rounded-lg bg-muted p-3"><span className={`me-2 rounded-full border px-2 py-0.5 text-xs ${lvlCls[f.level]}`}>{lvl[f.level]}</span>{ar ? f.textAr || f.text : f.text}<Chips list={f.entryIds} /></li>)}</ul>}
          </div>
          {note && <p role="status" className="rounded-lg bg-muted p-2 text-xs">{note}</p>}
        </div>)}
      </div>
    </div>
  );
}
