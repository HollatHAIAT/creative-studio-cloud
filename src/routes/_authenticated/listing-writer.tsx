import { OwnershipHeritage } from "@/components/OwnershipHeritage";
import { ScreenReaderPreview } from "@/components/ScreenReaderPreview";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { A11yAudit } from "@/components/A11yAudit";
import { PublishGate, publishIssues } from "@/components/PublishGate";
import { ReviewPath } from "@/components/ReviewPath";
import { ImagePlus, Copy as CopyIcon, Trash2, Monitor, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { ActionButton, useAction } from "@/components/ActionButton";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";
import { generateListingCopy, reviseListingCopy, reviewMobileCopy, type ListingCopy, type MobileReview } from "@/lib/listing-copy.functions";

export const Route = createFileRoute("/_authenticated/listing-writer")({
  head: () => ({ meta: [
    { title: "AI listing writer — Arwiqa أروقة" },
    { name: "description", content: "Upload an artwork photo and get bilingual listing copy and accessibility alt text." },
    { property: "og:title", content: "AI listing writer — Arwiqa" },
    { property: "og:description", content: "Bilingual listing descriptions and alt text from your artwork photo." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: ListingWriter,
});

const MAX = 10 * 1024 * 1024;

function ListingWriter() {
  const previewRef = useRef<HTMLDivElement>(null);
  const { locale } = useLocale();
  const ar = locale === "ar";
  const L = (en: string, a: string) => (ar ? a : en);
  const gen = useServerFn(generateListingCopy);
  const [path, setPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [medium, setMedium] = useState("");
  const [notes, setNotes] = useState("");
  const [copy, setCopy] = useState<ListingCopy | null>(null);
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [err, setErr] = useState("");
  const revise = useServerFn(reviseListingCopy);
  const [instr, setInstr] = useState("");
  const [revErr, setRevErr] = useState("");
  const [prev, setPrev] = useState<ListingCopy | null>(null);
  type Draft = { id: string; title: string; title_ar: string; description: string; description_ar: string; alt_text: string; alt_text_ar: string; tags: string[]; medium: string; image_path: string | null; updated_at: string; status: string };
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pubErr, setPubErr] = useState("");
  const loadDrafts = async () => {
    const uid = (await supabase.auth.getUser()).data.user?.id ?? "";
    const { data } = await supabase.from("listing_drafts").select("*").eq("user_id", uid).order("updated_at", { ascending: false }).limit(20);
    setDrafts((data ?? []) as Draft[]);
  };
  useEffect(() => { void loadDrafts(); }, []);
  const save = useAction(async () => {
    if (!copy) return;
    setSaveErr("");
    const row = { title: copy.title, title_ar: copy.titleAr, description: copy.description, description_ar: copy.descriptionAr,
      alt_text: copy.altText, alt_text_ar: copy.altTextAr, tags: copy.tags, medium, image_path: path };
    const q = draftId
      ? supabase.from("listing_drafts").update(row).eq("id", draftId).select("id").single()
      : supabase.from("listing_drafts").insert(row).select("id").single();
    const { data, error } = await q;
    if (error || !data) { setSaveErr(L("Couldn't save the draft.", "تعذّر حفظ المسودة.")); throw error ?? new Error("save"); }
    setDraftId(data.id);
    await loadDrafts();
  });
  const saveNow = async (): Promise<string | null> => {
    if (!copy) return null;
    const row = { title: copy.title, title_ar: copy.titleAr, description: copy.description, description_ar: copy.descriptionAr,
      alt_text: copy.altText, alt_text_ar: copy.altTextAr, tags: copy.tags, medium, image_path: path };
    const q = draftId
      ? supabase.from("listing_drafts").update(row).eq("id", draftId).select("id").single()
      : supabase.from("listing_drafts").insert(row).select("id").single();
    const { data, error } = await q;
    if (error || !data) { toast.error(L("Couldn't save the draft.", "تعذّر حفظ المسودة.")); return null; }
    setDraftId(data.id); await loadDrafts();
    return data.id;
  };
  const setStatus = async (status: "draft" | "submitted") => {
    if (!copy) return;
    const row = { title: copy.title, title_ar: copy.titleAr, description: copy.description, description_ar: copy.descriptionAr,
      alt_text: copy.altText, alt_text_ar: copy.altTextAr, tags: copy.tags, medium, image_path: path, status };
    const q = draftId
      ? supabase.from("listing_drafts").update(row).eq("id", draftId).select("id").single()
      : supabase.from("listing_drafts").insert(row).select("id").single();
    const { data, error } = await q;
    if (error || !data) {
      const failed = error?.message.match(/checks failed: (.+)/)?.[1];
      setPubErr(failed ? L(`Blocked by the server — fix: ${failed}`, `رفضه الخادم — أصلح: ${failed}`) : L("Couldn't submit the listing.", "تعذّر إرسال الإعلان."));
      throw error ?? new Error("publish");
    }
    setDraftId(data.id); setSubmitted(status === "submitted");
    await loadDrafts();
  };
  const publish = useAction(async () => { setPubErr(""); await setStatus("submitted"); });
  const openDraft = (d: Draft) => {
    setDraftId(d.id); setSubmitted(d.status === "submitted"); setMedium(d.medium); setPath(d.image_path); setPreview(null); setPrev(null);
    if (d.image_path) void supabase.storage.from("artwork-images").createSignedUrl(d.image_path, 3600).then(({ data }) => setPreview(data?.signedUrl ?? null));
    setCopy({ title: d.title, titleAr: d.title_ar, description: d.description, descriptionAr: d.description_ar, altText: d.alt_text, altTextAr: d.alt_text_ar, tags: d.tags });
  };
  const removeDraft = async (id: string) => {
    await supabase.from("listing_drafts").delete().eq("id", id);
    if (id === draftId) setDraftId(null);
    await loadDrafts();
  };
  const [pvLang, setPvLang] = useState<"en" | "ar">(ar ? "ar" : "en");
  const [pvDevice, setPvDevice] = useState<"desktop" | "phone">("desktop");
  const [imgRatio, setImgRatio] = useState<number | null>(null);
  const [imgW, setImgW] = useState<number | null>(null);
  useEffect(() => { setImgRatio(null); setImgW(null); }, [preview]);
  const mobCheck = useServerFn(reviewMobileCopy);
  const [mobile, setMobile] = useState<MobileReview | null>(null);
  const [mobErr, setMobErr] = useState("");
  const mob = useAction(async () => {
    if (!copy) return;
    setMobErr("");
    const { tags: _t, ...c } = copy;
    const r = await mobCheck({ data: { path, copy: c } });
    if (r.error || !r.review) { setMobErr(r.error ?? ""); throw new Error(r.error); }
    setMobile(r.review);
  });
  const rev = useAction(async () => {
    if (!copy) return;
    setRevErr("");
    const r = await revise({ data: { instructions: instr, medium, current: { title: copy.title, titleAr: copy.titleAr, description: copy.description, descriptionAr: copy.descriptionAr } } });
    if (r.error || !r.copy) { setRevErr(r.error ?? ""); throw new Error(r.error ?? "failed"); }
    setPrev(copy);
    setCopy({ ...copy, ...r.copy });
  });

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const upload = useAction(async (file: File) => {
    setErr("");
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error(L("Please choose a PNG, JPG, WEBP or GIF image.", "اختر صورة PNG أو JPG أو WEBP أو GIF."));
    if (file.size > MAX) throw new Error(L("Image is larger than 10 MB.", "حجم الصورة أكبر من 10 ميجابايت."));
    const { data: u } = await supabase.auth.getUser();
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const p = `${u.user!.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("artwork-images").upload(p, file, { contentType: file.type });
    if (error) throw new Error(L("Upload failed, please try again.", "فشل الرفع، حاول مجدداً."));
    if (path) await supabase.storage.from("artwork-images").remove([path]);
    setPath(p); setPreview(URL.createObjectURL(file)); setCopy(null);
  });

  const write = useAction(async () => {
    if (!path) return;
    setErr("");
    const r = await gen({ data: { path, medium, notes } });
    if (r.error || !r.copy) { setErr(r.error ?? ""); throw new Error(r.error); }
    setCopy(r.copy);
  });
  const startManual = () => {
    setMode("manual");
    setCopy((c) => c ?? { title: "", titleAr: "", description: "", descriptionAr: "", altText: "", altTextAr: "", tags: [] });
  };

  const removeImage = async () => {
    if (path) await supabase.storage.from("artwork-images").remove([path]);
    setPath(null); setPreview(null); setCopy(null);
  };

  const field = (k: keyof Omit<ListingCopy, "tags">, v: string) => setCopy((c) => (c ? { ...c, [k]: v } : c));
  const copyText = async (s: string) => { await navigator.clipboard.writeText(s); toast.success(L("Copied", "تم النسخ")); };

  return (
    <SiteShell>
      <PageTitle eyebrow={L("Seller tools", "أدوات البائع")} title={L("AI listing writer", "كاتب الإعلانات الذكي")}
        sub={L("Upload a photo of your artwork and get a bilingual title, description and accessibility alt text you can edit.", "ارفع صورة عملك واحصل على عنوان ووصف ونص بديل للوصول بالعربية والإنجليزية قابل للتعديل.")} />
      <div className="mx-auto grid max-w-6xl gap-8 px-6 pb-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section className="space-y-4">
          {preview ? (
            <figure id="f-image" tabIndex={-1} className="relative overflow-hidden rounded-sm border border-border bg-card">
              <img src={preview} alt={copy ? (ar ? copy.altTextAr : copy.altText) : L("Your uploaded artwork", "العمل الذي رفعته")} className="max-h-[420px] w-full object-contain" />
              <button type="button" onClick={removeImage} aria-label={L("Remove image", "إزالة الصورة")} className="absolute end-2 top-2 rounded-sm bg-background/90 p-2 hover:bg-background"><Trash2 className="h-4 w-4" /></button>
            </figure>
          ) : (
            <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed border-border bg-card text-center text-muted-foreground hover:border-primary focus-within:border-primary">
              <ImagePlus className="h-8 w-8" aria-hidden />
              <span className="font-medium text-foreground">{upload.busy ? L("Uploading…", "جارٍ الرفع…") : L("Choose an artwork photo", "اختر صورة العمل")}</span>
              <span className="text-sm">PNG, JPG, WEBP, GIF · {L("up to 10 MB", "حتى 10 ميجابايت")}</span>
              <input id="f-image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" disabled={upload.busy}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.run(f); e.target.value = ""; }} />
            </label>
          )}
          {upload.state === "error" && <p role="alert" className="text-sm text-destructive">{(upload.error as Error)?.message}</p>}
          <label className="block text-sm">{L("Medium (optional)", "الخامة (اختياري)")}
            <input value={medium} onChange={(e) => setMedium(e.target.value)} maxLength={100} placeholder={L("e.g. oil on canvas", "مثال: زيت على قماش")} className="mt-1 w-full rounded-sm border border-border bg-background px-3 py-2" />
          </label>
          <label className="block text-sm">{L("Notes for the writer (optional)", "ملاحظات للكاتب (اختياري)")}
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={600} rows={3} placeholder={L("Inspiration, place, series…", "الإلهام، المكان، السلسلة…")} className="mt-1 w-full rounded-sm border border-border bg-background px-3 py-2" />
          </label>
          <div role="radiogroup" aria-label={L("How to write the listing", "طريقة كتابة الإعلان")} className="grid grid-cols-2 gap-2 rounded-full bg-muted p-1 text-sm">
            {([["ai", L("Write with AI", "اكتب بالذكاء الاصطناعي")], ["manual", L("Write it myself", "أكتبه بنفسي")]] as const).map(([m, label]) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
                className={`rounded-full px-3 py-2 ${mode === m ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}>{label}</button>
            ))}
          </div>
          {mode === "ai" ? (<>
            <ActionButton state={write.state} disabled={!path} onClick={() => write.run()} onRetry={write.retry}
              loadingLabel={L("Writing copy…", "جارٍ الكتابة…")} successLabel={L("Copy ready", "النص جاهز")}
              errorLabel={err || L("Couldn't write copy.", "تعذّرت الكتابة.")} retryLabel={L("Try again", "حاول مجدداً")}
              className="w-full rounded-full bg-primary px-5 py-3 text-primary-foreground">
              {copy ? L("Rewrite copy", "أعد الكتابة") : L("Write listing copy", "اكتب نص الإعلان")}
            </ActionButton>
            {write.state === "error" && (
              <p className="text-sm">{L("The AI isn't available right now.", "الذكاء الاصطناعي غير متاح الآن.")}{" "}
                <button type="button" onClick={startManual} className="font-medium text-primary underline">{L("Write it myself instead", "سأكتبه بنفسي بدلاً من ذلك")}</button></p>)}
          </>) : (
            <button type="button" onClick={startManual} disabled={!!copy} className="w-full rounded-full bg-primary px-5 py-3 text-primary-foreground disabled:opacity-60">
              {copy ? L("Editing below — fill in the fields", "حرّر الحقول أدناه") : L("Start writing", "ابدأ الكتابة")}
            </button>
          )}
        </section>

        <section aria-live="polite" className="space-y-5">
          {drafts.length > 0 && (
            <div className="rounded-sm border border-border p-4">
              <h2 className="mb-2 text-sm font-medium">{L("Your listing drafts", "مسودات إعلاناتك")}</h2>
              <ul className="divide-y divide-border">
                {drafts.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="truncate">{(ar ? d.title_ar : d.title) || L("Untitled", "بلا عنوان")}{d.id === draftId && <span className="ms-2 text-muted-foreground">· {L("open", "مفتوحة")}</span>}</span>
                    <span className="flex shrink-0 gap-3">
                      <button type="button" onClick={() => openDraft(d)} className="underline">{L("Open", "افتح")}</button>
                      <button type="button" onClick={() => removeDraft(d.id)} className="text-destructive underline">{L("Delete", "احذف")}</button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!copy ? (
            <div className="rounded-sm border border-border bg-card p-8 text-muted-foreground">
              {L("Your title, description and alt text will appear here. You can edit everything before using it.", "سيظهر هنا العنوان والوصف والنص البديل، ويمكنك تعديلها قبل الاستخدام.")}
            </div>
          ) : (
            <>
              {([
                ["title", L("Title (English)", "العنوان (إنجليزي)"), false, "ltr"],
                ["titleAr", L("Title (Arabic)", "العنوان (عربي)"), false, "rtl"],
                ["description", L("Description (English)", "الوصف (إنجليزي)"), true, "ltr"],
                ["descriptionAr", L("Description (Arabic)", "الوصف (عربي)"), true, "rtl"],
                ["altText", L("Alt text (English)", "النص البديل (إنجليزي)"), false, "ltr"],
                ["altTextAr", L("Alt text (Arabic)", "النص البديل (عربي)"), false, "rtl"],
              ] as const).map(([k, label, long, dir]) => (
                <div key={k}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <label htmlFor={`f-${k}`} className="font-medium">{label}</label>
                    <span className="flex items-center gap-3 text-muted-foreground">
                      {k.startsWith("alt") && <span className={copy[k].length > 140 ? "text-destructive" : ""}>{copy[k].length}/140</span>}
                      <button type="button" onClick={() => copyText(copy[k])} aria-label={`${L("Copy", "نسخ")} ${label}`} className="hover:text-foreground"><CopyIcon className="h-4 w-4" /></button>
                    </span>
                  </div>
                  {long ? (
                    <textarea id={`f-${k}`} dir={dir} rows={6} value={copy[k]} onChange={(e) => field(k, e.target.value)} className="w-full rounded-sm border border-border bg-background px-3 py-2" />
                  ) : (
                    <input id={`f-${k}`} dir={dir} value={copy[k]} onChange={(e) => field(k, e.target.value)} className="w-full rounded-sm border border-border bg-background px-3 py-2" />
                  )}
                </div>
              ))}
              <form onSubmit={(e) => { e.preventDefault(); if (instr.trim().length >= 3) void rev.run(); }} className="space-y-2 rounded-sm border border-border bg-card p-4">
                <label htmlFor="revise" className="text-sm font-medium">{L("Revise title & description", "عدّل العنوان والوصف")}</label>
                <textarea id="revise" rows={3} maxLength={1000} value={instr} onChange={(e) => setInstr(e.target.value)}
                  placeholder={L("e.g. Shorter, more poetic title; mention it suits a majlis; drop the word 'vibrant'", "مثال: عنوان أقصر وأكثر شاعرية، واذكر أنه يناسب المجلس، واحذف كلمة «نابض»")}
                  className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm" />
                <div className="flex flex-wrap items-center gap-3">
                  <ActionButton type="submit" state={rev.state} disabled={instr.trim().length < 3} onRetry={rev.retry}
                    loadingLabel={L("Rewriting…", "جارٍ إعادة الكتابة…")} successLabel={L("Updated in both languages", "تم التحديث باللغتين")}
                    errorLabel={revErr || L("Couldn't revise.", "تعذّر التعديل.")} retryLabel={L("Try again", "حاول مجدداً")}
                    className="rounded-sm bg-primary px-4 py-2 text-sm text-primary-foreground">{L("Apply revision", "طبّق التعديل")}</ActionButton>
                  {prev && <button type="button" onClick={() => { setCopy(prev); setPrev(null); }} className="text-sm underline">{L("Undo revision", "تراجع عن التعديل")}</button>}
                </div>
              </form>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">{copy.tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-sm">#{t}
                    <button type="button" aria-label={L(`Remove tag ${t}`, `إزالة الوسم ${t}`)} onClick={() => setCopy({ ...copy, tags: copy.tags.filter((x) => x !== t) })} className="text-muted-foreground hover:text-destructive">×</button>
                  </span>))}</div>
                <input aria-label={L("Add a tag", "أضف وسماً")} placeholder={L("Add a tag and press Enter", "أضف وسماً واضغط Enter")} maxLength={40}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return; e.preventDefault();
                    const v = e.currentTarget.value.trim().replace(/^#/, "");
                    if (v && !copy.tags.includes(v) && copy.tags.length < 20) setCopy({ ...copy, tags: [...copy.tags, v] });
                    e.currentTarget.value = "";
                  }} className="w-full rounded-full border border-border bg-background px-4 py-2 text-sm" />
              </div>
              <div className="space-y-3 rounded-sm border border-border p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <div className="min-w-0">
                    <h2 className="font-medium">{L("Phone readability check", "فحص الوضوح على الهاتف")}</h2>
                    <p className="text-sm text-muted-foreground">{L("AI checks whether your title, description and alt text read clearly on a phone.", "يتحقق الذكاء الاصطناعي من وضوح العنوان والوصف والنص البديل على الهاتف.")}</p>
                  </div>
                  <ActionButton state={mob.state} onClick={() => mob.run()} onRetry={mob.retry}
                    loadingLabel={L("Checking…", "جارٍ الفحص…")} successLabel={L("Checked", "تم الفحص")}
                    errorLabel={mobErr || L("Couldn't run the check.", "تعذّر الفحص.")} retryLabel={L("Try again", "حاول مجدداً")}
                    className="shrink-0 rounded-sm border border-border px-3 py-2 text-sm hover:border-primary">
                    <Smartphone className="h-4 w-4" aria-hidden />{L("Check on phone", "افحص للهاتف")}
                  </ActionButton>
                </div>
                {mobile && (
                  <div aria-live="polite" className="space-y-3 text-sm">
                    <p><span className={`me-2 rounded-sm border px-2 py-0.5 font-medium ${mobile.verdict === "clear" ? "border-success text-success" : "border-warning text-warning"}`}>
                      {mobile.verdict === "clear" ? L("Clear on phone", "واضح على الهاتف") : L("Needs work", "يحتاج تحسيناً")}</span>{ar ? mobile.summaryAr : mobile.summary}</p>
                    {mobile.tips.length > 0 && (
                      <ul className="list-disc space-y-1 ps-5">{mobile.tips.map((tp, i) => (
                        <li key={i}><span className="font-medium">{tp.field === "title" ? L("Title", "العنوان") : tp.field === "description" ? L("Description", "الوصف") : L("Alt text", "النص البديل")}:</span> {ar ? tp.issueAr : tp.issue}</li>
                      ))}</ul>
                    )}
                    <details className="rounded-sm bg-muted p-3">
                      <summary className="cursor-pointer font-medium">{L("Suggested concise versions", "الصيغ المختصرة المقترحة")}</summary>
                      <dl className="mt-2 space-y-2">
                        {([["Title", "العنوان", mobile.title, mobile.titleAr], ["Description", "الوصف", mobile.description, mobile.descriptionAr], ["Alt text", "النص البديل", mobile.altText, mobile.altTextAr]] as const).map(([en, a, v, va]) => (
                          <div key={en}><dt className="font-medium">{L(en, a)}</dt><dd dir="ltr" lang="en" className="whitespace-pre-line">{v}</dd><dd dir="rtl" lang="ar" className="whitespace-pre-line">{va}</dd></div>
                        ))}
                      </dl>
                    </details>
                    <div className="flex flex-wrap gap-3">
                      <button type="button" onClick={() => { setPrev(copy); setCopy({ ...copy, title: mobile.title, titleAr: mobile.titleAr, description: mobile.description, descriptionAr: mobile.descriptionAr, altText: mobile.altText, altTextAr: mobile.altTextAr }); setPvDevice("phone"); toast.success(L("Suggestions applied", "طُبّقت الاقتراحات")); }}
                        className="rounded-sm bg-primary px-3 py-2 text-primary-foreground">{L("Apply suggestions", "طبّق الاقتراحات")}</button>
                      {prev && <button type="button" onClick={() => { setCopy(prev); setPrev(null); }} className="underline">{L("Undo", "تراجع")}</button>}
                    </div>
                  </div>
                )}
              </div>
              <div className="rounded-sm border border-border">
                <div className="flex items-center justify-between border-b border-border px-4 py-2 text-sm">
                  <h2 className="font-medium">{L("Listing preview", "معاينة الإعلان")}</h2>
                  <div className="flex flex-wrap gap-3">
                  <div role="group" aria-label={L("Preview device", "جهاز المعاينة")} className="flex gap-1">
                    {(["desktop", "phone"] as const).map((dv) => (
                      <button key={dv} type="button" aria-pressed={pvDevice === dv} onClick={() => setPvDevice(dv)}
                        className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 ${pvDevice === dv ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                        {dv === "desktop" ? <Monitor className="h-3.5 w-3.5" aria-hidden /> : <Smartphone className="h-3.5 w-3.5" aria-hidden />}
                        {dv === "desktop" ? L("Desktop", "حاسوب") : L("Phone", "هاتف")}</button>
                    ))}
                  </div>
                  <div role="group" aria-label={L("Preview language", "لغة المعاينة")} className="flex gap-1">
                    {(["en", "ar"] as const).map((lg) => (
                      <button key={lg} type="button" aria-pressed={pvLang === lg} onClick={() => setPvLang(lg)}
                        className={`rounded-sm px-2 py-0.5 ${pvLang === lg ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{lg === "en" ? "English" : "العربية"}</button>
                    ))}
                  </div>
                  </div>
                </div>
                {(() => {
                  const isAr = pvLang === "ar";
                  const t = isAr ? copy.titleAr : copy.title, dsc = isAr ? copy.descriptionAr : copy.description, alt = isAr ? copy.altTextAr : copy.altText;
                  const issues = [
                    !t.trim() && L("Title is empty", "العنوان فارغ"),
                    !dsc.trim() && L("Description is empty", "الوصف فارغ"),
                    !alt.trim() && L("Alt text is empty — screen-reader users won't know what the image shows", "النص البديل فارغ — لن يعرف مستخدمو قارئ الشاشة محتوى الصورة"),
                    alt.length > 140 && L("Alt text is over 140 characters", "النص البديل يتجاوز 140 حرفاً"),
                    alt.trim() && t.trim() && alt.trim() === t.trim() && L("Alt text just repeats the title", "النص البديل يكرر العنوان فقط"),
                    /^(image|picture|photo|صورة)\b/i.test(alt.trim()) && L("Alt text needn't start with \"image of\"", "لا حاجة لبدء النص البديل بكلمة «صورة»"),
                  ].filter(Boolean) as string[];
                  const phone = pvDevice === "phone";
                  if (phone && t.length > 50) issues.push(L("Title is long for a phone — it will wrap over several lines", "العنوان طويل على الهاتف — سيمتد لعدة أسطر"));
                  if (phone && dsc.length > 600) issues.push(L("Description is long for a phone — buyers must scroll a lot", "الوصف طويل على الهاتف — سيحتاج المشتري إلى تمرير كثير"));
                  const body = (
                    <>
                      {preview ? <img src={preview} alt={alt} onLoad={(e) => { const im = e.currentTarget; if (im.naturalHeight) { setImgRatio(im.naturalWidth / im.naturalHeight); setImgW(im.naturalWidth); } }} className={phone ? "aspect-[4/5] w-full bg-muted object-cover" : "max-h-72 w-full bg-muted object-contain"} /> : <div className="grid h-40 place-items-center bg-muted text-sm text-muted-foreground">{L("No image", "لا توجد صورة")}</div>}
                      <div className={phone ? "px-4 pb-4" : ""}>
                        {medium && <p className="text-xs uppercase tracking-wide text-muted-foreground">{medium}</p>}
                        <h3 className={`font-display ${phone ? "text-xl leading-snug" : "text-2xl"}`}>{t || "—"}</h3>
                        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{dsc || "—"}</p>
                        {copy.tags.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{copy.tags.map((x) => `#${x}`).join(" ")}</p>}
                      </div>
                    </>
                  );
                  return (
                    <div dir={isAr ? "rtl" : "ltr"} lang={pvLang} className="space-y-4 p-4">
                      <div ref={previewRef}>
                      {phone ? (
                        <div aria-label={L("Phone preview", "معاينة الهاتف")} role="group" className="mx-auto w-[360px] max-w-full rounded-[2rem] border-[10px] border-foreground bg-foreground shadow-lg">
                          <div className="mx-auto mb-1 h-1.5 w-16 rounded-full bg-muted-foreground/60" aria-hidden />
                          <div className="flex h-[640px] flex-col overflow-hidden rounded-[1.4rem] bg-background">
                            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2 text-xs"><span className="font-display text-sm">أروقة Arwiqa</span><span className="text-muted-foreground">9:41</span></div>
                            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">{body}</div>
                            <div className="shrink-0 border-t border-border bg-background p-3"><button type="button" className="w-full rounded-sm bg-primary py-2.5 text-center text-sm text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{isAr ? "اشترِ الآن" : "Buy now"}</button></div>
                          </div>
                        </div>
                      ) : body}
                      </div>
                      <A11yAudit target={previewRef} watch={[copy, pvDevice, pvLang, preview]} />
                      <ScreenReaderPreview lang={pvLang} alt={alt} title={t} medium={medium} description={dsc} tags={copy.tags} hasImage={!!preview} />
                      {issues.length > 0 ? (
                        <ul className="space-y-1 text-sm text-destructive">{issues.map((i) => <li key={i}>• {i}</li>)}</ul>
                      ) : <p className="text-sm text-success">{L("Ready: title, description and alt text look good.", "جاهز: العنوان والوصف والنص البديل سليمة.")}</p>}
                      {(() => {
                        // Phone layout: ~24 title chars/line (2 lines shown on cards), ~110-char description snippet, 4:5 image crop.
                        const both = (f: (s: string) => boolean) => f(copy.title) && f(copy.titleAr);
                        const firstSentence = (s: string) => s.trim().split(/(?<=[.!؟?])\s/)[0] ?? "";
                        const crop = imgRatio == null ? null : Math.abs(imgRatio - 0.8) / Math.max(imgRatio, 0.8);
                        const alts = [copy.altText, copy.altTextAr];
                        type Item = { ok: boolean | null; label: string; hint: string };
                        const groups: { name: string; items: Item[] }[] = [
                          { name: L("Text truncation", "اقتطاع النص"), items: [
                            { ok: both((s) => s.trim().length > 0 && s.length <= 48), label: L("Title fits in 2 lines on a phone card", "العنوان يتسع لسطرين في بطاقة الهاتف"), hint: L("Keep both titles under 48 characters.", "اجعل العنوانين أقل من 48 حرفاً.") },
                            { ok: both((s) => !/\S{22,}/.test(s)), label: L("No overly long words in titles", "لا كلمات طويلة جداً في العنوان"), hint: L("Very long words break awkwardly on narrow screens.", "الكلمات الطويلة جداً تنكسر على الشاشات الضيقة.") },
                            { ok: [copy.description, copy.descriptionAr].every((s) => { const f = firstSentence(s); return f.length > 0 && f.length <= 110; }), label: L("Description's first sentence survives the snippet", "الجملة الأولى من الوصف تظهر كاملة في المقتطف"), hint: L("Phone listings show about 110 characters before “more”.", "يعرض الهاتف نحو 110 أحرف قبل «المزيد».") },
                            { ok: [copy.description, copy.descriptionAr].every((s) => s.length <= 700), label: L("Description is short enough to skim", "الوصف قصير بما يكفي للتصفح"), hint: L("Aim for under 700 characters.", "اجعله أقل من 700 حرف.") },
                          ] },
                          { name: L("Image cropping", "اقتصاص الصورة"), items: [
                            { ok: preview ? (crop == null ? null : crop <= 0.15) : false, label: L("Image fits the 4:5 phone frame without heavy cropping", "الصورة تناسب إطار الهاتف 4:5 دون اقتصاص كبير"),
                              hint: !preview ? L("Add an image.", "أضف صورة.") : crop == null ? L("Measuring…", "جارٍ القياس…") : L(`About ${Math.round(crop * 100)}% of the image is cut off on phones. A portrait photo near 4:5 works best.`, `يُقتطع نحو ${Math.round(crop * 100)}٪ من الصورة على الهاتف. الأفضل صورة عمودية قريبة من 4:5.`) },
                            { ok: preview ? (imgW == null ? null : imgW >= 1080) : false, label: L("Image is sharp on high-resolution phones", "الصورة حادة على الهواتف عالية الدقة"), hint: L("Use at least 1080 px wide.", "استخدم عرضاً لا يقل عن 1080 بكسل.") },
                          ] },
                          { name: L("Accessibility", "إمكانية الوصول"), items: [
                            { ok: alts.every((s) => s.trim().length >= 15), label: L("Alt text present in both languages", "النص البديل موجود باللغتين"), hint: L("Describe what's visible in at least a short phrase.", "صف ما يظهر بعبارة قصيرة على الأقل.") },
                            { ok: alts.every((s) => s.length <= 140), label: L("Alt text is 140 characters or fewer", "النص البديل 140 حرفاً أو أقل"), hint: L("Screen readers read long alt text in one go.", "قارئ الشاشة يقرأ النص الطويل دفعة واحدة.") },
                            { ok: alts.every((s) => !/^(image|picture|photo|صورة)\b/i.test(s.trim())), label: L("Alt text doesn't start with “image of”", "النص البديل لا يبدأ بـ«صورة»"), hint: L("Screen readers already announce it's an image.", "قارئ الشاشة يعلن أنها صورة مسبقاً.") },
                            { ok: copy.altText.trim() !== copy.title.trim() && copy.altTextAr.trim() !== copy.titleAr.trim(), label: L("Alt text differs from the title", "النص البديل يختلف عن العنوان"), hint: L("Describe the image, don't repeat the title.", "صف الصورة ولا تكرر العنوان.") },
                            { ok: /[\u0600-\u06FF]/.test(copy.titleAr + copy.descriptionAr + copy.altTextAr) && !/[\u0600-\u06FF]/.test(copy.title + copy.description + copy.altText), label: L("Each language is in its own field", "كل لغة في حقلها"), hint: L("Arabic fields should be Arabic and English fields English, so screen readers pronounce them correctly.", "يجب أن تكون الحقول العربية بالعربية والإنجليزية بالإنجليزية لينطقها قارئ الشاشة صحيحاً.") },
                          ] },
                        ];
                        const all = groups.flatMap((g) => g.items);
                        const fails = all.filter((i) => i.ok === false).length;
                        return (
                          <div className="rounded-sm border border-border p-3 text-sm">
                            <p className="mb-2 font-medium">{L("Mobile readiness checklist", "قائمة الجاهزية للهاتف")} · <span className={fails ? "text-warning" : "text-success"}>{fails ? L(`${fails} to fix`, `${fails} للإصلاح`) : L("All clear", "كلها سليمة")}</span></p>
                            {groups.map((g) => (
                              <div key={g.name} className="mb-2">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">{g.name}</p>
                                <ul className="space-y-1">{g.items.map((i) => (
                                  <li key={i.label} className="flex gap-2">
                                    <span aria-hidden className={i.ok ? "text-success" : i.ok === false ? "text-destructive" : "text-muted-foreground"}>{i.ok ? "✓" : i.ok === false ? "✕" : "…"}</span>
                                    <span className="min-w-0"><span className="sr-only">{i.ok ? L("Passed: ", "ناجح: ") : i.ok === false ? L("Needs fixing: ", "يحتاج إصلاحاً: ") : L("Checking: ", "قيد الفحص: ")}</span>{i.label}
                                      {i.ok === false || i.ok === null ? <span className="block text-xs text-muted-foreground">{i.hint}</span> : null}</span>
                                  </li>
                                ))}</ul>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}
              </div>
              <OwnershipHeritage draftId={draftId} onSave={saveNow} />
              <ReviewPath draftId={draftId} onSave={saveNow} submitted={submitted} onPublished={() => void loadDrafts()} />
              <PublishGate issues={publishIssues(copy, !!path, { ratio: imgRatio, width: imgW }, L)} submitted={submitted}
                state={publish.state} error={pubErr} onPublish={() => publish.run()} onRetry={publish.retry}
                onUnpublish={() => { void setStatus("draft").catch(() => toast.error(L("Couldn't withdraw.", "تعذّر السحب."))); }} />
              <div className="flex flex-wrap items-center gap-3">
                <ActionButton state={save.state} onClick={() => save.run()} onRetry={save.retry}
                  loadingLabel={L("Saving…", "جارٍ الحفظ…")} successLabel={L("Saved to draft", "حُفظ في المسودة")}
                  errorLabel={saveErr || L("Couldn't save the draft.", "تعذّر حفظ المسودة.")} retryLabel={L("Try again", "حاول مجدداً")}
                  className="rounded-sm bg-primary px-4 py-2 text-sm text-primary-foreground">
                  {draftId ? L("Update listing draft", "حدّث مسودة الإعلان") : L("Save to listing draft", "احفظ في مسودة إعلان")}
                </ActionButton>
                {draftId && <button type="button" onClick={() => setDraftId(null)} className="text-sm underline">{L("Save as a new draft instead", "احفظ كمسودة جديدة")}</button>}
              </div>
              <p className="text-sm text-muted-foreground">
                {L("AI-written — check facts before publishing.", "نص مكتوب بالذكاء الاصطناعي — راجع المعلومات قبل النشر.")}{" "}
                <Link to="/dashboard" className="underline">{L("Go to dashboard", "إلى لوحة التحكم")}</Link>
              </p>
            </>
          )}
        </section>
      </div>
    </SiteShell>
  );
}
