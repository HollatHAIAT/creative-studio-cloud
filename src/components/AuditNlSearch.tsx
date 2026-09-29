import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { translateAuditSearch, type NlFilters } from "@/lib/settings-audit-qa.functions";

/** Admin describes a search in plain words; AI turns it into the Change history filters. */
export function AuditNlSearch({ apply, L, ar }: { apply: (f: { from: string; to: string; who: string; field: string }) => void; L: (e: string, a: string) => string; ar: boolean }) {
  const run = useServerFn(translateAuditSearch);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<NlFilters | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    if (text.trim().length < 3 || busy) return;
    setBusy(true); setErr(null); setRes(null);
    const d = new Date(); const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    try { const r = await run({ data: { text: text.trim(), today } }); if (r.error) setErr(r.error); else if (r.result) { setRes(r.result); apply(r.result); } }
    catch { setErr(L("Couldn't reach the assistant. Please try again.", "تعذّر الوصول إلى المساعد. حاول مجددًا.")); }
    finally { setBusy(false); }
  }
  return (
    <div className="mt-3">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void go(); }}>
        <label htmlFor="nl-audit" className="sr-only">{L("Describe what you're looking for", "صِف ما تبحث عنه")}</label>
        <input id="nl-audit" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder={L("Describe a search, e.g. return window changes last month", "صِف البحث، مثل: تغييرات مهلة الإرجاع الشهر الماضي")} className="w-full rounded-full border border-input bg-background px-4 py-1.5 text-sm" />
        <button disabled={busy || text.trim().length < 3} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"><Sparkles aria-hidden className="h-4 w-4" />{busy ? L("Finding…", "جارٍ البحث…") : L("Set filters", "اضبط الفلاتر")}</button>
      </form>
      <div aria-live="polite" className="mt-1 text-xs">
        {err && <p role="alert" className="text-destructive">{err}</p>}
        {res && <p className="text-muted-foreground">{ar ? res.explanationAr || res.explanation : res.explanation}{res.unmatched.length > 0 && <> {L("Not applied: ", "لم يُطبَّق: ")}{res.unmatched.join("، ")}</>}</p>}
      </div>
    </div>
  );
}
