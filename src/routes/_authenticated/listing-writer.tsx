import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ImagePlus, Copy as CopyIcon, Trash2, Monitor, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { ActionButton, useAction } from "@/components/ActionButton";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";
import { generateListingCopy, reviseListingCopy, type ListingCopy } from "@/lib/listing-copy.functions";

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
  const { locale } = useLocale();
  const ar = locale === "ar";
  const L = (en: string, a: string) => (ar ? a : en);
  const gen = useServerFn(generateListingCopy);
  const [path, setPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [medium, setMedium] = useState("");
  const [notes, setNotes] = useState("");
  const [copy, setCopy] = useState<ListingCopy | null>(null);
  const [err, setErr] = useState("");
  const revise = useServerFn(reviseListingCopy);
  const [instr, setInstr] = useState("");
  const [revErr, setRevErr] = useState("");
  const [prev, setPrev] = useState<ListingCopy | null>(null);
  type Draft = { id: string; title: string; title_ar: string; description: string; description_ar: string; alt_text: string; alt_text_ar: string; tags: string[]; medium: string; image_path: string | null; updated_at: string };
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState("");
  const loadDrafts = async () => {
    const { data } = await supabase.from("listing_drafts").select("*").order("updated_at", { ascending: false }).limit(20);
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
  const openDraft = (d: Draft) => {
    setDraftId(d.id); setMedium(d.medium); setPath(d.image_path); setPreview(null); setPrev(null);
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
            <figure className="relative overflow-hidden rounded-sm border border-border bg-card">
              <img src={preview} alt={copy ? (ar ? copy.altTextAr : copy.altText) : L("Your uploaded artwork", "العمل الذي رفعته")} className="max-h-[420px] w-full object-contain" />
              <button type="button" onClick={removeImage} aria-label={L("Remove image", "إزالة الصورة")} className="absolute end-2 top-2 rounded-sm bg-background/90 p-2 hover:bg-background"><Trash2 className="h-4 w-4" /></button>
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
          <label className="block text-sm">{L("Medium (optional)", "الخامة (اختياري)")}
            <input value={medium} onChange={(e) => setMedium(e.target.value)} maxLength={100} placeholder={L("e.g. oil on canvas", "مثال: زيت على قماش")} className="mt-1 w-full rounded-sm border border-border bg-background px-3 py-2" />
          </label>
          <label className="block text-sm">{L("Notes for the writer (optional)", "ملاحظات للكاتب (اختياري)")}
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={600} rows={3} placeholder={L("Inspiration, place, series…", "الإلهام، المكان، السلسلة…")} className="mt-1 w-full rounded-sm border border-border bg-background px-3 py-2" />
          </label>
          <ActionButton state={write.state} disabled={!path} onClick={() => write.run()} onRetry={write.retry}
            loadingLabel={L("Writing copy…", "جارٍ الكتابة…")} successLabel={L("Copy ready", "النص جاهز")}
            errorLabel={err || L("Couldn't write copy.", "تعذّرت الكتابة.")} retryLabel={L("Try again", "حاول مجدداً")}
            className="w-full rounded-sm bg-primary px-5 py-3 text-primary-foreground">
            {copy ? L("Rewrite copy", "أعد الكتابة") : L("Write listing copy", "اكتب نص الإعلان")}
          </ActionButton>
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
              {copy.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">{copy.tags.map((t) => <span key={t} className="rounded-full border border-border px-3 py-1 text-sm">#{t}</span>)}</div>
              )}
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
                      {preview ? <img src={preview} alt={alt} className={phone ? "aspect-[4/5] w-full bg-muted object-cover" : "max-h-72 w-full bg-muted object-contain"} /> : <div className="grid h-40 place-items-center bg-muted text-sm text-muted-foreground">{L("No image", "لا توجد صورة")}</div>}
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
                      {phone ? (
                        <div aria-label={L("Phone preview", "معاينة الهاتف")} role="group" className="mx-auto w-[360px] max-w-full rounded-[2rem] border-[10px] border-foreground bg-foreground shadow-lg">
                          <div className="mx-auto mb-1 h-1.5 w-16 rounded-full bg-muted-foreground/60" aria-hidden />
                          <div className="flex h-[640px] flex-col overflow-hidden rounded-[1.4rem] bg-background">
                            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2 text-xs"><span className="font-display text-sm">أروقة Arwiqa</span><span className="text-muted-foreground">9:41</span></div>
                            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">{body}</div>
                            <div className="shrink-0 border-t border-border bg-background p-3"><div className="rounded-sm bg-primary py-2.5 text-center text-sm text-primary-foreground">{isAr ? "اشترِ الآن" : "Buy now"}</div></div>
                          </div>
                        </div>
                      ) : body}
                      <div className="rounded-sm bg-muted p-3 text-sm">
                        <p className="mb-1 font-medium">{L("What a screen reader says", "ما يقرؤه قارئ الشاشة")}</p>
                        <p className="text-muted-foreground">{isAr ? "صورة، " : "Image, "}{alt || (isAr ? "بلا وصف" : "no description")}. {isAr ? "عنوان، " : "Heading, "}{t || "—"}.</p>
                      </div>
                      {issues.length > 0 ? (
                        <ul className="space-y-1 text-sm text-destructive">{issues.map((i) => <li key={i}>• {i}</li>)}</ul>
                      ) : <p className="text-sm text-success">{L("Ready: title, description and alt text look good.", "جاهز: العنوان والوصف والنص البديل سليمة.")}</p>}
                    </div>
                  );
                })()}
              </div>
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
