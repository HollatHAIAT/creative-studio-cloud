import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ImagePlus, Star, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";

const sb = supabase as any;
const BUCKET = "artwork-images";
const MAX_IMAGES = 12;
const MAX_BYTES = 10 * 1024 * 1024;
export type GalleryItem = { path: string; alt: string; altAr: string };
type Row = GalleryItem & { url?: string };

/** Extra artwork photos for a draft: upload, caption, reorder, remove, or promote one to the main image. */
export function GalleryEditor({ draftId, onSave, onMakeMain }: { draftId: string | null; onSave: () => Promise<string | null>; onMakeMain?: (path: string) => void }) {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const [items, setItems] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!draftId) { setItems([]); return; }
    void (async () => {
      const { data } = await sb.from("listing_drafts").select("gallery").eq("id", draftId).single();
      const g: GalleryItem[] = Array.isArray(data?.gallery) ? data.gallery : [];
      setItems(await Promise.all(g.map(async (i) => ({ ...i, url: (await supabase.storage.from(BUCKET).createSignedUrl(i.path, 3600)).data?.signedUrl }))));
    })();
  }, [draftId]);

  async function persist(next: Row[], id = draftId) {
    setItems(next);
    if (!id) return;
    const { error } = await sb.from("listing_drafts").update({ gallery: next.map(({ path, alt, altAr }) => ({ path, alt, altAr })) }).eq("id", id);
    if (error) toast.error(L("Couldn't save the gallery.", "تعذّر حفظ المعرض."));
  }

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const id = draftId ?? (await onSave());
      if (!id) return;
      const { data: u } = await supabase.auth.getUser();
      const next = [...items];
      for (const f of Array.from(files)) {
        if (next.length >= MAX_IMAGES) { toast.error(L(`Up to ${MAX_IMAGES} photos.`, `حتى ${MAX_IMAGES} صورة.`)); break; }
        if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type) || f.size > MAX_BYTES) { toast.error(L(`${f.name}: use PNG/JPG/WEBP/GIF under 10 MB.`, `${f.name}: استخدم PNG/JPG/WEBP/GIF أقل من ١٠ ميجابايت.`)); continue; }
        const p = `${u.user!.id}/gallery/${crypto.randomUUID()}.${f.name.split(".").pop()?.toLowerCase() || "jpg"}`;
        const { error } = await supabase.storage.from(BUCKET).upload(p, f, { contentType: f.type });
        if (error) { toast.error(L("Upload failed.", "فشل الرفع.")); continue; }
        next.push({ path: p, alt: "", altAr: "", url: URL.createObjectURL(f) });
      }
      await persist(next, id);
    } finally { setBusy(false); }
  }

  const move = (i: number, d: number) => { const n = [...items]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; void persist(n); };
  const remove = async (i: number) => { const r = items[i]; await persist(items.filter((_, k) => k !== i)); await supabase.storage.from(BUCKET).remove([r.path]); };
  const setAlt = (i: number, k: "alt" | "altAr", v: string) => setItems((s) => s.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  return (
    <section aria-labelledby="gal-h" className="rounded-2xl border border-border p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="gal-h" className="font-display text-lg">{L("Photo gallery", "معرض الصور")}</h3>
          <p className="text-sm text-muted-foreground">{L("Add details, back, signature or framing. Order here is the order buyers see, after the main image.", "أضف التفاصيل والخلف والتوقيع والإطار. يظهر الترتيب هنا للمشترين بعد الصورة الرئيسية.")}</p>
        </div>
        <label className={`inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:border-primary ${busy || items.length >= MAX_IMAGES ? "pointer-events-none opacity-50" : ""}`}>
          <ImagePlus aria-hidden className="h-4 w-4" />{busy ? L("Uploading…", "جارٍ الرفع…") : L("Add photos", "أضف صورًا")}
          <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
      {items.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{L("No extra photos yet.", "لا صور إضافية بعد.")}</p> : (
        <ol className="mt-4 space-y-3">
          {items.map((it, i) => (
            <li key={it.path} className="flex gap-3 rounded-xl border border-border p-2">
              {it.url ? <img src={it.url} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" /> : <div className="h-20 w-20 shrink-0 rounded-lg bg-muted" />}
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-xs text-muted-foreground">{L(`Photo ${i + 2}`, `الصورة ${i + 2}`)}</p>
                <input aria-label={L("Description (English)", "الوصف (إنجليزي)")} dir="ltr" value={it.alt} maxLength={200} onChange={(e) => setAlt(i, "alt", e.target.value)} onBlur={() => void persist(items)} placeholder="e.g. Close-up of the signature" className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm" />
                <input aria-label={L("Description (Arabic)", "الوصف (عربي)")} dir="rtl" value={it.altAr} maxLength={200} onChange={(e) => setAlt(i, "altAr", e.target.value)} onBlur={() => void persist(items)} placeholder="مثال: لقطة قريبة للتوقيع" className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={L("Move up", "انقل للأعلى")} className="rounded-md p-1 hover:bg-muted disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={L("Move down", "انقل للأسفل")} className="rounded-md p-1 hover:bg-muted disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                {onMakeMain && <button type="button" onClick={() => { onMakeMain(it.path); void persist(items.filter((_, k) => k !== i)); }} aria-label={L("Make main image", "اجعلها الصورة الرئيسية")} title={L("Make main image", "اجعلها الصورة الرئيسية")} className="rounded-md p-1 hover:bg-muted"><Star className="h-4 w-4" /></button>}
                <button type="button" onClick={() => void remove(i)} aria-label={L("Remove", "احذف")} className="rounded-md p-1 text-destructive hover:bg-muted"><X className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
