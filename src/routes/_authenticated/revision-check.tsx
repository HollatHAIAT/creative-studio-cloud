import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { supabase } from "@/integrations/supabase/client";
import { checkRevisionAgainstNotes, type RevisionCheckResult } from "@/lib/policy-review.functions";
import { useLocale } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/revision-check")({
  head: () => ({ meta: [
    { title: "Revision check — Arwiqa أروقة" },
    { name: "description", content: "Check whether your revised listing addresses the moderator's notes before you resubmit." },
    { property: "og:title", content: "Revision check — Arwiqa" },
    { property: "og:description", content: "AI checks your revised listing against the moderator's requested changes." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: RevisionCheckPage,
});

const empty = { title: "", titleAr: "", description: "", descriptionAr: "", altText: "", altTextAr: "", tags: "" };
const AREA: Record<string, [string, string]> = { image: ["Image", "الصورة"], title: ["Title", "العنوان"], description: ["Description", "الوصف"], altText: ["Alt text", "النص البديل"], tags: ["Tags", "الوسوم"], other: ["Other", "أخرى"] };

function RevisionCheckPage() {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const check = useServerFn(checkRevisionAgainstNotes);
  const [notes, setNotes] = useState("");
  const [f, setF] = useState(empty);
  const [res, setRes] = useState<RevisionCheckResult | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");

  const drafts = useQuery({
    queryKey: ["my-drafts-with-notes"],
    queryFn: async () => (await supabase.from("listing_drafts").select("id,title,title_ar,description,description_ar,alt_text,alt_text_ar,tags,review_note,status").not("review_note", "is", null).order("updated_at", { ascending: false }).limit(30)).data ?? [],
  });

  function load(id: string) {
    const d = drafts.data?.find((x) => x.id === id); if (!d) return;
    setNotes(d.review_note ?? ""); setRes(null);
    setF({ title: d.title, titleAr: d.title_ar, description: d.description, descriptionAr: d.description_ar, altText: d.alt_text, altTextAr: d.alt_text_ar, tags: d.tags.join(", ") });
  }
  async function run() {
    if (busy) return; setBusy(true); setErr("");
    try {
      const r = await check({ data: { notes, ...f, tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20) } });
      if (r.error || !r.result) setErr(r.error ?? L("No assessment returned.", "لم يُرجع أي تقييم."));
      else setRes(r.result);
    } catch { setErr(L("Couldn't reach the AI. Try again.", "تعذّر الوصول إلى الذكاء الاصطناعي. حاول مجددًا.")); }
    finally { setBusy(false); }
  }
  const box = "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";
  const field = (k: keyof typeof empty, en: string, a: string, dir: "ltr" | "rtl", rows = 1) => (
    <label className="block text-sm">{L(en, a)}
      {rows > 1 ? <textarea dir={dir} lang={dir === "rtl" ? "ar" : "en"} rows={rows} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={box} />
        : <input dir={dir} lang={dir === "rtl" ? "ar" : "en"} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={box} />}
    </label>);
  const icon = (s: string) => s === "done" ? <CheckCircle2 aria-hidden className="h-4 w-4 text-success" /> : s === "partly" ? <CircleDashed aria-hidden className="h-4 w-4 text-warning" /> : <XCircle aria-hidden className="h-4 w-4 text-destructive" />;
  const statusLabel = (s: string) => ({ done: L("Done", "تم"), partly: L("Partly", "جزئيًا"), missing: L("Missing", "لم يُنفّذ") } as Record<string, string>)[s];
  const verdict = res && ({ addressed: L("All requested changes addressed", "نُفّذت كل التعديلات المطلوبة"), partly: L("Some changes still needed", "ما زالت بعض التعديلات مطلوبة"), not_addressed: L("Requested changes not addressed yet", "لم تُنفّذ التعديلات المطلوبة بعد") })[res.verdict];

  return (
    <SiteShell>
      <PageTitle eyebrow={L("Sellers", "البائعون")} title={L("Revision check", "فحص التعديلات المطلوبة")}
        sub={L("Paste the moderator's notes and your revised listing. The AI checks each requested change and suggests what's left before you resubmit.", "الصق ملاحظات المراجع وإعلانك المعدّل، ليفحص الذكاء الاصطناعي كل تعديل مطلوب ويقترح ما تبقّى قبل إعادة الإرسال.")} />
      <div className="mx-auto grid max-w-6xl gap-10 px-6 pb-16 lg:grid-cols-2">
        <div className="space-y-4">
          {(drafts.data?.length ?? 0) > 0 && (
            <label className="block text-sm">{L("Load from a reviewed draft", "حمّل من مسودة مُراجَعة")}
              <select defaultValue="" onChange={(e) => load(e.target.value)} className={box}>
                <option value="" disabled>{L("Choose a draft…", "اختر مسودة…")}</option>
                {drafts.data!.map((d) => <option key={d.id} value={d.id}>{(ar ? d.title_ar : d.title) || L("Untitled", "بدون عنوان")}</option>)}
              </select></label>)}
          <label className="block text-sm">{L("Moderator's decision notes", "ملاحظات قرار المراجع")}
            <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={6000} className={box} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("title", "Title (English)", "العنوان (إنجليزي)", "ltr")}{field("titleAr", "Title (Arabic)", "العنوان (عربي)", "rtl")}
            {field("description", "Description (English)", "الوصف (إنجليزي)", "ltr", 5)}{field("descriptionAr", "Description (Arabic)", "الوصف (عربي)", "rtl", 5)}
            {field("altText", "Alt text (English)", "النص البديل (إنجليزي)", "ltr", 2)}{field("altTextAr", "Alt text (Arabic)", "النص البديل (عربي)", "rtl", 2)}
          </div>
          {field("tags", "Tags (comma separated)", "الوسوم (مفصولة بفواصل)", ar ? "rtl" : "ltr")}
          <button onClick={run} disabled={busy || notes.trim().length < 5 || !(f.title || f.description || f.titleAr || f.descriptionAr)}
            className="rounded-md bg-primary px-5 py-2.5 text-sm text-primary-foreground disabled:opacity-50">{busy ? L("Checking…", "جارٍ الفحص…") : L("Check my revision", "افحص تعديلاتي")}</button>
          <div aria-live="polite">{err && <p role="alert" className="text-sm text-destructive">{err} <button onClick={run} className="underline">{L("Try again", "حاول مجددًا")}</button></p>}</div>
        </div>

        <section aria-live="polite" aria-label={L("Assessment", "التقييم")} className="space-y-4">
          {!res ? <p className="rounded-2xl border border-border p-6 text-sm text-muted-foreground">{L("Your assessment will appear here.", "سيظهر التقييم هنا.")}</p> : (<>
            <div className="rounded-2xl border border-border p-4">
              <p className="font-medium">{verdict}</p>
              <p dir="ltr" lang="en" className="mt-2 text-sm">{res.summary}</p>
              <p dir="rtl" lang="ar" className="mt-1 text-sm text-muted-foreground">{res.summaryAr}</p>
            </div>
            <h2 className="font-medium">{L("Requested changes", "التعديلات المطلوبة")}</h2>
            <ul className="space-y-2">{res.requests.map((r, i) => (
              <li key={i} className="rounded-xl bg-muted/50 p-3 text-sm">
                <span className="flex items-center gap-2 font-medium">{icon(r.status)}<span className="sr-only">{statusLabel(r.status)}:</span>{ar ? r.requestAr : r.request}</span>
                <span className="mt-1 block text-muted-foreground">{ar ? r.noteAr : r.note}</span>
              </li>))}</ul>
            {res.remaining.length > 0 && (<>
              <h2 className="font-medium">{L("Remaining edits", "التعديلات المتبقية")}</h2>
              <ol className="list-decimal space-y-2 ps-5 text-sm">{res.remaining.map((r, i) => (
                <li key={i}><span className="me-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{ar ? AREA[r.area]![1] : AREA[r.area]![0]}</span>{ar ? r.editAr : r.edit}</li>))}</ol>
            </>)}
            <p className="text-xs text-muted-foreground">{L("This is advice only — a moderator makes the final decision.", "هذا رأي استشاري فقط — القرار النهائي للمراجع.")} <Link to="/listing-writer" className="underline">{L("Edit and resubmit in the listing writer", "عدّل وأعد الإرسال من كاتب الإعلانات")}</Link></p>
          </>)}
        </section>
      </div>
    </SiteShell>
  );
}
