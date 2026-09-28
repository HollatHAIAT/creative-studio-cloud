import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ImagePlus, Trash2, Copy as CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { ActionButton, useAction } from "@/components/ActionButton";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";
import { reviewAltText, type AltReview } from "@/lib/listing-copy.functions";

export const Route = createFileRoute("/_authenticated/alt-checker")({
  head: () => ({ meta: [
    { title: "Alt text checker — Arwiqa أروقة" },
    { name: "description", content: "Check whether your artwork's alt text describes the image and get a clearer accessible version." },
    { property: "og:title", content: "Alt text checker — Arwiqa" },
    { property: "og:description", content: "AI review of artwork alt text with a clearer bilingual suggestion." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: AltChecker,
});

const MAX = 10 * 1024 * 1024;

function AltChecker() {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const L = (en: string, a: string) => (ar ? a : en);
  const check = useServerFn(reviewAltText);
  const [path, setPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [alt, setAlt] = useState("");
  const [review, setReview] = useState<AltReview | null>(null);
  const [err, setErr] = useState("");
  const [title, setTitle] = useState(""); const [medium, setMedium] = useState(""); const [desc, setDesc] = useState("");
  type D = { id: string; title: string; title_ar: string; medium: string; description: string; alt_text: string; alt_text_ar: string; image_path: string | null };
  const [drafts, setDrafts] = useState<D[]>([]);
  useEffect(() => { void (async () => {
    const uid = (await supabase.auth.getUser()).data.user?.id ?? "";
    const { data } = await supabase.from("listing_drafts").select("id,title,title_ar,medium,description,alt_text,alt_text_ar,image_path").eq("user_id", uid).order("updated_at", { ascending: false }).limit(30);
    setDrafts((data ?? []) as D[]);
  })(); }, []);
  const loadDraft = async (id: string) => {
    const d = drafts.find((x) => x.id === id); if (!d) return;
    setTitle(ar ? d.title_ar || d.title : d.title); setMedium(d.medium); setDesc(d.description);
    setAlt(ar ? d.alt_text_ar || d.alt_text : d.alt_text); setReview(null);
    if (d.image_path) {
      setPath(d.image_path);
      const { data } = await supabase.storage.from("artwork-images").createSignedUrl(d.image_path, 600);
      setPreview(data?.signedUrl ?? null);
    }
  };

  const upload = useAction(async (file: File) => {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error(L("Please choose a PNG, JPG, WEBP or GIF image.", "اختر صورة PNG أو JPG أو WEBP أو GIF."));
    if (file.size > MAX) throw new Error(L("Image is larger than 10 MB.", "حجم الصورة أكبر من 10 ميجابايت."));
    const { data: u } = await supabase.auth.getUser();
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const p = `${u.user!.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("artwork-images").upload(p, file, { contentType: file.type });
    if (error) throw new Error(L("Upload failed, please try again.", "فشل الرفع، حاول مجدداً."));
    if (path) await supabase.storage.from("artwork-images").remove([path]);
    setPath(p); setPreview(URL.createObjectURL(file)); setReview(null);
  });

  const run = useAction(async () => {
    if (!path) return;
    setErr("");
    const r = await check({ data: { path, altText: alt, details: { title, medium, description: desc } } });
    if (r.error || !r.review) { setErr(r.error ?? ""); throw new Error(r.error); }
    setReview(r.review);
  });

  const removeImage = async () => {
    if (path && !drafts.some((d) => d.image_path === path)) await supabase.storage.from("artwork-images").remove([path]);
    setPath(null); setPreview(null); setReview(null);
  };
  const copyText = async (s: string) => { await navigator.clipboard.writeText(s); toast.success(L("Copied", "تم النسخ")); };

  const verdict = review && {
    accurate: { label: L("Accurate", "دقيق"), cls: "border-success text-success" },
    partly: { label: L("Partly accurate", "دقيق جزئياً"), cls: "border-warning text-warning" },
    inaccurate: { label: L("Inaccurate", "غير دقيق"), cls: "border-destructive text-destructive" },
  }[review.verdict];

  return (
    <SiteShell>
      <PageTitle eyebrow={L("Seller tools", "أدوات البائع")} title={L("Alt text checker", "فاحص النص البديل")}
        sub={L("Upload your artwork or load a saved draft, add its details and alt text. The AI checks whether the text matches what's visible, flags accessibility gaps and suggests a clearer version.", "ارفع عملك والصق نصه البديل الحالي. يتحقق الذكاء الاصطناعي من مطابقته لما يظهر ويقترح نصاً أوضح.")} />
      <div className="mx-auto grid max-w-6xl gap-8 px-6 pb-16 lg:grid-cols-2">
        <section className="space-y-4">
          {preview ? (
            <figure className="relative overflow-hidden rounded-sm border border-border bg-card">
              <img src={preview} alt={alt || L("Your uploaded artwork", "العمل الذي رفعته")} className="max-h-[420px] w-full object-contain" />
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
          {drafts.length > 0 && (
            <label className="block text-sm">{L("Load from a saved listing draft", "حمّل من مسودة إعلان محفوظة")}
              <select defaultValue="" onChange={(e) => void loadDraft(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2">
                <option value="">{L("Choose a draft…", "اختر مسودة…")}</option>
                {drafts.map((d) => <option key={d.id} value={d.id}>{(ar ? d.title_ar : d.title) || L("Untitled", "بلا عنوان")}</option>)}
              </select>
            </label>)}
          <fieldset className="space-y-2 rounded-xl border border-border p-3 text-sm">
            <legend className="px-1">{L("Listing details (optional, helps the check)", "تفاصيل الإعلان (اختياري، تساعد الفحص)")}</legend>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} aria-label={L("Title", "العنوان")} placeholder={L("Title", "العنوان")} className="w-full rounded-xl border border-border bg-background px-3 py-2" />
            <input value={medium} onChange={(e) => setMedium(e.target.value)} maxLength={100} aria-label={L("Medium", "الوسيط")} placeholder={L("Medium, e.g. oil on canvas", "الوسيط، مثل زيت على قماش")} className="w-full rounded-xl border border-border bg-background px-3 py-2" />
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={4000} rows={3} aria-label={L("Description", "الوصف")} placeholder={L("Description", "الوصف")} className="w-full rounded-xl border border-border bg-background px-3 py-2" />
          </fieldset>
          <label className="block text-sm">{L("Current alt text", "النص البديل الحالي")}
            <textarea value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={1000} rows={4}
              placeholder={L("e.g. Beautiful painting of the desert", "مثال: لوحة جميلة للصحراء")} className="mt-1 w-full rounded-sm border border-border bg-background px-3 py-2" />
            <span className="mt-1 block text-xs text-muted-foreground">{alt.length} / 140 {L("recommended", "موصى به")}</span>
          </label>
          <ActionButton state={run.state} disabled={!path || !alt.trim()} onClick={() => run.run()} onRetry={run.retry}
            loadingLabel={L("Checking…", "جارٍ الفحص…")} successLabel={L("Review ready", "المراجعة جاهزة")}
            errorLabel={err || L("Couldn't check the alt text.", "تعذّر فحص النص.")} retryLabel={L("Try again", "حاول مجدداً")}
            className="w-full rounded-sm bg-primary px-5 py-3 text-primary-foreground">
            {L("Check alt text", "افحص النص البديل")}
          </ActionButton>
        </section>

        <section aria-live="polite" className="space-y-5">
          {!review ? (
            <p className="rounded-sm border border-border p-6 text-muted-foreground">{L("The review and a suggested alternative will appear here.", "ستظهر المراجعة والنص المقترح هنا.")}</p>
          ) : (
            <>
              <div className="space-y-2">
                <span className={`inline-block rounded-sm border px-3 py-1 text-sm font-medium ${verdict!.cls}`}>{verdict!.label}</span>
                <p>{ar ? review.summaryAr : review.summary}</p>
              </div>
              {(ar ? review.issuesAr : review.issues).length > 0 && (
                <div>
                  <h2 className="mb-2 font-medium">{L("Issues found", "المشكلات")}</h2>
                  <ul className="list-disc space-y-1 ps-5 text-sm">{(ar ? review.issuesAr : review.issues).map((i) => <li key={i}>{i}</li>)}</ul>
                </div>
              )}
              {review.gaps.length > 0 && (
                <div>
                  <h2 className="mb-2 font-medium">{L("Accessibility gaps", "ثغرات إمكانية الوصول")}</h2>
                  <ul className="space-y-1 text-sm">{review.gaps.map((g, i) => (
                    <li key={i} className="rounded-lg bg-muted/40 p-2"><span className={`me-2 rounded-full px-2 py-0.5 text-xs ${g.severity === "high" ? "bg-destructive/10 text-destructive" : g.severity === "low" ? "bg-muted text-muted-foreground" : "bg-warning/15 text-warning"}`}>{g.severity === "high" ? L("High", "عالية") : g.severity === "low" ? L("Low", "منخفضة") : L("Medium", "متوسطة")}</span>{ar ? g.gapAr || g.gap : g.gap}</li>))}</ul>
                </div>
              )}
              {([["English", review.suggestion, "ltr"], ["العربية", review.suggestionAr, "rtl"]] as const).map(([label, s, dir]) => (
                <div key={label} className="rounded-sm border border-border p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-medium">{L("Suggested alt text", "النص البديل المقترح")} · {label}</h2>
                    <button type="button" onClick={() => copyText(s)} className="inline-flex items-center gap-1 text-sm underline"><CopyIcon className="h-3 w-3" aria-hidden />{L("Copy", "نسخ")}</button>
                  </div>
                  <p dir={dir}>{s}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.length} / 140</p>
                </div>
              ))}
              <button type="button" onClick={() => setAlt(ar ? review.suggestionAr : review.suggestion)} className="rounded-sm border border-border px-4 py-2 text-sm hover:border-primary">
                {L("Use suggestion as current alt text", "استخدم المقترح كنص حالي")}
              </button>
            </>
          )}
        </section>
      </div>
    </SiteShell>
  );
}
