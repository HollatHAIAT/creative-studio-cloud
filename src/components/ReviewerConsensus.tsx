import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";
import { analyseReviewerResponses, type ReviewerConsensus as RC } from "@/lib/reviewer-consensus.functions";

const sb = supabase as any;
const PR: Record<string, [string, string, string]> = {
  high: ["High", "عالية", "bg-destructive/10 text-destructive"],
  medium: ["Medium", "متوسطة", "bg-warning/15 text-warning"],
  low: ["Low", "منخفضة", "bg-muted text-muted-foreground"],
};
const FIELD: Record<string, [string, string]> = {
  image: ["Image", "الصورة"], title: ["Title", "العنوان"], description: ["Description", "الوصف"], altText: ["Alt text", "النص البديل"],
  tags: ["Tags", "الوسوم"], price: ["Price", "السعر"], medium: ["Medium", "الوسيط"], provenance: ["Provenance", "المصدر"], general: ["General", "عام"],
};

/** Staff: combine reviewers' written responses into shared concerns and prioritised changes. */
export function ReviewerConsensus({ draftId }: { draftId: string }) {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const run = useServerFn(analyseReviewerResponses);
  const [list, setList] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<RC | null>(null);

  async function loadComments() {
    const { data, error } = await sb.from("listing_review_comments").select("author,body").eq("draft_id", draftId).neq("visibility", "internal").order("created_at");
    if (error) { toast.error(L("Couldn't load reviewer comments.", "تعذّر تحميل تعليقات المراجعين.")); return; }
    const by = new Map<string, string[]>();
    for (const c of data ?? []) by.set(c.author, [...(by.get(c.author) ?? []), c.body]);
    const out = [...by.values()].map((v) => v.join("\n\n").slice(0, 3000));
    if (!out.length) { toast.info(L("No reviewer comments on this listing yet.", "لا توجد تعليقات مراجعين على هذا الإعلان بعد.")); return; }
    setList(out.slice(0, 20));
  }
  const filled = list.map((x) => x.trim()).filter((x) => x.length >= 3);
  async function go() {
    if (busy || !filled.length) return; setBusy(true); setErr(null);
    try { const r = await run({ data: { draftId, responses: filled } }); if (r.error) setErr(r.error); else setRes(r.result!); }
    catch (e) { setErr(e instanceof Error ? e.message : "Error"); } finally { setBusy(false); }
  }
  const copy = () => {
    if (!res) return;
    const t = res.changes.map((c, i) => `${i + 1}. [${PR[c.priority]?.[0] ?? c.priority}] ${c.action}${c.why ? ` — ${c.why}` : ""}\n   ${c.actionAr}`).join("\n");
    void navigator.clipboard.writeText(`${res.summary}\n${res.summaryAr}\n\n${t}`); toast.success(L("Copied", "نُسخ"));
  };

  return (
    <section aria-labelledby={`rcn-${draftId}`} className="space-y-3 rounded-2xl border border-border p-4">
      <h3 id={`rcn-${draftId}`} className="flex items-center gap-2 font-medium"><Users aria-hidden className="h-4 w-4 text-primary" />{L("AI: shared reviewer concerns & priority changes", "ذكاء اصطناعي: المخاوف المشتركة للمراجعين والتعديلات ذات الأولوية")}</h3>
      <p className="text-sm text-muted-foreground">{L("Add each reviewer's written response (one box per reviewer), or load the comments already on this listing.", "أضف رد كل مراجع (مربع لكل مراجع)، أو حمّل التعليقات الموجودة على هذا الإعلان.")}</p>
      <button type="button" onClick={loadComments} className="rounded-full border border-border px-3 py-1 text-sm">{L("Load reviewer comments", "حمّل تعليقات المراجعين")}</button>
      <ol className="space-y-2">{list.map((v, i) => (
        <li key={i} className="flex gap-2">
          <textarea value={v} onChange={(e) => setList(list.map((x, j) => (j === i ? e.target.value : x)))} rows={3} maxLength={3000}
            aria-label={L(`Reviewer ${i + 1} response`, `رد المراجع ${i + 1}`)} placeholder={L(`Reviewer ${i + 1}`, `المراجع ${i + 1}`)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          {list.length > 1 && <button type="button" onClick={() => setList(list.filter((_, j) => j !== i))} aria-label={L("Remove response", "احذف الرد")} className="self-start rounded-full p-2 text-muted-foreground hover:text-destructive"><Trash2 aria-hidden className="h-4 w-4" /></button>}
        </li>))}</ol>
      <div className="flex flex-wrap gap-2">
        {list.length < 20 && <button type="button" onClick={() => setList([...list, ""])} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-sm"><Plus aria-hidden className="h-3.5 w-3.5" />{L("Add reviewer", "أضف مراجعًا")}</button>}
        <button type="button" onClick={go} disabled={busy || !filled.length} aria-busy={busy} className="rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50">
          {busy ? L("Analysing…", "جارٍ التحليل…") : res ? L("Analyse again", "حلّل مجددًا") : L("Find shared concerns", "اعثر على المخاوف المشتركة")}
        </button>
      </div>
      <div aria-live="polite" className="space-y-3">
        {err && <p role="alert" className="text-sm text-destructive">{err} <button type="button" className="underline" onClick={go}>{L("Try again", "حاول مجددًا")}</button></p>}
        {res && (<>
          <p className="text-sm">{ar ? res.summaryAr || res.summary : res.summary}</p>
          {res.shared.length > 0 && (<>
            <h4 className="text-sm font-medium">{L("Shared concerns", "المخاوف المشتركة")}</h4>
            <ul className="space-y-2">{res.shared.map((s, i) => (
              <li key={i} className="rounded-lg bg-muted/40 p-2 text-sm">
                <span className="me-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{L(`${s.reviewers} reviewer${s.reviewers === 1 ? "" : "s"}`, `${s.reviewers} مراجع`)}</span>
                <span className="text-xs text-muted-foreground">{L(...(FIELD[s.field] ?? FIELD["general"]!))}</span>
                <span className="block font-medium">{ar ? s.concernAr || s.concern : s.concern}</span>
                {s.quote && <q className="block text-muted-foreground">{s.quote}</q>}
              </li>))}</ul>
          </>)}
          {res.disagreements.length > 0 && (<>
            <h4 className="text-sm font-medium">{L("Where reviewers disagree", "نقاط الخلاف بين المراجعين")}</h4>
            <ul className="list-disc space-y-1 ps-5 text-sm">{res.disagreements.map((x, i) => <li key={i}>{ar ? x.topicAr || x.topic : x.topic}</li>)}</ul>
          </>)}
          {res.changes.length > 0 && (<>
            <h4 className="text-sm font-medium">{L("Prioritised changes", "التعديلات حسب الأولوية")}</h4>
            <ol className="space-y-2">{res.changes.map((c, i) => { const p = PR[c.priority] ?? PR["medium"]!; return (
              <li key={i} className="rounded-lg bg-muted/40 p-2 text-sm">
                <span className={`me-2 rounded-full px-2 py-0.5 text-xs ${p[2]}`}>{L(p[0], p[1])}</span>
                <span className="text-xs text-muted-foreground">{L(...(FIELD[c.field] ?? FIELD["general"]!))}</span>
                <span className="block font-medium">{ar ? c.actionAr || c.action : c.action}</span>
                {(c.why || c.whyAr) && <span className="block text-muted-foreground">{ar ? c.whyAr || c.why : c.why}</span>}
              </li>); })}</ol>
            <button type="button" onClick={copy} className="rounded-full border border-border px-3 py-1 text-sm">{L("Copy changes", "انسخ التعديلات")}</button>
          </>)}
          <p className="text-xs text-muted-foreground">{L("Advice only, based on the reviewers' words. You make the decision.", "رأي استشاري فقط، مبني على كلام المراجعين. القرار لك.")}</p>
        </>)}
      </div>
    </section>
  );
}
