import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale } from "@/lib/i18n";

export type GalleryImage = { url: string; alt: string; altAr: string };

/** Main image with arrows and a thumbnail strip, in the seller's chosen order. */
export function ListingGallery({ images }: { images: GalleryImage[] }) {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const [i, setI] = useState(0);
  if (!images.length) return <div className="aspect-[4/5] rounded-2xl bg-muted" />;
  const cur = images[Math.min(i, images.length - 1)];
  const go = (d: number) => setI((x) => (x + d + images.length) % images.length);
  return (
    <div>
      <div className="relative">
        <img src={cur.url} alt={(ar ? cur.altAr : cur.alt) || ""} className="aspect-[4/5] w-full rounded-2xl bg-muted object-contain" />
        {images.length > 1 && <>
          <button type="button" onClick={() => go(-1)} aria-label={L("Previous photo", "الصورة السابقة")} className="absolute start-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 shadow"><ChevronLeft className="h-5 w-5 rtl:rotate-180" /></button>
          <button type="button" onClick={() => go(1)} aria-label={L("Next photo", "الصورة التالية")} className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 shadow"><ChevronRight className="h-5 w-5 rtl:rotate-180" /></button>
          <span className="absolute bottom-2 end-2 rounded-full bg-background/80 px-2 py-0.5 text-xs">{i + 1} / {images.length}</span>
        </>}
      </div>
      {images.length > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((im, k) => (
            <li key={k}><button type="button" onClick={() => setI(k)} aria-label={L(`Show photo ${k + 1}`, `اعرض الصورة ${k + 1}`)} aria-current={k === i} className={`block h-16 w-16 overflow-hidden rounded-lg border-2 ${k === i ? "border-primary" : "border-transparent"}`}>
              <img src={im.url} alt="" className="h-full w-full object-cover" />
            </button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
