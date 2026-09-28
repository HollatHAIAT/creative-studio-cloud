import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Send, Copy } from "lucide-react";
import { draftRevisionGuidance, sendRevisionGuidance, type RevisionGuidance as G } from "@/lib/policy-review.functions";
import { useLocale } from "@/lib/i18n";

const AREA: Record<string, [string, string]> = { image: ["Image", "الصورة"], title: ["Title", "العنوان"], description: ["Description", "الوصف"], altText: ["Alt text", "النص البديل"], tags: ["Tags", "الوسوم"], pricing: ["Pricing", "السعر"], other: ["Other", "أخرى"] };

/** Moderator tool: AI drafts seller-facing revision guidance from a rejection and its notes. */
export function RevisionGuidance({ draftId, initialNotes }: { draftId: string; initialNotes: string }) {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const qc = useQueryClient();
  const draft = useServerFn(draftRevisionGuidance); const send = useServerFn(sendRevisionGuidance);
  const [notes, setNotes] = useState(initialNotes);
  const [g, setG] = useState<G | null>(null);
  const [msg, setMsg] = useState(""); const [msgAr, setMsgAr] = useState("");
  const [busy, setBusy] = useState<"draft" | "send" | null>(null);
  const [err, setErr] = useState("");

  async function run() {
    if (busy) return; setBusy("draft"); setErr("");
    try {
      const r = await draft({ data: { draftId, notes } });
      if (r.error || !r.guidance) { setErr(r.error ?? L("No guidance returned.", "لم تُرجع أي إرشادات.")); return; }
      setG(r.guidance); setMsg(r.guidance.message); setMsgAr(r.guidance.messageAr);
    } catch { setErr(L("Couldn't reach the AI. Try again.", "تعذّر الوصول إلى الذكاء الاصطناعي. حاول مجددًا.")); }
    finally { setBusy(null); }
  }
  async function deliver() {
    if (busy || !g) return; setBusy("send"); setErr("");
    const steps = g.steps.map((s, i) => `${i + 1}. ${s.action}`).join("\n");
    const stepsAr = g.steps.map((s, i) => `${i + 1}. ${s.actionAr}`).join("\n");
    try {
      const r = await send({ data: { draftId, message: `${msg}\n\n${steps}`, messageAr: `${msgAr}\n\n${stepsAr}` } });
      if (r.error) { setErr(r.error); return; }
      toast.success(L("Guidance sent to the seller", "أُرسلت الإرشادات إلى البائع"));
      qc.invalidateQueries({ queryKey: ["admin", "listing-drafts"] });
    } catch { setErr(L("Couldn't send. Try again.", "تعذّر الإرسال. حاول مجددًا.")); }
    finally { setBusy(null); }
  }
  const box = "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";

  return (
    <section aria-labelledby="rg-h" className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <h3 id="rg-h" className="flex items-center gap-2 font-medium"><Sparkles className="h-4 w-4 text-primary" />{L("Revision guidance for the seller", "إرشادات التعديل للبائع")}</h3>
      <label className="block text-sm">{L("Decision notes", "ملاحظات القرار")}
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} className={box} /></label>
      <button onClick={run} disabled={!!busy || notes.trim().length < 5} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
        <Sparkles className="h-4 w-4" />{busy === "draft" ? L("Drafting…", "جارٍ الصياغة…") : g ? L("Draft again", "صِغ مجددًا") : L("Draft guidance", "صِغ الإرشادات")}</button>
      <div aria-live="polite">{err && <p role="alert" className="text-sm text-destructive">{err}</p>}</div>

      {g && (
        <div className="space-y-4">
          <p className="text-sm"><span dir="ltr" lang="en" className="block">{g.summary}</span><span dir="rtl" lang="ar" className="mt-1 block text-muted-foreground">{g.summaryAr}</span></p>
          <ol className="space-y-3">
            {g.steps.map((s, i) => (
              <li key={i} className="rounded-xl bg-muted/50 p-3 text-sm">
                <span className="me-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{ar ? AREA[s.area]![1] : AREA[s.area]![0]}</span>
                <span dir="ltr" lang="en" className="mt-1 block">{i + 1}. {s.action}</span>
                <span dir="rtl" lang="ar" className="mt-1 block">{s.actionAr}</span>
                {(s.example || s.exampleAr) && <span className="mt-2 block border-s-2 border-primary/40 ps-2 text-xs text-muted-foreground">{s.example && <span dir="ltr" lang="en" className="block">{s.example}</span>}{s.exampleAr && <span dir="rtl" lang="ar" className="block">{s.exampleAr}</span>}</span>}
              </li>))}
          </ol>
          <label className="block text-sm">{L("Message to seller (English)", "رسالة للبائع (إنجليزي)")}<textarea dir="ltr" lang="en" value={msg} onChange={(e) => setMsg(e.target.value)} rows={4} className={box} /></label>
          <label className="block text-sm">{L("Message to seller (Arabic)", "رسالة للبائع (عربي)")}<textarea dir="rtl" lang="ar" value={msgAr} onChange={(e) => setMsgAr(e.target.value)} rows={4} className={box} /></label>
          <div className="flex flex-wrap gap-2">
            <button onClick={deliver} disabled={!!busy || msg.trim().length < 5 || msgAr.trim().length < 5} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" />{busy === "send" ? L("Sending…", "جارٍ الإرسال…") : L("Send to seller", "أرسل للبائع")}</button>
            <button onClick={() => { void navigator.clipboard.writeText(`${msg}\n\n${msgAr}`); toast.success(L("Copied", "تم النسخ")); }} className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm"><Copy className="h-4 w-4" />{L("Copy", "نسخ")}</button>
          </div>
          <p className="text-xs text-muted-foreground">{L("AI draft — check and edit before sending. Sending replaces the reviewer note the seller sees and notifies them.", "مسودة آلية — راجعها وعدّلها قبل الإرسال. الإرسال يستبدل ملاحظة المراجع ويُبلغ البائع.")}</p>
        </div>)}
    </section>
  );
}
