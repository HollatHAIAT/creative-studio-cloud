import { useCallback, useEffect, useState, type RefObject } from "react";
import { useLocale } from "@/lib/i18n";

type Result = { ok: boolean; label: string; detail?: string | undefined };
type Group = { name: string; items: Result[] };

const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable="true"]';

function accName(el: Element): string {
  const lb = el.getAttribute("aria-labelledby");
  if (lb) return lb.split(/\s+/).map((id) => el.ownerDocument.getElementById(id)?.textContent ?? "").join(" ").trim();
  const aria = el.getAttribute("aria-label")?.trim();
  if (aria) return aria;
  if (el instanceof HTMLImageElement) return el.alt.trim();
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    const lab = el.labels?.[0]?.textContent?.trim();
    return lab || el.getAttribute("placeholder")?.trim() || el.title.trim();
  }
  const imgs = [...el.querySelectorAll("img")].map((i) => i.alt).join(" ");
  return ((el.textContent ?? "") + " " + imgs).trim() || (el as HTMLElement).title?.trim() || "";
}

const describe = (el: Element) => {
  const name = accName(el).slice(0, 40);
  return `<${el.tagName.toLowerCase()}>${name ? ` “${name}”` : ""}`;
};

const visible = (el: HTMLElement) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && getComputedStyle(el).visibility !== "hidden";

function focusIndicator(el: HTMLElement): boolean {
  const before = getComputedStyle(el);
  const b = { o: before.outlineStyle + before.outlineWidth + before.outlineColor, s: before.boxShadow, bc: before.borderColor, bg: before.backgroundColor };
  (el.focus as (o?: FocusOptions & { focusVisible?: boolean }) => void)({ preventScroll: true, focusVisible: true });
  if (el.ownerDocument.activeElement !== el) return false;
  const a = getComputedStyle(el);
  const hasOutline = a.outlineStyle !== "none" && parseFloat(a.outlineWidth) > 0;
  const changed = a.outlineStyle + a.outlineWidth + a.outlineColor !== b.o || a.boxShadow !== b.s || a.borderColor !== b.bc || a.backgroundColor !== b.bg;
  el.blur();
  return hasOutline || changed;
}

/** Runs keyboard, focus and screen-reader checks against the rendered DOM inside `target`. */
export function A11yAudit({ target, watch }: { target: RefObject<HTMLElement | null>; watch: unknown }) {
  const { locale } = useLocale();
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [ranAt, setRanAt] = useState<Date | null>(null);

  const run = useCallback(() => {
    const root = target.current;
    if (!root) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const all = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible);
    const focusables = all.filter((el) => el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled);
    const positive = all.filter((el) => el.tabIndex > 0);
    const fakeButtons = [...root.querySelectorAll<HTMLElement>('[role="button"], [role="link"], [onclick]')].filter((el) => !el.matches(FOCUSABLE));
    const lookLikeButtons = [...root.querySelectorAll<HTMLElement>("div, span")].filter((el) => /^(buy now|add to basket|اشترِ الآن|أضف إلى السلة)$/i.test(el.textContent?.trim() ?? "") && !el.querySelector(FOCUSABLE));
    const unreachable = focusables.filter((el) => { el.focus({ preventScroll: true }); const ok = document.activeElement === el; el.blur(); return !ok; });
    const noRing = focusables.filter((el) => !focusIndicator(el));
    const hiddenFocusable = [...root.querySelectorAll<HTMLElement>('[aria-hidden="true"]')].filter((el) => el.matches(FOCUSABLE) || el.querySelector(FOCUSABLE));

    const imgs = [...root.querySelectorAll("img")];
    const noAlt = imgs.filter((i) => !i.hasAttribute("alt") || (!i.alt.trim() && i.getAttribute("role") !== "presentation"));
    const unnamed = [...root.querySelectorAll<HTMLElement>('button, a[href], [role="button"], input, select, textarea')].filter((el) => visible(el) && !accName(el));
    const headings = root.querySelectorAll("h1,h2,h3,h4,h5,h6");
    const langOk = [...root.querySelectorAll<HTMLElement>("[dir]")].every((el) => el.getAttribute("dir") !== "rtl" || el.closest("[lang]")?.getAttribute("lang") === "ar");
    prevFocus?.focus?.({ preventScroll: true });

    const list = (els: Element[]) => (els.length ? els.slice(0, 4).map(describe).join(", ") + (els.length > 4 ? ` +${els.length - 4}` : "") : undefined);
    setGroups([
      { name: L("Keyboard navigation", "التنقل بلوحة المفاتيح"), items: [
        { ok: focusables.length > 0 && lookLikeButtons.length === 0, label: L("Buying actions can be reached with Tab", "يمكن الوصول إلى أزرار الشراء بمفتاح Tab"), detail: lookLikeButtons.length ? L(`Looks like a button but isn't one: ${list(lookLikeButtons)}`, `يبدو زراً لكنه ليس زراً: ${list(lookLikeButtons)}`) : focusables.length ? undefined : L("Nothing in the listing can be focused.", "لا يوجد عنصر قابل للتركيز.") },
        { ok: unreachable.length === 0, label: L("Every control accepts keyboard focus", "كل عنصر يقبل تركيز لوحة المفاتيح"), detail: list(unreachable) },
        { ok: positive.length === 0, label: L("Tab order follows the page (no tabindex above 0)", "ترتيب Tab يتبع الصفحة (لا tabindex أكبر من 0)"), detail: list(positive) },
        { ok: fakeButtons.length === 0, label: L("No click-only elements", "لا عناصر تعمل بالنقر فقط"), detail: list(fakeButtons) },
        { ok: hiddenFocusable.length === 0, label: L("No focusable items hidden from screen readers", "لا عناصر قابلة للتركيز مخفية عن قارئ الشاشة"), detail: list(hiddenFocusable) },
      ] },
      { name: L("Focus visibility", "وضوح التركيز"), items: [
        { ok: noRing.length === 0, label: L("A visible focus ring appears on each control", "تظهر حلقة تركيز واضحة على كل عنصر"), detail: noRing.length ? L(`No visible change on focus: ${list(noRing)}`, `لا تغيير ظاهر عند التركيز: ${list(noRing)}`) : undefined },
      ] },
      { name: L("Screen-reader labels", "تسميات قارئ الشاشة"), items: [
        { ok: imgs.length > 0 && noAlt.length === 0, label: L("Artwork image has alt text", "لصورة العمل نص بديل"), detail: imgs.length ? list(noAlt) : L("No image in the listing.", "لا توجد صورة في الإعلان.") },
        { ok: unnamed.length === 0, label: L("Buttons, links and fields have names", "للأزرار والروابط والحقول أسماء"), detail: list(unnamed) },
        { ok: headings.length > 0, label: L("Listing title is a heading", "عنوان الإعلان عنوان رئيسي"), detail: headings.length ? undefined : L("Screen-reader users jump by headings.", "يتنقل مستخدمو قارئ الشاشة عبر العناوين.") },
        { ok: langOk, label: L("Arabic text is marked as Arabic", "النص العربي معلَّم بأنه عربي"), detail: langOk ? undefined : L("Add lang=\"ar\" so it's pronounced correctly.", "أضف lang=\"ar\" لينطق صحيحاً.") },
      ] },
    ]);
    setRanAt(new Date());
  }, [target, locale]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { const id = setTimeout(run, 300); return () => clearTimeout(id); }, [run, watch]);

  const items = groups?.flatMap((g) => g.items) ?? [];
  const fails = items.filter((i) => !i.ok).length;

  return (
    <section aria-labelledby="a11y-audit-h" className="rounded-sm border border-border p-3 text-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id="a11y-audit-h" className="font-medium">{L("Accessibility audit", "تدقيق إمكانية الوصول")}
          {groups && <> · <span className={fails ? "text-warning" : "text-success"}>{fails ? L(`${fails} to fix`, `${fails} للإصلاح`) : L("All clear", "كلها سليمة")}</span></>}
        </h2>
        <button type="button" onClick={run} className="rounded-sm border border-border px-3 py-1 hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{L("Run audit again", "أعد التدقيق")}</button>
      </div>
      <p className="sr-only" aria-live="polite">{groups ? (fails ? L(`${fails} accessibility issues found`, `وُجدت ${fails} مشكلات`) : L("No accessibility issues found", "لا توجد مشكلات")) : ""}</p>
      {groups?.map((g) => (
        <div key={g.name} className="mb-2">
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground">{g.name}</h3>
          <ul className="space-y-1">{g.items.map((i) => (
            <li key={i.label} className="flex gap-2">
              <span aria-hidden className={i.ok ? "text-success" : "text-destructive"}>{i.ok ? "✓" : "✕"}</span>
              <span className="min-w-0"><span className="sr-only">{i.ok ? L("Passed: ", "ناجح: ") : L("Needs fixing: ", "يحتاج إصلاحاً: ")}</span>{i.label}
                {!i.ok && i.detail && <span className="block break-words text-xs text-muted-foreground">{i.detail}</span>}</span>
            </li>
          ))}</ul>
        </div>
      ))}
      {ranAt && <p className="text-xs text-muted-foreground">{L("Checked the preview above as buyers will use it. Also try it yourself: press Tab through the preview.", "فُحصت المعاينة أعلاه كما سيستخدمها المشترون. جرّب أيضاً الضغط على Tab عبر المعاينة.")}</p>}
    </section>
  );
}
