import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ImagePlus, Copy as CopyIcon, Trash2 } from "lucide-react";
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
