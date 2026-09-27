import { useLocale } from "@/lib/i18n";
import { ActionButton } from "@/components/ActionButton";
import type { ActionState } from "@/components/ActionButton";

export type GateCopy = { title: string; titleAr: string; description: string; descriptionAr: string; altText: string; altTextAr: string };
export type GateIssue = { field: string; label: string; required: boolean };

/** Same rules as the database's listing_draft_publish_issues(); required ones block publishing. */
export function publishIssues(c: GateCopy, hasImage: boolean, img: { ratio: number | null; width: number | null }, L: (en: string, ar: string) => string): GateIssue[] {
  const out: GateIssue[] = [];
  const req = (field: string, label: string) => out.push({ field, label, required: true });
  if (!hasImage) req("image", L("Add an artwork image", "أضف صورة للعمل"));
  const title = (v: string, f: string, lang: string) => {
    if (!v.trim()) req(f, L(`${lang} title is empty`, `العنوان (${lang}) فارغ`));
    else if (v.length > 48) req(f, L(`${lang} title is over 48 characters and will be cut off on phones`, `العنوان (${lang}) أطول من 48 حرفاً وسيُقتطع على الهاتف`));
  };
  const desc = (v: string, f: string, lang: string) => {
    if (!v.trim()) req(f, L(`${lang} description is empty`, `الوصف (${lang}) فارغ`));
    else if (v.length > 700) req(f, L(`${lang} description is over 700 characters`, `الوصف (${lang}) أطول من 700 حرف`));
  };
  const alt = (v: string, t: string, f: string, lang: string, re: RegExp) => {
    if (!v.trim()) req(f, L(`${lang} alt text is empty`, `النص البديل (${lang}) فارغ`));
    else if (v.length > 140) req(f, L(`${lang} alt text is over 140 characters`, `النص البديل (${lang}) أطول من 140 حرفاً`));
    else if (re.test(v.trim())) req(f, L(`${lang} alt text starts with “image of”`, `النص البديل (${lang}) يبدأ بـ«صورة»`));
    else if (v.trim() === t.trim()) req(f, L(`${lang} alt text just repeats the title`, `النص البديل (${lang}) يكرر العنوان`));
  };
  title(c.title, "title", "English"); title(c.titleAr, "titleAr", L("Arabic", "العربي"));
  desc(c.description, "description", "English"); desc(c.descriptionAr, "descriptionAr", L("Arabic", "العربي"));
  alt(c.altText, c.title, "altText", "English", /^(image|picture|photo)\b/i);
  alt(c.altTextAr, c.titleAr, "altTextAr", L("Arabic", "العربي"), /^صورة/);
  if (hasImage && img.ratio != null && Math.abs(img.ratio - 0.8) / Math.max(img.ratio, 0.8) > 0.15)
    out.push({ field: "image", label: L("Image will be heavily cropped in the 4:5 phone frame", "ستُقتص الصورة كثيراً في إطار الهاتف 4:5"), required: false });
  if (hasImage && img.width != null && img.width < 1080)
    out.push({ field: "image", label: L("Image is under 1080 px wide and may look soft", "عرض الصورة أقل من 1080 بكسل وقد تبدو غير حادة"), required: false });
  return out;
}

export function focusField(field: string) {
  const el = document.getElementById(`f-${field}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.focus({ preventScroll: true });
}

export function PublishGate({ issues, submitted, state, error, onPublish, onRetry, onUnpublish }: {
  issues: GateIssue[]; submitted: boolean; state: ActionState; error: string;
  onPublish: () => void; onRetry: () => void; onUnpublish: () => void;
}) {
  const { locale } = useLocale();
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const blocking = issues.filter((i) => i.required);
  const advisory = issues.filter((i) => !i.required);
  const Row = ({ i }: { i: GateIssue }) => (
    <li><button type="button" onClick={() => focusField(i.field)} className="text-start underline decoration-dotted underline-offset-4 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{i.label}</button></li>
  );
  return (
    <section aria-labelledby="publish-gate-h" className={`rounded-sm border p-4 text-sm ${blocking.length ? "border-destructive/60" : "border-success/60"}`}>
      <h2 id="publish-gate-h" className="font-medium">{L("Ready to publish?", "جاهز للنشر؟")}</h2>
      <p className="sr-only" aria-live="polite">{blocking.length ? L(`${blocking.length} required fixes before publishing`, `${blocking.length} إصلاحات مطلوبة قبل النشر`) : L("All required checks pass", "اجتازت جميع الفحوص المطلوبة")}</p>
      {submitted ? (
        <p className="mt-1 text-success">{L("Submitted for publishing. Staff will review it before it goes live.", "أُرسل للنشر. سيراجعه الفريق قبل ظهوره.")}</p>
      ) : blocking.length ? (
        <>
          <p className="mt-1 text-destructive">{L(`Fix ${blocking.length} required item(s) to publish. Select one to jump to its field.`, `أصلح ${blocking.length} من البنود المطلوبة للنشر. اختر بنداً للانتقال إلى حقله.`)}</p>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-destructive">{blocking.map((i) => <Row key={i.field + i.label} i={i} />)}</ul>
        </>
      ) : <p className="mt-1 text-success">{L("All required mobile readiness checks pass.", "اجتازت جميع فحوص الجاهزية للهاتف المطلوبة.")}</p>}
      {advisory.length > 0 && (
        <>
          <p className="mt-3 text-muted-foreground">{L("Recommended (won't block publishing):", "موصى به (لا يمنع النشر):")}</p>
          <ul className="mt-1 list-disc space-y-1 ps-5 text-warning">{advisory.map((i) => <Row key={i.field + i.label} i={i} />)}</ul>
        </>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {submitted ? (
          <button type="button" onClick={onUnpublish} className="rounded-sm border border-border px-4 py-2">{L("Withdraw and edit", "اسحب وعدّل")}</button>
        ) : (
          <ActionButton state={state} disabled={blocking.length > 0} onClick={onPublish} onRetry={onRetry}
            loadingLabel={L("Submitting…", "جارٍ الإرسال…")} successLabel={L("Submitted", "أُرسل")}
            errorLabel={error || L("Couldn't submit.", "تعذّر الإرسال.")} retryLabel={L("Try again", "حاول مجدداً")}
            className="rounded-sm bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">
            {L("Publish listing", "انشر الإعلان")}
          </ActionButton>
        )}
        {blocking.length > 0 && !submitted && <span className="text-xs text-muted-foreground">{L("Publishing is locked until the required items are fixed.", "النشر مقفل حتى تُصلح البنود المطلوبة.")}</span>}
      </div>
    </section>
  );
}
