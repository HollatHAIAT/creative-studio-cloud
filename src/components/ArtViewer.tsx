import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, Maximize2, Play, Pause } from "lucide-react";
import { useLocale } from "@/lib/i18n";

/**
 * Artwork image stage: "living" slow drift + tilt + light sheen, brush-reveal when switching
 * images, and a full-screen viewer with wheel/pinch/double-tap zoom, drag to pan, swipe and arrow keys.
 */
export function ArtStage({ images, index, onIndex, alt, children }: {
  images: string[]; index: number; onIndex: (i: number) => void; alt: string; children?: React.ReactNode;
}) {
  const { locale } = useLocale(); const L = (e: string, a: string) => (locale === "ar" ? a : e);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const tilt = (e: React.PointerEvent) => {
    const el = ref.current; if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--tx", String((e.clientX - r.left) / r.width - 0.5));
    el.style.setProperty("--ty", String((e.clientY - r.top) / r.height - 0.5));
  };
  const reset = () => { ref.current?.style.setProperty("--tx", "0"); ref.current?.style.setProperty("--ty", "0"); };
  const src = images[index] ?? images[0] ?? "";
  return (
    <>
      <div ref={ref} onPointerMove={tilt} onPointerLeave={reset} className="art-living group relative overflow-hidden rounded-sm bg-muted">
        <button type="button" onClick={() => setOpen(true)} aria-label={L("Open full-screen viewer and zoom", "افتح العارض بملء الشاشة للتكبير")} className="block w-full cursor-zoom-in focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <img key={src} src={src} alt={alt} className="art-drift brush-reveal aspect-[4/5] w-full object-cover" />
          <span aria-hidden className="art-sheen" />
        </button>
        <span className="pointer-events-none absolute bottom-3 start-3 inline-flex items-center gap-1 rounded-full bg-background/85 px-3 py-1 text-xs opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100"><Maximize2 className="h-3 w-3" aria-hidden />{L("Tap to zoom", "اضغط للتكبير")}</span>
        {children}
      </div>
      {open && <ArtLightbox images={images} index={index} onIndex={onIndex} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ArtLightbox({ images, index, onIndex, alt, onClose }: {
  images: string[]; index: number; onIndex: (i: number) => void; alt: string; onClose: () => void;
}) {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const [z, setZ] = useState(1); const [p, setP] = useState({ x: 0, y: 0 });
  const [play, setPlay] = useState(false);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const pts = useRef(new Map<number, { x: number; y: number }>()); const pinch = useRef<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const n = images.length;
  const clampZ = (v: number) => Math.min(5, Math.max(1, v));
  const go = useCallback((d: number) => { if (n < 2) return; onIndex((index + d + n) % n); setZ(1); setP({ x: 0, y: 0 }); }, [index, n, onIndex]);
  const setZoom = (v: number) => { const c = clampZ(v); setZ(c); if (c === 1) setP({ x: 0, y: 0 }); };

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus(); document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(ar ? -1 : 1);
      else if (e.key === "ArrowLeft") go(ar ? 1 : -1);
      else if (e.key === "+" || e.key === "=") setZoom(z + 0.5);
      else if (e.key === "-") setZoom(z - 0.5);
    };
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = ""; prev?.focus(); };
  }, [go, onClose, ar, z]);
  useEffect(() => { if (!play || n < 2) return; const t = setInterval(() => go(1), 4000); return () => clearInterval(t); }, [play, go, n]);

  const down = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 2) { const [a, b] = [...pts.current.values()]; pinch.current = Math.hypot(a!.x - b!.x, a!.y - b!.y) / z; }
    else drag.current = { x: e.clientX, y: e.clientY, px: p.x, py: p.y };
  };
  const move = (e: React.PointerEvent) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 2 && pinch.current) { const [a, b] = [...pts.current.values()]; setZoom(Math.hypot(a!.x - b!.x, a!.y - b!.y) / pinch.current); return; }
    if (drag.current && z > 1) setP({ x: drag.current.px + (e.clientX - drag.current.x) / z, y: drag.current.py + (e.clientY - drag.current.y) / z });
  };
  const up = (e: React.PointerEvent) => {
    const d = drag.current; pts.current.delete(e.pointerId);
    if (pts.current.size < 2) pinch.current = null;
    if (d && z === 1 && pts.current.size === 0) { const dx = e.clientX - d.x; if (Math.abs(dx) > 60) go((dx < 0 ? 1 : -1) * (ar ? -1 : 1)); }
    if (pts.current.size === 0) drag.current = null;
  };
  const btn = "rounded-full bg-background/15 p-3 text-background backdrop-blur hover:bg-background/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-background";

  return (
    <div role="dialog" aria-modal="true" aria-label={L("Artwork viewer", "عارض العمل الفني")} className="fixed inset-0 z-[90] flex flex-col bg-foreground animate-fade-in">
      <div className="flex items-center justify-between gap-2 p-3 text-background">
        <span className="text-sm opacity-80" aria-live="polite">{n > 1 ? `${index + 1} / ${n}` : ""} · {Math.round(z * 100)}%</span>
        <div className="flex gap-2">
          <button type="button" className={btn} onClick={() => setZoom(z - 0.5)} aria-label={L("Zoom out", "تصغير")}><ZoomOut className="h-4 w-4" /></button>
          <button type="button" className={btn} onClick={() => setZoom(z + 0.5)} aria-label={L("Zoom in", "تكبير")}><ZoomIn className="h-4 w-4" /></button>
          {n > 1 && <button type="button" className={btn} onClick={() => setPlay(!play)} aria-pressed={play} aria-label={play ? L("Pause slideshow", "أوقف العرض") : L("Play slideshow", "شغّل العرض")}>{play ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>}
          <button ref={closeRef} type="button" className={btn} onClick={onClose} aria-label={L("Close viewer", "أغلق العارض")}><X className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="relative flex-1 touch-none select-none overflow-hidden"
        onWheel={(e) => setZoom(z - e.deltaY * 0.002)}
        onDoubleClick={() => setZoom(z > 1 ? 1 : 2.5)}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        style={{ cursor: z > 1 ? "grab" : "zoom-in" }}>
        <img key={images[index]} src={images[index]} alt={alt} draggable={false}
          className="brush-reveal absolute inset-0 m-auto max-h-full max-w-full object-contain transition-transform duration-150 ease-out"
          style={{ transform: `scale(${z}) translate(${p.x}px, ${p.y}px)` }} />
        {n > 1 && (<>
          <button type="button" className={`${btn} absolute start-3 top-1/2 -translate-y-1/2`} onClick={() => go(-1)} aria-label={L("Previous image", "الصورة السابقة")}>{ar ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}</button>
          <button type="button" className={`${btn} absolute end-3 top-1/2 -translate-y-1/2`} onClick={() => go(1)} aria-label={L("Next image", "الصورة التالية")}>{ar ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}</button>
        </>)}
      </div>
      <p className="p-3 text-center text-xs text-background/70">{L("Scroll, pinch or double-tap to zoom · drag to move · swipe or arrow keys to change image", "مرّر أو باعد الأصابع أو انقر مرتين للتكبير · اسحب للتحريك · اسحب جانباً أو استخدم الأسهم للتنقل")}</p>
      {n > 1 && (
        <div className="flex justify-center gap-2 pb-4">
          {images.map((s, i) => (
            <button key={i} type="button" onClick={() => { onIndex(i); setZoom(1); }} aria-label={L(`Image ${i + 1}`, `الصورة ${i + 1}`)} aria-current={i === index}
              className={`h-12 w-12 overflow-hidden rounded-md border-2 ${i === index ? "border-background" : "border-transparent opacity-60"}`}><img src={s} alt="" className="h-full w-full object-cover" /></button>
          ))}
        </div>)}
    </div>
  );
}
