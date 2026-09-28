import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { checkListingEvidence, type EvidenceCheckResult } from "@/lib/policy-review.functions";
import { useLocale } from "@/lib/i18n";
import { useCanViewPrivateComments } from "./FieldComments";

const SEV: Record<string, string> = { high: "bg-destructive/10 text-destructive", medium: "bg-warning/15 text-warning", low: "bg-muted text-muted-foreground" };

/** Moderator tool: add extra photos, optionally paste the description, and let the AI flag visual inconsistencies and missing evidence. */
export function EvidenceCheck({ draftId, description }: { draftId: string; description: string }) {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const { allowed } = useCanViewPrivateComments();
  const run = useServerFn(checkListingEvidence);
  const [photos, setPhotos] = useState<{ path: string; url: string }[]>([]);
  const [desc, setDesc] = useState(description);
  const [busy, setBusy] = useState(false); const [up, setUp] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<EvidenceCheckResult | null>(null);
  if (!allowed) return null;

  async function add(files: FileList | null) {
    if (!files) return; setUp(true); setErr(null);
    const { data: u } = await supabase.auth.getUser();
    for (const f of Array.from(files).slice(0, 5 - photos.length)) {
      if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type) || f.size > 10 * 1024 * 1024) { setErr(L("Use PNG, JPG, WEBP or GIF up to 10 MB.", "استخدم PNG أو JPG أو WEBP أو GIF حتى 10 ميجابايت.")); continue; }
      const path = `${u.user!.id}/evidence-${crypto.randomUUID()}.${f.name.split(".").pop()?.toLowerCase() || "jpg"}`;
      const { error } = await supabase.storage.from("artwork-images").upload(path, f, { contentType: f.type });
      if (error) { setErr(L("Upload failed.", "فشل الرفع.")); continue; }
      setPhotos((p) => [...p, { path, url: URL.createObjectURL(f) }]);
    }
    setUp(false);
  }
  async function remove(path: string) { await supabase.storage.from("artwork-images").remove([path]); setPhotos((p) => p.filter((x) => x.path !== path)); }
  async function go() {
    if (busy) return; setBusy(true); setErr(null);
    try { const r = await run({ data: { draftId, extraPaths: photos.map((p) => p.path), description: desc === description ? "" : desc } }); if (r.error) setErr(r.error); else setRes(r.result ?? null); }
    catch (e) { setErr(e instanceof Error ? e.message : "Error"); } finally { setBusy(false); }
  }

  return (
    <section aria-labelledby={`ev-${draftId}`} className="space-y-3 rounded-2xl border border-border p-4 text-sm md:col-span-2">
      <h3 id={`ev-${draftId}`} className="font-medium">{L("AI: visual inconsistencies & missing evidence", "ذكاء اصطناعي: التناقضات البصرية والأدلة الناقصة")}</h3>
      <p className="text-muted-foreground">{L("The listing's main photo is included as photo 1. Add up to 5 more (back, signature, certificate, detail).", "الصورة الرئيسية للإعلان هي الصورة 1. أضف حتى 5 صور أخرى (الظهر، التوقيع، الشهادة، التفاصيل).")}</p>
      <div className="flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <figure key={p.path} className="relative h-20 w-20 overflow-hidden rounded-xl border border-border">
            <img src={p.url} alt={L(`Extra photo ${i + 2}`, `صورة إضافية ${i + 2}`)} className="h-full w-full object-cover" />
            <figcaption className="absolute start-1 top-1 rounded-full bg-background/90 px-1.5 text-xs">{i + 2}</figcaption>
            <button type="button" onClick={() => remove(p.path)} aria-label={L("Remove photo", "إزالة الصورة")} className="absolute end-1 top-1 rounded-full bg-background/90 p-0.5"><X className="h-3 w-3" /></button>
          </figure>))}
        {photos.length < 5 && (
          <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border text-xs text-muted-foreground hover:border-primary focus-within:border-primary">
            <ImagePlus className="h-5 w-5" aria-hidden />{up ? "…" : L("Add", "أضف")}
            <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
          </label>)}
      </div>
      <label className="block">{L("Description to check against", "الوصف المراد مطابقته")}
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} maxLength={6000} className="mt-1 w-full rounded-xl border border-border bg-background p-2" /></label>
      <button type="button" onClick={go} disabled={busy} aria-busy={busy} className="rounded-full bg-primary px-4 py-1.5 text-primary-foreground disabled:opacity-50">
        {busy ? L("Checking…", "جارٍ الفحص…") : res ? L("Check again", "افحص مجددًا") : L("Check photos & evidence", "افحص الصور والأدلة")}
      </button>
      <div aria-live="polite">
        {err && <p role="alert" className="text-destructive">{err} <button type="button" className="underline" onClick={go}>{L("Try again", "حاول مجددًا")}</button></p>}
        {res && (
          <div className="space-y-3">
            <p className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-xs ${SEV[res.risk] ?? SEV["medium"]}`}>{L("Risk", "المخاطر")}: {res.risk}</span>{ar ? res.summaryAr || res.summary : res.summary}</p>
            <div><p className="font-medium">{L("Visual inconsistencies", "تناقضات بصرية")}</p>
              {res.inconsistencies.length ? <ul className="mt-1 space-y-1">{res.inconsistencies.map((x, i) => (
                <li key={i} className="rounded-lg bg-muted/40 p-2"><span className={`me-2 rounded-full px-2 py-0.5 text-xs ${SEV[x.severity] ?? SEV["medium"]}`}>{x.severity}</span><span className="text-xs text-muted-foreground">{L("Photo", "صورة")} {x.photo}</span> — {ar ? x.issueAr || x.issue : x.issue}</li>))}</ul>
                : <p className="text-muted-foreground">{L("None found.", "لم يُعثر على شيء.")}</p>}</div>
            <div><p className="font-medium">{L("Missing evidence", "أدلة ناقصة")}</p>
              {res.missingEvidence.length ? <ul className="mt-1 list-disc space-y-1 ps-5">{res.missingEvidence.map((x, i) => <li key={i}><span className="font-medium">{ar ? x.itemAr || x.item : x.item}</span> — <span className="text-muted-foreground">{ar ? x.whyAr || x.why : x.why}</span></li>)}</ul>
                : <p className="text-muted-foreground">{L("Nothing obvious is missing.", "لا شيء واضح ناقص.")}</p>}</div>
            {res.checks.length > 0 && <div><p className="font-medium">{L("Check next", "افحص تالياً")}</p><ol className="mt-1 list-decimal space-y-1 ps-5">{res.checks.map((c, i) => <li key={i}>{ar ? c.checkAr || c.check : c.check}</li>)}</ol></div>}
            <p className="text-xs text-muted-foreground">{L("Advice only — you make the decision.", "للاستئناس فقط — القرار لك.")}</p>
          </div>)}
      </div>
    </section>
  );
}
