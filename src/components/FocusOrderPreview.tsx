import { useCallback, useEffect, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useLocale } from "@/lib/i18n";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';

type Stop = { el: HTMLElement; name: string; kind: string; indicator: boolean | null };

const nameOf = (el: HTMLElement) =>
  (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || (el as HTMLInputElement).placeholder || "").trim().replace(/\s+/g, " ").slice(0, 60);
const kindOf = (el: HTMLElement) => el.getAttribute("role") || (el.tagName === "A" ? "link" : el.tagName === "INPUT" ? (el as HTMLInputElement).type : el.tagName.toLowerCase());

/** Visual focus indicator = outline, box-shadow or border changes when the element is focused with the keyboard. */
function snapshot(el: HTMLElement) {
  const s = getComputedStyle(el);
  return [s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0 ? `${s.outlineStyle}${s.outlineWidth}${s.outlineColor}` : "", s.boxShadow, s.borderColor, s.backgroundColor, s.textDecorationLine].join("|");
}

/** Step through the preview's interactive elements in Tab order; flags stops that show no visible focus indicator. */
export function FocusOrderPreview({ target, watch }: { target: RefObject<HTMLElement | null>; watch: unknown[] }) {
  const { locale } = useLocale(); const L = (e: string, a: string) => (locale === "ar" ? a : e);
  const [stops, setStops] = useState<Stop[]>([]);
  const [at, setAt] = useState(-1);
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const scan = useCallback(() => {
    const root = target.current; if (!root) { setStops([]); return; }
    const els = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el.getClientRects().length > 0);
    // Tab order: positive tabindex first (ascending), then document order.
    const ordered = [...els.filter((e) => e.tabIndex > 0).sort((a, b) => a.tabIndex - b.tabIndex), ...els.filter((e) => e.tabIndex <= 0)];
    setStops(ordered.map((el) => ({ el, name: nameOf(el), kind: kindOf(el), indicator: null })));
    setAt(-1); setBox(null);
  }, [target]);
  useEffect(() => { scan(); }, [scan, ...watch]); // eslint-disable-line react-hooks/exhaustive-deps

  function go(i: number) {
    if (i < 0 || i >= stops.length) return;
    const el = stops[i]!.el;
    (document.activeElement as HTMLElement | null)?.blur?.();
    const before = snapshot(el);
    el.focus({ preventScroll: false, focusVisible: true } as FocusOptions);
    // focus-visible only matches for keyboard-like focus; programmatic focus after a key press counts in modern browsers.
    const after = snapshot(el);
    const indicator = before !== after || el.matches(":focus-visible") && getComputedStyle(el).outlineStyle !== "none" && parseFloat(getComputedStyle(el).outlineWidth) > 0;
    setStops((s) => s.map((x, j) => (j === i ? { ...x, indicator } : x)));
    setAt(i);
    const r = el.getBoundingClientRect(), pr = target.current!.getBoundingClientRect();
    setBox({ top: r.top - pr.top, left: r.left - pr.left, width: r.width, height: r.height });
  }
  const checked = stops.filter((s) => s.indicator !== null);
  const missing = stops.filter((s) => s.indicator === false);

  return (
    <section aria-labelledby="fop-h" className="space-y-3 rounded-xl border border-border p-3 text-sm">
      {box && target.current && <FocusBox host={target.current} box={box} ok={stops[at]?.indicator !== false} />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 id="fop-h" className="font-medium">{L("Keyboard preview", "معاينة لوحة المفاتيح")}</h4>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => go(at - 1)} disabled={at <= 0} aria-label={L("Previous stop (Shift+Tab)", "المحطة السابقة (Shift+Tab)")} className="rounded-full border border-border p-1.5 disabled:opacity-40"><ChevronLeft className="h-4 w-4 rtl:rotate-180" /></button>
          <button type="button" onClick={() => go(at + 1)} disabled={at >= stops.length - 1 || stops.length === 0} className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-primary-foreground disabled:opacity-40">
            {at < 0 ? L("Start (Tab)", "ابدأ (Tab)") : L("Next (Tab)", "التالي (Tab)")}<ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden /></button>
          <button type="button" onClick={scan} aria-label={L("Start over", "ابدأ من جديد")} className="rounded-full border border-border p-1.5"><RotateCcw className="h-4 w-4" /></button>
        </div>
      </div>
      <p className="text-muted-foreground">{L("Moves through the listing the way the Tab key does. Each stop is focused in the preview so you can see whether it shows a clear outline.", "يتنقّل في الإعلان كما يفعل مفتاح Tab. تُحدَّد كل محطة في المعاينة لترى هل يظهر حولها إطار واضح.")}</p>
      {stops.length === 0 ? <p role="status" className="text-warning">{L("Nothing in the listing can be reached with the keyboard.", "لا يمكن الوصول لأي عنصر في الإعلان بلوحة المفاتيح.")}</p> : (
        <ol className="space-y-1">{stops.map((s, i) => (
          <li key={i}>
            <button type="button" onClick={() => go(i)} aria-current={i === at ? "step" : undefined}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-start ${i === at ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted"}`}>
              <span className="w-5 text-xs text-muted-foreground">{i + 1}</span>
              <span className="text-xs text-muted-foreground">{s.kind}</span>
              <span className="flex-1 truncate">{s.name || <em className="text-destructive">{L("no name", "بلا اسم")}</em>}</span>
              {s.indicator === true && <span className="text-xs text-success">✓ {L("visible focus", "إطار ظاهر")}</span>}
              {s.indicator === false && <span className="text-xs text-destructive">✗ {L("no focus indicator", "بلا إطار تركيز")}</span>}
            </button>
          </li>))}</ol>)}
      <p role="status" aria-live="polite" className={missing.length ? "text-destructive" : "text-muted-foreground"}>
        {at >= 0 && `${L("Stop", "المحطة")} ${at + 1}/${stops.length}: ${stops[at]?.name || L("no name", "بلا اسم")}. `}
        {checked.length === 0 ? L(`${stops.length} stops. Step through them to check focus indicators.`, `${stops.length} محطات. تنقّل بينها لفحص إطارات التركيز.`)
          : missing.length ? L(`${missing.length} of ${checked.length} checked stops show no visible focus. Add an outline or ring on focus.`, `${missing.length} من ${checked.length} محطات مفحوصة بلا إطار تركيز ظاهر. أضف إطاراً عند التركيز.`)
          : L(`All ${checked.length} checked stops show visible focus.`, `كل المحطات المفحوصة (${checked.length}) يظهر حولها إطار التركيز.`)}
      </p>
    </section>
  );
}

function FocusBox({ host, box, ok }: { host: HTMLElement; box: { top: number; left: number; width: number; height: number }; ok: boolean }) {
  // Render the marker inside the preview container so it lines up with the element.
  useEffect(() => {
    const m = document.createElement("div");
    m.setAttribute("aria-hidden", "true");
    Object.assign(m.style, { position: "absolute", top: `${box.top - 4}px`, left: `${box.left - 4}px`, width: `${box.width + 8}px`, height: `${box.height + 8}px`,
      border: `2px dashed ${ok ? "hsl(var(--primary))" : "hsl(var(--destructive))"}`, borderRadius: "8px", pointerEvents: "none", zIndex: "20" });
    const prev = host.style.position; if (getComputedStyle(host).position === "static") host.style.position = "relative";
    host.appendChild(m);
    return () => { m.remove(); host.style.position = prev; };
  }, [host, box, ok]);
  return null;
}
