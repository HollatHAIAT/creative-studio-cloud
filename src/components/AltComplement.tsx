import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useLocale } from "@/lib/i18n";
import { complementAltText, type AltComplement as R } from "@/lib/listing-copy.functions";

/** AI alt-text revision that complements the listing title + description instead of repeating them. */
export function AltComplement({ path, alt, title, description, onUse }: { path: string | null; alt: string; title: string; description: string; onUse: (s: string) => void }) {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const run = useServerFn(complementAltText);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [r, setR] = useState<R | null>(null);
  const ready = !!path && title.trim().length > 0;
  async function go() {
    if (busy || !ready) return; setBusy(true); setErr(null);
    try { const x = await run({ data: { path: path!, altText: alt, title, description } }); if (x.error) setErr(x.error); else setR(x.result!); }
    catch (e) { setErr(e instanceof Error ? e.message : "Error"); } finally { setBusy(false); }
  }
  const pick = (en: string[], a: string[]) => (ar && a.length ? a : en);
  return (
    <section aria-labelledby="ac-h" className="space-y-3 rounded-sm border border-border p-4">
      <h2 id="ac-h" className="font-medium">{L("Revise to complement the listing copy", "راجِع ليُكمل نص الإعلان")}</h2>
      <p className="text-sm text-muted-foreground">{L("Screen readers read the alt text right before the title and description. The AI rewrites it to add what only the picture shows, without repeating the copy.", "تقرأ قارئات الشاشة النص البديل قبل العنوان والوصف مباشرة. يعيد الذكاء الاصطناعي كتابته ليضيف ما تُظهره الصورة وحدها دون تكرار النص.")}</p>
      {!ready && <p className="text-sm text-warning">{L("Add an image and a listing title first.", "أضف صورة وعنوان الإعلان أولاً.")}</p>}
      <button type="button" onClick={go} disabled={busy || !ready} aria-busy={busy} className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
        {busy ? L("Revising…", "جارٍ المراجعة…") : r ? L("Suggest again", "اقترح مجدداً") : L("Suggest complementary alt text", "اقترح نصاً بديلاً مكمّلاً")}</button>
      <div aria-live="polite" className="space-y-3">
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        {r && (<>
          {([["English", r.revision, "ltr"], ["العربية", r.revisionAr, "rtl"]] as const).filter(([, s]) => s).map(([label, s, dir]) => (
            <div key={label} className="rounded-lg bg-muted/40 p-3">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span>
                <span className={s.length > 140 ? "text-destructive" : ""}>{s.length} / 140</span></div>
              <p dir={dir}>{s}</p>
              <div className="mt-2 flex gap-3 text-sm">
                <button type="button" className="underline" onClick={() => onUse(s)}>{L("Use as current alt text", "استخدمه كنص حالي")}</button>
                <button type="button" className="underline" onClick={() => { void navigator.clipboard.writeText(s); toast.success(L("Copied", "نُسخ")); }}>{L("Copy", "نسخ")}</button>
              </div>
            </div>))}
          {(ar ? r.rationaleAr || r.rationale : r.rationale) && <p className="text-sm">{ar ? r.rationaleAr || r.rationale : r.rationale}</p>}
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div><h3 className="mb-1 text-xs font-medium text-muted-foreground">{L("Repeated the listing copy", "كرّر نص الإعلان")}</h3>
              {r.repeats.length ? <ul className="flex flex-wrap gap-1">{pick(r.repeats, r.repeatsAr).map((x, i) => <li key={i} className="rounded-full bg-destructive/10 px-2 py-0.5 text-destructive line-through">{x}</li>)}</ul>
                : <p className="text-success">{L("No repetition found", "لا تكرار")}</p>}</div>
            <div><h3 className="mb-1 text-xs font-medium text-muted-foreground">{L("What the revision adds", "ما تضيفه المراجعة")}</h3>
              <ul className="list-disc space-y-0.5 ps-4">{pick(r.adds, r.addsAr).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          </div>
        </>)}
      </div>
    </section>
  );
}
