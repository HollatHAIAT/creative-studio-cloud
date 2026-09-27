import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ImagePlus, Trash2, Copy as CopyIcon, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { ActionButton, useAction } from "@/components/ActionButton";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";
import { suggestSearchTerms, type SearchTerms } from "@/lib/listing-copy.functions";

export const Route = createFileRoute("/_authenticated/search-terms")({
  head: () => ({ meta: [
    { title: "Buyer search terms & tags — Arwiqa أروقة" },
    { name: "description", content: "Find the words buyers will search for your artwork and get suggested bilingual tags." },
    { property: "og:title", content: "Buyer search terms & tags — Arwiqa" },
    { property: "og:description", content: "AI-suggested search phrases and tags for artwork listings in Arabic and English." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: SearchTermsPage,
});

const MAX = 10 * 1024 * 1024;

function SearchTermsPage() {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const L = (en: string, a: string) => (ar ? a : en);
  const suggest = useServerFn(suggestSearchTerms);
  const [path, setPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [result, setResult] = useState<SearchTerms | null>(null);
  const [err, setErr] = useState("");

  const upload = useAction(async (file: File) => {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error(L("Please choose a PNG, JPG, WEBP or GIF image.", "اختر صورة PNG أو JPG أو WEBP أو GIF."));
    if (file.size > MAX) throw new Error(L("Image is larger than 10 MB.", "حجم الصورة أكبر من 10 ميجابايت."));
    const { data: u } = await supabase.auth.getUser();
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const p = `${u.user!.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("artwork-images").upload(p, file, { contentType: file.type });
    if (error) throw new Error(L("Upload failed, please try again.", "فشل الرفع، حاول مجدداً."));
    if (path) await supabase.storage.from("artwork-images").remove([path]);
    setPath(p); setPreview(URL.createObjectURL(file));
  });

  const run = useAction(async () => {
    setErr("");
    const r = await suggest({ data: { path, title, description: desc, existingTags: tags } });
    if (r.error || !r.result) { setErr(r.error ?? ""); throw new Error(r.error); }
    setResult(r.result);
  });

  const removeImage = async () => { if (path) await supabase.storage.from("artwork-images").remove([path]); setPath(null); setPreview(null); };
  const addTag = (t: string) => { const v = t.trim().toLowerCase(); if (v && !tags.includes(v) && tags.length < 30) setTags([...tags, v]); };
  const copyText = async (s: string) => { await navigator.clipboard.writeText(s); toast.success(L("Copied", "تم النسخ")); };
  const canRun = !!path || !!title.trim() || !!desc.trim();

  return (
    <SiteShell>
      <PageTitle eyebrow={L("Seller tools", "أدوات البائع")} title={L("Buyer search terms & tags", "كلمات بحث المشترين والوسوم")}
        sub={L("Add your artwork photo and listing copy. The AI predicts what buyers will search for and suggests tags so they find it.", "أضف صورة عملك ونص الإعلان. يتوقع الذكاء الاصطناعي ما سيبحث عنه المشترون ويقترح وسوماً ليجدوه.")} />
      <div className="mx-auto grid max-w-6xl gap-8 px-6 pb-16 lg:grid-cols-2">
        <section className="space-y-4">
          {preview ? (
            <figure className="relative overflow-hidden rounded-sm border border-border bg-card">
              <img src={preview} alt={title || L("Your uploaded artwork", "العمل الذي رفعته")} className="max-h-[360px] w-full object-contain" />
              <button type="button" onClick={removeImage} aria-label={L("Remove image", "إزالة الصورة")} className="absolute end-2 top-2 rounded-sm bg-background/90 p-2"><Trash2 className="h-4 w-4" /></button>
            </figure>
          ) : (
            <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed border-border bg-card text-center text-muted-foreground hover:border-primary focus-within:border-primary">
              <ImagePlus className="h-8 w-8" aria-hidden />
              <span className="font-medium text-foreground">{upload.busy ? L("Uploading…", "جارٍ الرفع…") : L("Choose an artwork photo", "اختر صورة العمل")}</span>
              <span className="text-sm">PNG, JPG, WEBP, GIF · {L("up to 10 MB", "حتى 10 ميجابايت")}</span>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" disabled={upload.busy}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.run(f); e.target.value = ""; }} />
            </label>
          )}
          {upload.state === "error" && <p role="alert" className="text-sm text-destructive">{(upload.error as Error)?.message}</p>}
          <label className="block text-sm">{L("Title", "العنوان")}
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="mt-1 w-full rounded-sm border border-border bg-background px-3 py-2" />
          </label>
          <label className="block text-sm">{L("Description", "الوصف")}
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={4000} rows={5} className="mt-1 w-full rounded-sm border border-border bg-background px-3 py-2" />
          </label>
          <div className="text-sm">
            <label htmlFor="tag-in">{L("Current tags", "الوسوم الحالية")}</label>
            <div className="mt-1 flex gap-2">
              <input id="tag-in" value={tagInput} onChange={(e) => setTagInput(e.target.value)} maxLength={40}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); setTagInput(""); } }}
                placeholder={L("Type a tag and press Enter", "اكتب وسماً واضغط Enter")} className="flex-1 rounded-sm border border-border bg-background px-3 py-2" />
            </div>
            <ul className="mt-2 flex flex-wrap gap-2">{tags.map((t) => (
              <li key={t} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1">#{t}
                <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={L(`Remove ${t}`, `إزالة ${t}`)}><X className="h-3 w-3" /></button></li>
            ))}</ul>
          </div>
          <ActionButton state={run.state} disabled={!canRun} onClick={() => run.run()} onRetry={run.retry}
            loadingLabel={L("Finding search terms…", "جارٍ إيجاد كلمات البحث…")} successLabel={L("Suggestions ready", "الاقتراحات جاهزة")}
            errorLabel={err || L("Couldn't get suggestions.", "تعذّر الحصول على الاقتراحات.")} retryLabel={L("Try again", "حاول مجدداً")}
            className="w-full rounded-sm bg-primary px-5 py-3 text-primary-foreground">
            {L("Suggest search terms & tags", "اقترح كلمات البحث والوسوم")}
          </ActionButton>
        </section>

        <section aria-live="polite" className="space-y-6">
          {!result ? (
            <p className="rounded-sm border border-border p-6 text-muted-foreground">{L("Likely buyer searches and suggested tags will appear here.", "ستظهر عمليات البحث المتوقعة والوسوم المقترحة هنا.")}</p>
          ) : (
            <>
              <p>{ar ? result.summaryAr : result.summary}</p>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-medium">{L("Likely buyer searches", "عمليات البحث المتوقعة")}</h2>
                  <button type="button" onClick={() => copyText(result.terms.map((t) => (ar ? t.termAr : t.term)).join("\n"))} className="inline-flex items-center gap-1 text-sm underline"><CopyIcon className="h-3 w-3" aria-hidden />{L("Copy all", "نسخ الكل")}</button>
                </div>
                <ul className="divide-y divide-border rounded-sm border border-border">{result.terms.map((t) => (
                  <li key={t.term} className="flex flex-wrap items-baseline justify-between gap-2 p-3">
                    <span><span dir="ltr">{t.term}</span> · <span dir="rtl">{t.termAr}</span></span>
                    <span className="text-xs text-muted-foreground">{ar ? t.intentAr : t.intent}</span>
                  </li>
                ))}</ul>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-medium">{L("Suggested tags", "الوسوم المقترحة")}</h2>
                  <button type="button" onClick={() => result.tags.forEach((t) => addTag(t.tag))} className="text-sm underline">{L("Add all to my tags", "أضف الكل إلى وسومي")}</button>
                </div>
                <ul className="space-y-2">{result.tags.map((t) => {
                  const added = tags.includes(t.tag.toLowerCase());
                  return (
                    <li key={t.tag} className="flex items-start justify-between gap-3 rounded-sm border border-border p-3">
                      <div><p className="font-medium">#{t.tag} · <span dir="rtl">{t.tagAr}</span></p><p className="text-sm text-muted-foreground">{ar ? t.reasonAr : t.reason}</p></div>
                      <button type="button" disabled={added} onClick={() => addTag(t.tag)} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1 text-sm disabled:opacity-50">
                        <Plus className="h-3 w-3" aria-hidden />{added ? L("Added", "أضيف") : L("Add", "أضف")}
                      </button>
                    </li>
                  );
                })}</ul>
              </div>
              {tags.length > 0 && <button type="button" onClick={() => copyText(tags.join(", "))} className="rounded-sm border border-border px-4 py-2 text-sm">{L("Copy my tags", "انسخ وسومي")}</button>}
            </>
          )}
        </section>
      </div>
    </SiteShell>
  );
}
