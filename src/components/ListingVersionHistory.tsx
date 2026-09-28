import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";
import { ResubmissionCheck } from "./ResubmissionCheck";
import { RecurringIssues } from "./RecurringIssues";
import { FieldComments, useVersionComments } from "./FieldComments";

type V = { id: string; version: number; title: string; title_ar: string; description: string; description_ar: string; alt_text: string; alt_text_ar: string; tags: string[]; medium: string; image_path: string | null; previous_review_note: string | null; created_at: string };

/** Word-level diff (LCS). Returns tokens tagged same/add/del. */
export function wordDiff(a: string, b: string): { t: string; k: "same" | "add" | "del" }[] {
  const A = a.split(/(\s+)/).filter(Boolean), B = b.split(/(\s+)/).filter(Boolean);
  if (A.length * B.length > 250000) return [...(a ? [{ t: a, k: "del" as const }] : []), ...(b ? [{ t: b, k: "add" as const }] : [])];
  const m = A.length, n = B.length, dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) dp[i]![j] = A[i] === B[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const out: { t: string; k: "same" | "add" | "del" }[] = []; let i = 0, j = 0;
  while (i < m && j < n) { if (A[i] === B[j]) { out.push({ t: A[i]!, k: "same" }); i++; j++; } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) out.push({ t: A[i++]!, k: "del" }); else out.push({ t: B[j++]!, k: "add" }); }
  while (i < m) out.push({ t: A[i++]!, k: "del" }); while (j < n) out.push({ t: B[j++]!, k: "add" });
  return out;
}

const FIELDS = [["title", "Title (EN)", "العنوان (EN)", "ltr"], ["title_ar", "Title (AR)", "العنوان (AR)", "rtl"], ["description", "Description (EN)", "الوصف (EN)", "ltr"], ["description_ar", "Description (AR)", "الوصف (AR)", "rtl"],
  ["alt_text", "Alt text (EN)", "النص البديل (EN)", "ltr"], ["alt_text_ar", "Alt text (AR)", "النص البديل (AR)", "rtl"], ["medium", "Medium", "الوسيط", "ltr"]] as const;

export function ListingVersionHistory({ draftId }: { draftId: string }) {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const q = useQuery({
    queryKey: ["admin", "draft-versions", draftId],
    queryFn: async () => {
      const { data, error } = await supabase.from("listing_draft_versions" as never).select("*").eq("draft_id", draftId).order("version", { ascending: false });
      if (error) throw error; return (data ?? []) as unknown as V[];
    },
  });
  const vs = q.data ?? [];
  const cq = useVersionComments(draftId); const cs = cq.data ?? [];
  const [pick, setPick] = useState<number | null>(null);
  const cur = vs.find((v) => v.version === pick) ?? vs[0];
  const prev = cur ? vs.find((v) => v.version === cur.version - 1) : undefined;
  const changed = useMemo(() => !cur || !prev ? [] : FIELDS.filter(([k]) => cur[k] !== prev[k]).map(([k]) => k), [cur, prev]);
  const tagsAdded = cur && prev ? cur.tags.filter((t) => !prev.tags.includes(t)) : [];
  const tagsRemoved = cur && prev ? prev.tags.filter((t) => !cur.tags.includes(t)) : [];
  const imageChanged = !!cur && !!prev && cur.image_path !== prev.image_path;
  const fmt = (t: string) => new Date(t).toLocaleString(ar ? "ar-SA" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">…</p>;
  if (q.error) return <p role="alert" className="text-sm text-destructive">{L("Couldn't load the revision history.", "تعذّر تحميل سجل التعديلات.")}</p>;
  if (vs.length === 0) return null;

  return (
    <section aria-labelledby="vh-h" className="space-y-4 rounded-2xl border border-border p-4 md:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="vh-h" className="font-medium">{L("Revision history", "سجل التعديلات")} ({vs.length})</h3>
        <label className="text-sm">{L("Compare version", "قارن الإصدار")}{" "}
          <select value={cur?.version} onChange={(e) => setPick(Number(e.target.value))} className="rounded-xl border border-border bg-background px-2 py-1">
            {vs.map((v) => <option key={v.id} value={v.version}>v{v.version} · {fmt(v.created_at)}</option>)}
          </select>
          {prev && <span className="ms-2 text-muted-foreground">{L(`with v${prev.version}`, `مع الإصدار ${prev.version}`)}</span>}
        </label>
      </div>

      {!prev ? <p className="text-sm text-muted-foreground">{L("This is the first submission — there's no earlier version to compare.", "هذا أول إرسال — لا يوجد إصدار سابق للمقارنة.")}</p> : (<>
        {cur!.previous_review_note && (
          <div className="rounded-xl bg-muted/50 p-3 text-sm"><p className="font-medium">{L(`What the reviewer asked after v${prev.version}`, `ما طلبه المراجع بعد الإصدار ${prev.version}`)}</p><p className="mt-1 whitespace-pre-line">{cur!.previous_review_note}</p></div>)}
        <p className="text-sm" aria-live="polite">
          {changed.length + (tagsAdded.length || tagsRemoved.length ? 1 : 0) + (imageChanged ? 1 : 0) === 0
            ? L("No changes from the previous version.", "لا تغييرات عن الإصدار السابق.")
            : L(`${changed.length + (tagsAdded.length || tagsRemoved.length ? 1 : 0) + (imageChanged ? 1 : 0)} part(s) changed.`, `تغيّر ${changed.length + (tagsAdded.length || tagsRemoved.length ? 1 : 0) + (imageChanged ? 1 : 0)} جزء.`)}
          {" "}<span className="text-muted-foreground">{L("Added words are underlined in green, removed words struck through in red.", "الكلمات المضافة مسطّرة بالأخضر، والمحذوفة مشطوبة بالأحمر.")}</span>
        </p>
        <dl className="space-y-3 text-sm">
          {FIELDS.map(([k, en, a, dir]) => (
            <div key={k} className={changed.includes(k) ? "" : "opacity-60"}>
              <dt className="font-medium">{L(en, a)} {!changed.includes(k) && <span className="text-xs text-muted-foreground">· {L("unchanged", "بلا تغيير")}</span>}</dt>
              <dd dir={dir} lang={dir === "rtl" ? "ar" : "en"} className="whitespace-pre-wrap">
                {changed.includes(k) ? wordDiff(prev[k], cur![k]).map((p, i) => p.k === "same" ? <span key={i}>{p.t}</span>
                  : p.k === "add" ? <ins key={i} className="bg-success/15 text-success underline decoration-success"><span className="sr-only">{L("added: ", "أُضيف: ")}</span>{p.t}</ins>
                  : <del key={i} className="bg-destructive/10 text-destructive"><span className="sr-only">{L("removed: ", "حُذف: ")}</span>{p.t}</del>) : (cur![k] || "—")}
              </dd>
              {changed.includes(k) && <FieldComments draftId={draftId} version={cur!.version} field={k} comments={cs} />}
            </div>))}
          <div><dt className="font-medium">{L("Tags", "الوسوم")}</dt><dd className="flex flex-wrap gap-1.5">
            {tagsAdded.map((t) => <ins key={"a" + t} className="rounded-full bg-success/15 px-2 text-success no-underline">+ {t}</ins>)}
            {tagsRemoved.map((t) => <del key={"r" + t} className="rounded-full bg-destructive/10 px-2 text-destructive">− {t}</del>)}
            {!tagsAdded.length && !tagsRemoved.length && <span className="text-muted-foreground">{L("unchanged", "بلا تغيير")}</span>}
          </dd>{(tagsAdded.length > 0 || tagsRemoved.length > 0) && <FieldComments draftId={draftId} version={cur!.version} field="tags" comments={cs} />}</div>
          <div><dt className="font-medium">{L("Image", "الصورة")}</dt><dd>{imageChanged ? L("A new image was uploaded.", "رُفعت صورة جديدة.") : L("unchanged", "بلا تغيير")}</dd>{imageChanged && <FieldComments draftId={draftId} version={cur!.version} field="image" comments={cs} />}</div>
        </dl>
        <ResubmissionCheck key={cur!.id} draftId={draftId} version={cur!.version} initialNotes={cur!.previous_review_note ?? ""} />
        <RecurringIssues key={`ri-${draftId}`} draftId={draftId} />
      </>)}
    </section>
  );
}
