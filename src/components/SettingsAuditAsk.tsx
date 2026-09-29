import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ScrollText } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { askSettingsAudit, type AuditAnswer } from "@/lib/settings-audit-qa.functions";

/** Admins ask about setting changes; AI answers only from the audit log. */
export function SettingsAuditAsk() {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const ask = useServerFn(askSettingsAudit);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<AuditAnswer | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const examples = [L("Who changed the return window last month?", "من غيّر مهلة الإرجاع الشهر الماضي؟"), L("Were any changes reverted?", "هل أُلغيت أي تغييرات؟"), L("Summarize license price changes", "لخّص تغييرات أسعار التراخيص")];
  const [note, setNote] = useState<string | null>(null);
  const n = (x: number) => x.toLocaleString(ar ? "ar-SA" : "en-US");
  function jump(id: string) {
    const el = document.getElementById(`audit-${id}`);
    if (!el) { setNote(L("That entry isn't on the current Change history page. Use the filters or pages below to find it by its date and setting.", "هذا السجل ليس في الصفحة الحالية من سجل التغييرات. استخدم الفلاتر أو الصفحات أدناه للوصول إليه بتاريخه وإعداده.")); return; }
    setNote(null); el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("bg-accent"); setTimeout(() => el.classList.remove("bg-accent"), 2000);
  }
  const Chips = ({ ids }: { ids: string[] }) => !res || ids.length === 0 ? null : (
    <div className="mt-2 flex flex-wrap gap-1 text-xs"><span className="text-muted-foreground">{L("Evidence:", "الدليل:")}</span>{ids.map((id) => { const e = res.evidence[id]; return e ? (
      <button key={id} type="button" onClick={() => jump(id)} title={`${e.who} · ${id}`} className="rounded-full border border-border bg-background px-2 py-0.5 hover:border-primary">
        #{n(e.n)} · {e.field} · {e.from ?? "—"} → {e.to ?? "—"} · {e.who} · {new Date(e.created_at).toLocaleDateString(ar ? "ar-SA" : "en-GB")}
      </button>) : null; })}</div>);

  async function submit(question: string) {
    if (question.trim().length < 3 || busy) return;
    setBusy(true); setErr(null); setRes(null); setNote(null);
    try { const r = await ask({ data: { question: question.trim() } }); if (r.error) setErr(r.error); else setRes(r.result ?? null); }
    catch { setErr(L("Couldn't reach the assistant. Please try again.", "تعذّر الوصول إلى المساعد. حاول مجددًا.")); }
    finally { setBusy(false); }
  }

  return (
    <section aria-labelledby="sa-h" className="mx-auto mt-12 max-w-4xl rounded-2xl border border-border p-5 mx-6 md:mx-auto">
      <h2 id="sa-h" className="flex items-center gap-2 font-display text-2xl"><ScrollText aria-hidden className="h-5 w-5 text-primary" />{L("Ask about setting changes", "اسأل عن تغييرات الإعدادات")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{L("AI summarizes matching entries from the change history and points out patterns. It only uses the log.", "يلخّص الذكاء الاصطناعي السجلات المطابقة من سجل التغييرات ويبرز الأنماط، ويعتمد على السجل فقط.")}</p>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void submit(q); }}>
        <label htmlFor="sa-q" className="sr-only">{L("Your question", "سؤالك")}</label>
        <input id="sa-q" value={q} onChange={(e) => setQ(e.target.value)} maxLength={800} placeholder={L("e.g. What changed this week?", "مثال: ما الذي تغيّر هذا الأسبوع؟")} className="w-full rounded-full border border-input bg-background px-4 py-2 text-sm" />
        <button disabled={busy || q.trim().length < 3} className="shrink-0 rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground disabled:opacity-50">{busy ? L("Thinking…", "جارٍ التفكير…") : L("Ask", "اسأل")}</button>
      </form>
      <div className="mt-2 flex flex-wrap gap-2">{examples.map((x) => <button key={x} type="button" onClick={() => { setQ(x); void submit(x); }} className="rounded-full border border-border px-3 py-1 text-xs hover:border-primary">{x}</button>)}</div>
      <div aria-live="polite" className="mt-4 text-sm">
        {err && <p role="alert" className="text-destructive">{err}</p>}
        {res && (<>
          <p className="text-xs text-muted-foreground">{L(`Searched ${n(res.searched)} of ${n(res.total)} recorded changes.`, `بُحث في ${n(res.searched)} من ${n(res.total)} تغييرًا مسجّلًا.`)}</p>
          <p className="mt-1 leading-relaxed">{ar ? res.summaryAr || res.summary : res.summary}</p>
          <Chips ids={res.summaryIds} />
          {res.patterns.length > 0 && <div className="mt-4"><p className="font-medium">{L("Patterns", "الأنماط")}</p><ul className="mt-1 space-y-2">{res.patterns.map((p, i) => <li key={i} className="rounded-lg bg-muted p-3"><p>{ar ? p.patternAr || p.pattern : p.pattern}</p>{p.evidence && <p className="mt-1 text-xs text-muted-foreground">{ar ? p.evidenceAr || p.evidence : p.evidence}</p>}<Chips ids={p.entryIds} /></li>)}</ul></div>}
          {res.entries.length > 0 && <div className="mt-4"><p className="font-medium">{L("Relevant entries", "السجلات ذات الصلة")}</p><ul className="mt-1 space-y-2">{res.entries.map((e) => <li key={e.id}><Chips ids={[e.id]} /><p className="mt-1 text-xs text-muted-foreground">{ar ? e.whyAr || e.why : e.why}</p></li>)}</ul></div>}
          {note && <p role="status" className="mt-3 rounded-lg bg-muted p-2 text-xs">{note}</p>}
        </>)}
      </div>
    </section>
  );
}
