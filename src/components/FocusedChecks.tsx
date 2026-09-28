import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";

type Result = "passed" | "unresolved" | "follow_up";
type Row = { id: string; check_text: string; field: string; result: Result; note: string; author: string; created_at: string };
export type FocusedCheck = { field: string; priority?: string; check: string; checkAr?: string };

const R: Record<Result, [string, string, string]> = {
  passed: ["Passed", "اجتاز", "bg-success/15 text-success border-success/40"],
  unresolved: ["Unresolved", "لم يُحل", "bg-destructive/10 text-destructive border-destructive/40"],
  follow_up: ["Needs follow-up", "يحتاج متابعة", "bg-warning/15 text-warning border-warning/40"],
};
const sb = supabase as any;
const key = (id: string) => ["check-results", id];

export function useCheckResults(draftId: string) {
  return useQuery({ queryKey: key(draftId), queryFn: async () => {
    const { data, error } = await sb.from("listing_check_results").select("*").eq("draft_id", draftId).order("created_at", { ascending: false });
    if (error) throw error; return (data ?? []) as Row[];
  } });
}

/** Mark AI focused checks as passed / unresolved / needs follow-up; each mark is saved and logged in moderation history. */
export function FocusedChecks({ draftId, checks }: { draftId: string; checks: FocusedCheck[] }) {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const qc = useQueryClient();
  const q = useCheckResults(draftId); const rows = q.data ?? [];
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const latest = (text: string) => rows.find((r) => r.check_text === text);

  async function mark(i: number, c: FocusedCheck, result: Result) {
    if (saving !== null) return; setSaving(i);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await sb.from("listing_check_results").insert({ draft_id: draftId, check_text: c.check, field: c.field || "general", result, note: (notes[i] ?? "").trim(), author: u.user?.id });
    setSaving(null);
    if (error) { toast.error(L("Couldn't save the result.", "تعذّر حفظ النتيجة.")); return; }
    toast.success(L("Result saved to moderation history", "حُفظت النتيجة في سجل الإشراف"));
    setNotes((n) => ({ ...n, [i]: "" }));
    void qc.invalidateQueries({ queryKey: key(draftId) });
  }

  return (
    <ol className="mt-1 space-y-3">
      {checks.map((c, i) => {
        const last = latest(c.check);
        return (
          <li key={i} className="rounded-xl border border-border p-3">
            <p><span className="text-xs uppercase text-muted-foreground">{c.field}{c.priority ? ` · ${c.priority}` : ""}</span> — {ar ? c.checkAr || c.check : c.check}</p>
            {last && <p className="mt-1 text-xs"><span className={`rounded-full border px-2 py-0.5 ${R[last.result][2]}`}>{L(R[last.result][0], R[last.result][1])}</span> <span className="text-muted-foreground">{new Date(last.created_at).toLocaleString()}{last.note ? ` · ${last.note}` : ""}</span></p>}
            <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label={L("Mark this check", "حدّد نتيجة الفحص")}>
              {(Object.keys(R) as Result[]).map((r) => (
                <button key={r} type="button" disabled={saving !== null} aria-pressed={last?.result === r} onClick={() => mark(i, c, r)}
                  className={`rounded-full border px-3 py-1 text-xs disabled:opacity-50 ${last?.result === r ? R[r][2] : "border-border"}`}>{L(R[r][0], R[r][1])}</button>
              ))}
              <input value={notes[i] ?? ""} onChange={(e) => setNotes({ ...notes, [i]: e.target.value })} maxLength={1000}
                aria-label={L("Note (optional)", "ملاحظة (اختياري)")} placeholder={L("Note (optional)", "ملاحظة (اختياري)")} className="min-w-0 flex-1 rounded-full border border-border bg-background px-3 py-1 text-xs" />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Saved focused-check results for a listing, newest first (staff only). */
export function CheckResultsHistory({ draftId }: { draftId: string }) {
  const { locale } = useLocale(); const L = (e: string, a: string) => (locale === "ar" ? a : e);
  const q = useCheckResults(draftId); const rows = q.data ?? [];
  const [f, setF] = useState<Result | "all">("all");
  if (!rows.length) return null;
  const shown = rows.filter((r) => f === "all" || r.result === f);
  return (
    <div className="space-y-2 rounded-xl bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{L("Focused check results", "نتائج الفحوص المركّزة")} ({rows.length})</p>
        <div className="flex flex-wrap gap-1 text-xs">
          {(["all", "passed", "unresolved", "follow_up"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={f === k} onClick={() => setF(k)} className={`rounded-full border px-2 py-0.5 ${f === k ? "border-primary bg-primary/10" : "border-border"}`}>
              {k === "all" ? L("All", "الكل") : L(R[k][0], R[k][1])} ({k === "all" ? rows.length : rows.filter((r) => r.result === k).length})</button>
          ))}
        </div>
      </div>
      <ul className="space-y-1 text-sm">{shown.map((r) => (
        <li key={r.id} className="flex flex-wrap gap-2"><span className={`rounded-full border px-2 py-0.5 text-xs ${R[r.result][2]}`}>{L(R[r.result][0], R[r.result][1])}</span>
          <span>{r.check_text}</span>{r.note && <span className="text-muted-foreground">— {r.note}</span>}<span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span></li>))}</ul>
    </div>
  );
}
