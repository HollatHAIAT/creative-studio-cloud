import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ImagePlus, Trash2, Copy as CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { ActionButton, useAction } from "@/components/ActionButton";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";
import { generateAltText, type AltGen } from "@/lib/listing-copy.functions";

export const Route = createFileRoute("/_authenticated/alt-writer")({
  head: () => ({ meta: [
    { title: "Alt text writer — Arwiqa أروقة" },
    { name: "description", content: "Upload an artwork photo and get accessible English and Arabic alt text for your listing." },
    { property: "og:title", content: "Alt text writer — Arwiqa" },
    { property: "og:description", content: "AI-written, accessible bilingual alt text for artwork listings." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: AltWriter,
});

const MAX = 10 * 1024 * 1024;
type Draft = { id: string; title: string; title_ar: string; status: string };

function AltWriter() {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const L = (en: string, a: string) => (ar ? a : en);
  const gen = useServerFn(generateAltText);
  const [path, setPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [ctx, setCtx] = useState("");
  const [res, setRes] = useState<AltGen | null>(null);
  const [en, setEn] = useState(""); const [arTxt, setArTxt] = useState("");
  const [err, setErr] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [target, setTarget] = useState("");

  useEffect(() => {
    void (async () => {
      const uid = (await supabase.auth.getUser()).data.user?.id ?? "";
      const { data } = await supabase.from("listing_drafts").select("id,title,title_ar,status").eq("user_id", uid).in("status", ["draft", "rejected"]).order("updated_at", { ascending: false }).limit(30);
      setDrafts((data ?? []) as Draft[]);
    })();
  }, []);

  const upload = useAction(async (file: File) => {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error(L("Please choose a PNG, JPG, WEBP or GIF image.", "اختر صورة PNG أو JPG أو WEBP أو GIF."));
    if (file.size > MAX) throw new Error(L("Image is larger than 10 MB.", "حجم الصورة أكبر من 10 ميجابايت."));
    const { data: u } = await supabase.auth.getUser();
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const p = `${u.user!.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("artwork-images").upload(p, file, { contentType: file.type });
    if (error) throw new Error(L("Upload failed, please try again.", "فشل الرفع، حاول مجدداً."));
    if (path) await supabase.storage.from("artwork-images").remove([path]);
    setPath(p); setPreview(URL.createObjectURL(file)); setRes(null);
  });

  const run = useAction(async () => {
    if (!path) return;
    setErr("");
    const r = await gen({ data: { path, context: ctx } });
    if (r.error || !r.alt) { setErr(r.error ?? ""); throw new Error(r.error); }
    setRes(r.alt); setEn(r.alt.altText); setArTxt(r.alt.altTextAr);
  });

  const apply = useAction(async () => {
    if (!target) return;
    const row: { alt_text: string; alt_text_ar: string; image_path?: string } = { alt_text: en.trim(), alt_text_ar: arTxt.trim() };
    if (path) row.image_path = path;
    const { error } = await supabase.from("listing_drafts").update(row).eq("id", target);
    if (error) throw new Error(L("Couldn't update the draft.", "تعذّر تحديث المسودة."));
    toast.success(L("Alt text saved to your draft", "حُفظ النص البديل في مسودتك"));
  });

  const removeImage = async () => {
    if (path) await supabase.storage.from("artwork-images").remove([path]);
    setPath(null); setPreview(null); setRes(null);
  };
  const copyText = async (s: string) => { await navigator.clipboard.writeText(s); toast.success(L("Copied", "تم النسخ")); };
  const warn = (s: string, re: RegExp) => [
    s.length > 140 && L("Over 140 characters", "أطول من 140 حرفاً"),
    re.test(s.trim()) && L("Starts with “image of”", "يبدأ بـ«صورة»"),
    !s.trim() && L("Empty", "فارغ"),
  ].filter(Boolean) as string[];

  return (
    <SiteShell>
      <PageTitle eyebrow={L("Seller tools", "أدوات البائع")} title={L("Alt text writer", "كاتب النص البديل")}
        sub={L("Upload your artwork photo. The AI describes what's visible in short, accessible alt text in English and Arabic.", "ارفع صورة عملك، وسيصف الذكاء الاصطناعي ما يظهر فيها بنص بديل قصير وسهل الوصول بالعربية والإنجليزية.")} />
      <div className="mx-auto grid max-w-6xl gap-8 px-6 pb-16 lg:grid-cols-2">
        <section className="space-y-4">
          {preview ? (
            <figure className="relative overflow-hidden rounded-2xl border border-border bg-card">
              <img src={preview} alt={en || L("Your uploaded artwork", "العمل الذي رفعته")} className="max-h-[420px] w-full object-contain" />
              <button type="button" onClick={removeImage} aria-label={L("Remove image", "إزالة الصورة")} className="absolute end-2 top-2 rounded-full bg-background/90 p-2 hover:bg-background"><Trash2 className="h-4 w-4" /></button>
            </figure>
          ) : (
            <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card text-center text-muted-foreground hover:border-primary focus-within:border-primary">
              <ImagePlus className="h-8 w-8" aria-hidden />
              <span className="font-medium text-foreground">{upload.busy ? L("Uploading…", "جارٍ الرفع…") : L("Choose an artwork photo", "اختر صورة العمل")}</span>
              <span className="text-sm">PNG, JPG, WEBP, GIF · {L("up to 10 MB", "حتى 10 ميجابايت")}</span>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" disabled={upload.busy}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.run(f); e.target.value = ""; }} />
            </label>
          )}
          {upload.state === "error" && <p role="alert" className="text-sm text-destructive">{(upload.error as Error)?.message}</p>}
          <label className="block text-sm">{L("Anything the AI should know? (optional)", "معلومات تفيد الذكاء الاصطناعي؟ (اختياري)")}
            <input value={ctx} onChange={(e) => setCtx(e.target.value)} maxLength={500}
              placeholder={L("e.g. Sadu weaving, the calligraphy reads “Al-Sabr”", "مثال: نسيج سدو، والخط يقرأ «الصبر»")} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2" />
          </label>
          <ActionButton state={run.state} disabled={!path} onClick={() => run.run()} onRetry={run.retry}
            loadingLabel={L("Writing…", "جارٍ الكتابة…")} successLabel={L("Alt text ready", "النص البديل جاهز")}
            errorLabel={err || L("Couldn't write the alt text.", "تعذّرت كتابة النص البديل.")} retryLabel={L("Try again", "حاول مجدداً")}
            className="w-full rounded-full bg-primary px-5 py-3 text-primary-foreground">
            {res ? L("Write again", "اكتب مجدداً") : L("Generate alt text", "أنشئ النص البديل")}
          </ActionButton>
        </section>

        <section aria-live="polite" className="space-y-5">
          {!res ? (
            <p className="rounded-2xl border border-border p-6 text-muted-foreground">{L("Your English and Arabic alt text will appear here, ready to edit.", "سيظهر النص البديل بالعربية والإنجليزية هنا، جاهزاً للتعديل.")}</p>
          ) : (
            <>
              {([["alt-en", "English", en, setEn, "ltr", /^(image|picture|photo)\b/i], ["alt-ar", "العربية", arTxt, setArTxt, "rtl", /^صورة/]] as const).map(([id, label, v, set, dir, re]) => {
                const w = warn(v, re);
                return (
                  <div key={id} className="rounded-2xl border border-border p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <label htmlFor={id} className="text-sm font-medium">{L("Alt text", "النص البديل")} · {label}</label>
                      <button type="button" onClick={() => copyText(v)} className="inline-flex items-center gap-1 text-sm underline"><CopyIcon className="h-3 w-3" aria-hidden />{L("Copy", "نسخ")}</button>
                    </div>
                    <textarea id={id} dir={dir} lang={dir === "rtl" ? "ar" : "en"} value={v} onChange={(e) => set(e.target.value)} rows={3} className="w-full rounded-xl border border-border bg-background px-3 py-2" />
                    <p className={`mt-1 text-xs ${w.length ? "text-destructive" : "text-muted-foreground"}`}>{v.length} / 140{w.length ? ` · ${w.join(" · ")}` : ""}</p>
                  </div>
                );
              })}
              {(res.longDescription || res.longDescriptionAr) && (
                <details className="rounded-2xl border border-border p-4">
                  <summary className="cursor-pointer text-sm font-medium">{L("Longer description for screen-reader users", "وصف أطول لمستخدمي قارئ الشاشة")}</summary>
                  <p className="mt-2 text-sm" dir={ar ? "rtl" : "ltr"}>{ar ? res.longDescriptionAr : res.longDescription}</p>
                  <button type="button" onClick={() => copyText(ar ? res.longDescriptionAr : res.longDescription)} className="mt-2 text-sm underline">{L("Copy", "نسخ")}</button>
                </details>
              )}
              {(ar ? res.notesAr : res.notes).length > 0 && (
                <div><h2 className="mb-1 text-sm font-medium">{L("Tips", "نصائح")}</h2>
                  <ul className="list-disc space-y-1 ps-5 text-sm">{(ar ? res.notesAr : res.notes).map((n) => <li key={n}>{n}</li>)}</ul></div>
              )}
              <div className="space-y-2 rounded-2xl bg-muted/40 p-4">
                <label className="block text-sm">{L("Save to one of your listing drafts", "احفظه في إحدى مسودات إعلاناتك")}
                  <select value={target} onChange={(e) => setTarget(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2">
                    <option value="">{drafts.length ? L("Choose a draft…", "اختر مسودة…") : L("No editable drafts yet", "لا مسودات قابلة للتعديل")}</option>
                    {drafts.map((d) => <option key={d.id} value={d.id}>{(ar ? d.title_ar : d.title) || L("Untitled", "بلا عنوان")}</option>)}
                  </select>
                </label>
                <ActionButton state={apply.state} disabled={!target || !en.trim() || !arTxt.trim()} onClick={() => apply.run()} onRetry={apply.retry}
                  loadingLabel={L("Saving…", "جارٍ الحفظ…")} successLabel={L("Saved", "حُفظ")}
                  errorLabel={L("Couldn't update the draft.", "تعذّر تحديث المسودة.")} retryLabel={L("Try again", "حاول مجدداً")}
                  className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground">
                  {L("Save alt text & image to draft", "احفظ النص والصورة في المسودة")}
                </ActionButton>
              </div>
            </>
          )}
        </section>
      </div>
    </SiteShell>
  );
}
