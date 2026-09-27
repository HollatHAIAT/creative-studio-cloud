import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ImagePlus, Trash2, Download } from "lucide-react";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { ActionButton, useAction } from "@/components/ActionButton";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";
import { findFocalPoint, type FocalResult } from "@/lib/listing-copy.functions";
import { RATIOS, recommendCrop, type RatioKey } from "@/lib/crop";

export const Route = createFileRoute("/_authenticated/crop-helper")({
  head: () => ({ meta: [
    { title: "Mobile crop helper — Arwiqa أروقة" },
    { name: "description", content: "Find your artwork's focal point and get a phone crop that keeps it visible." },
    { property: "og:title", content: "Mobile crop helper — Arwiqa" },
    { property: "og:description", content: "AI focal-point detection and recommended mobile crops for artwork photos." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: CropHelper,
});

const MAX = 10 * 1024 * 1024;
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

function CropHelper() {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const L = (en: string, a: string) => (ar ? a : en);
  const find = useServerFn(findFocalPoint);
  const [path, setPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [ratio, setRatio] = useState<RatioKey>("4:5");
  const [res, setRes] = useState<FocalResult | null>(null);
  const [err, setErr] = useState("");

  const upload = useAction(async (file: File) => {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error(L("Please choose a PNG, JPG, WEBP or GIF image.", "اختر صورة PNG أو JPG أو WEBP أو GIF."));
    if (file.size > MAX) throw new Error(L("Image is larger than 10 MB.", "حجم الصورة أكبر من 10 ميجابايت."));
    const { data: u } = await supabase.auth.getUser();
    const p = `${u.user!.id}/${crypto.randomUUID()}.${file.name.split(".").pop()?.toLowerCase() || "jpg"}`;
    const { error } = await supabase.storage.from("artwork-images").upload(p, file, { contentType: file.type });
    if (error) throw new Error(L("Upload failed, please try again.", "فشل الرفع، حاول مجدداً."));
    if (path) await supabase.storage.from("artwork-images").remove([path]);
    setPath(p); setPreview(URL.createObjectURL(file)); setRes(null); setSize(null);
  });

  const run = useAction(async () => {
    if (!path) return;
    setErr("");
    const r = await find({ data: { path, ratio } });
    if (r.error || !r.result) { setErr(r.error ?? ""); throw new Error(r.error); }
    setRes(r.result);
  });

  const rec = useMemo(() => (res && size ? recommendCrop(size.w, size.h, RATIOS[ratio], { x: res.focalX, y: res.focalY }, res.subject) : null), [res, size, ratio]);
  const removeImage = async () => { if (path) await supabase.storage.from("artwork-images").remove([path]); setPath(null); setPreview(null); setRes(null); };

  const downloadCrop = async () => {
    if (!preview || !rec || !size) return;
    const img = new Image(); img.src = preview; await img.decode();
    const c = document.createElement("canvas");
    const sx = rec.crop.x * size.w, sy = rec.crop.y * size.h, sw = rec.crop.w * size.w, sh = rec.crop.h * size.h;
    c.width = Math.round(sw); c.height = Math.round(sh);
    c.getContext("2d")!.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    c.toBlob((b) => { if (!b) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `artwork-${ratio.replace(":", "x")}.jpg`; a.click(); URL.revokeObjectURL(a.href); }, "image/jpeg", 0.92);
  };

  return (
    <SiteShell>
      <PageTitle eyebrow={L("Seller tools", "أدوات البائع")} title={L("Mobile crop helper", "مساعد القص للهاتف")}
        sub={L("Upload your artwork and choose the phone shape. The AI finds the focal point and recommends a crop that keeps it in view.", "ارفع عملك واختر شكل الهاتف. يحدد الذكاء الاصطناعي نقطة التركيز ويقترح قصاً يبقيها ظاهرة.")} />
      <div className="mx-auto grid max-w-6xl gap-8 px-6 pb-16 lg:grid-cols-2">
        <section className="space-y-4">
          {preview ? (
            <figure className="relative overflow-hidden rounded-sm border border-border bg-card">
              <div className="relative">
                <img src={preview} alt={L("Your uploaded artwork", "العمل الذي رفعته")} onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} className="block w-full" />
                {rec && res && (
                  <>
                    <div aria-hidden className="pointer-events-none absolute border-2 border-dashed border-gold" style={{ left: pct(res.subject.x), top: pct(res.subject.y), width: pct(res.subject.w), height: pct(res.subject.h) }} />
                    <div aria-hidden className="pointer-events-none absolute border-2 border-primary shadow-[0_0_0_9999px_hsl(0_0%_0%/0.45)]" style={{ left: pct(rec.crop.x), top: pct(rec.crop.y), width: pct(rec.crop.w), height: pct(rec.crop.h) }} />
                    <div aria-hidden className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary" style={{ left: pct(res.focalX), top: pct(res.focalY) }} />
                  </>
                )}
              </div>
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
          {rec && <p className="text-xs text-muted-foreground">{L("Bright frame = recommended crop · dot = focal point · dashed box = main subject", "الإطار الواضح = القص المقترح · النقطة = نقطة التركيز · المربع المتقطع = الموضوع الرئيسي")}</p>}
          <fieldset>
            <legend className="mb-2 text-sm">{L("Target phone aspect ratio", "نسبة العرض للهاتف")}</legend>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(RATIOS) as RatioKey[]).map((r) => (
                <button key={r} type="button" aria-pressed={ratio === r} onClick={() => setRatio(r)}
                  className={`rounded-full border px-4 py-1.5 text-sm ${ratio === r ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                  {r} <span className="text-xs opacity-80">{r === "4:5" ? L("feed", "الموجز") : r === "9:16" ? L("full screen", "ملء الشاشة") : r === "1:1" ? L("square", "مربع") : L("portrait", "عمودي")}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <ActionButton state={run.state} disabled={!path} onClick={() => run.run()} onRetry={run.retry}
            loadingLabel={L("Finding focal point…", "جارٍ تحديد نقطة التركيز…")} successLabel={L("Crop ready", "القص جاهز")}
            errorLabel={err || L("Couldn't analyse the image.", "تعذّر تحليل الصورة.")} retryLabel={L("Try again", "حاول مجدداً")}
            className="w-full rounded-sm bg-primary px-5 py-3 text-primary-foreground">
            {L("Find focal point & recommend crop", "حدد نقطة التركيز واقترح القص")}
          </ActionButton>
        </section>

        <section aria-live="polite" className="space-y-5">
          {!res || !rec ? (
            <p className="rounded-sm border border-border p-6 text-muted-foreground">{L("The recommended crop and a phone preview will appear here. Change the ratio any time — the crop updates instantly.", "سيظهر القص المقترح ومعاينة الهاتف هنا. غيّر النسبة متى شئت وسيتحدث القص فوراً.")}</p>
          ) : (
            <>
              <p>{ar ? res.summaryAr : res.summary}</p>
              <p className={`rounded-sm border px-3 py-2 text-sm ${rec.fits ? "border-success text-success" : "border-warning text-warning"}`}>
                {rec.fits ? L(`The whole subject stays visible at ${ratio}.`, `يبقى الموضوع كاملاً ظاهراً بنسبة ${ratio}.`)
                  : L(`At ${ratio} part of the subject is cut off; the crop keeps the focal point centred. Try another ratio or a wider photo.`, `بنسبة ${ratio} يُقتطع جزء من الموضوع؛ القص يبقي نقطة التركيز في الوسط. جرّب نسبة أخرى أو صورة أوسع.`)}
              </p>
              <div className="mx-auto w-[260px] max-w-full rounded-[1.6rem] border-[8px] border-foreground bg-foreground">
                <div className="overflow-hidden rounded-[1.1rem] bg-background">
                  <div className="relative w-full overflow-hidden" style={{ aspectRatio: String(RATIOS[ratio]) }}>
                    <img src={preview!} alt={L(`Phone preview cropped to ${ratio}`, `معاينة الهاتف مقصوصة بنسبة ${ratio}`)} className="absolute max-w-none"
                      style={{ width: `${100 / rec.crop.w}%`, height: `${100 / rec.crop.h}%`, left: `${(-rec.crop.x / rec.crop.w) * 100}%`, top: `${(-rec.crop.y / rec.crop.h) * 100}%` }} />
                  </div>
                  <div className="p-3 text-xs text-muted-foreground">{L("Phone preview", "معاينة الهاتف")} · {ratio}</div>
                </div>
              </div>
              {(ar ? res.tipsAr : res.tips).length > 0 && <ul className="list-disc space-y-1 ps-5 text-sm">{(ar ? res.tipsAr : res.tips).map((t) => <li key={t}>{t}</li>)}</ul>}
              <button type="button" onClick={downloadCrop} className="inline-flex items-center gap-2 rounded-sm border border-border px-4 py-2 text-sm hover:border-primary">
                <Download className="h-4 w-4" aria-hidden />{L("Download cropped image", "نزّل الصورة المقصوصة")}
              </button>
            </>
          )}
        </section>
      </div>
    </SiteShell>
  );
}
