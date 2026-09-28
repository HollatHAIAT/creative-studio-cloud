import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";
import { draftReviewerChecklist, type ReviewerChecklist as RC } from "@/lib/reviewer-checklist.functions";

const PR: Record<string, [string, string, string]> = {
  high: ["High", "عالية", "bg-destructive/10 text-destructive"],
  medium: ["Medium", "متوسطة", "bg-warning/15 text-warning"],
  low: ["Low", "منخفضة", "bg-muted text-muted-foreground"],
};
const FIELD: Record<string, [string, string]> = {
  image: ["Image", "الصورة"], title: ["Title", "العنوان"], description: ["Description", "الوصف"], altText: ["Alt text", "النص البديل"],
  tags: ["Tags", "الوسوم"], price: ["Price", "السعر"], medium: ["Medium", "الوسيط"], general: ["General", "عام"],
};

/** Invited reviewer: free-text comments → AI prioritised seller checklist, editable, then sent to the artist as a comment. */
export function ReviewerChecklist({ draftId, onSent }: { draftId: string; onSent: () => void }) {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const run = useServerFn(draftReviewerChecklist);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<RC | null>(null);
  const [keep, setKeep] = useState<boolean[]>([]);
  const [sending, setSending] = useState(false);

  async function go() {
    if (busy || notes.trim().length < 10) return; setBusy(true); setErr(null);
    try { const r = await run({ data: { draftId, comments: notes } }); if (r.error) setErr(r.error); else { setRes(r.checklist!); setKeep(r.checklist!.items.map(() => true)); } }
    catch (e) { setErr(e instanceof Error ? e.message : "Error"); } finally { setBusy(false); }
  }
  const text = () => {
    if (!res) return "";
    const items = res.items.filter((_, i) => keep[i]);
    const en = [res.summary, ...items.map((x, i) => `${i + 1}. [${PR[x.priority]?.[0] ?? x.priority} · ${FIELD[x.field]?.[0] ?? x.field}] ${x.action}${x.why ? ` — ${x.why}` : ""}`)].filter(Boolean).join("\n");
    const arT = [res.summaryAr, ...items.map((x, i) => `${i + 1}. [${PR[x.priority]?.[1] ?? x.priority} · ${FIELD[x.field]?.[1] ?? x.field}] ${x.actionAr || x.action}${x.whyAr ? ` — ${x.whyAr}` : ""}`)].filter(Boolean).join("\n");
    return `${L("Revision checklist", "قائمة التعديلات")}\n\n${en}\n\n${arT}`.slice(0, 2000);
  };
  async function send() {
    if (sending) return; setSending(true);
    const sb = supabase as any;
    const rows = res!.items.filter((_, i) => keep[i]).map((x) => ({ draft_id: draftId, priority: ["high", "medium", "low"].includes(x.priority) ? x.priority : "medium",
      field: x.field, action: x.action.slice(0, 500), action_ar: x.actionAr.slice(0, 500), why: x.why.slice(0, 500), why_ar: x.whyAr.slice(0, 500) }));
    const { error } = await sb.from("revision_checklist_items").insert(rows);
    if (!error) await sb.from("listing_review_comments").insert({ draft_id: draftId, body: text(), visibility: "artist" });
    setSending(false);
    if (error) { toast.error(L("Couldn't send — your invitation may not allow comments.", "تعذّر الإرسال — قد لا تسمح دعوتك بالتعليق.")); return; }
    setRes(null); setNotes("");
    toast.success(L("Checklist sent to the artist", "أُرسلت القائمة إلى الفنان")); onSent();
  }

  return (
    <section aria-labelledby={`rc-${draftId}`} className="space-y-2 rounded-xl border border-border p-3">
      <h3 id={`rc-${draftId}`} className="font-medium">{L("AI: turn my notes into a checklist for the artist", "ذكاء اصطناعي: حوّل ملاحظاتي إلى قائمة للفنان")}</h3>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={5000} aria-label={L("Your notes", "ملاحظاتك")}
        placeholder={L("Write freely — what works, what's unclear, what should change…", "اكتب بحرية — ما الجيد، وما غير الواضح، وما يجب تغييره…")} className="w-full rounded-lg border border-input bg-background px-3 py-2" />
      <button type="button" onClick={go} disabled={busy || notes.trim().length < 10} aria-busy={busy} className="rounded-full bg-primary px-4 py-1.5 text-primary-foreground disabled:opacity-50">
        {busy ? L("Writing checklist…", "جارٍ إعداد القائمة…") : res ? L("Rewrite checklist", "أعد إعداد القائمة") : L("Make checklist", "أعدّ القائمة")}
      </button>
      <div aria-live="polite">
        {err && <p role="alert" className="text-destructive">{err} <button type="button" className="underline" onClick={go}>{L("Try again", "حاول مجددًا")}</button></p>}
        {res && (
          <div className="space-y-2">
            {(ar ? res.summaryAr || res.summary : res.summary) && <p>{ar ? res.summaryAr || res.summary : res.summary}</p>}
            {res.items.length === 0 ? <p className="text-muted-foreground">{L("Nothing actionable found in your notes.", "لا توجد نقاط قابلة للتنفيذ في ملاحظاتك.")}</p> : (
              <ol className="space-y-2">{res.items.map((x, i) => (
                <li key={i} className={`rounded-lg bg-muted/40 p-2 ${keep[i] ? "" : "opacity-50"}`}>
                  <label className="flex items-start gap-2">
                    <input type="checkbox" checked={!!keep[i]} onChange={() => setKeep(keep.map((k, j) => (j === i ? !k : k)))} className="mt-1" aria-label={L("Include this item", "ضمّن هذا البند")} />
                    <span>
                      <span className={`me-2 rounded-full px-2 py-0.5 text-xs ${PR[x.priority]?.[2] ?? PR["medium"]![2]}`}>{L(...((PR[x.priority] ?? PR["medium"]!).slice(0, 2) as [string, string]))}</span>
                      <span className="text-xs text-muted-foreground">{L(...(FIELD[x.field] ?? FIELD["general"]!))}</span>
                      <span className="block font-medium">{ar ? x.actionAr || x.action : x.action}</span>
                      {(x.why || x.whyAr) && <span className="block text-muted-foreground">{ar ? x.whyAr || x.why : x.why}</span>}
                    </span>
                  </label>
                </li>))}</ol>)}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={send} disabled={sending || !keep.some(Boolean)} className="rounded-full bg-primary px-4 py-1.5 text-primary-foreground disabled:opacity-50">{sending ? "…" : L("Send to artist", "أرسل إلى الفنان")}</button>
              <button type="button" onClick={() => { void navigator.clipboard.writeText(text()); toast.success(L("Copied", "نُسخ")); }} className="rounded-full border border-border px-4 py-1.5">{L("Copy", "نسخ")}</button>
            </div>
            <p className="text-xs text-muted-foreground">{L("Only your own notes are used. Untick anything you don't want to send.", "تُستخدم ملاحظاتك فقط. ألغِ تحديد ما لا تريد إرساله.")}</p>
          </div>)}
      </div>
    </section>
  );
}
