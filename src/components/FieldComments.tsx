import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";

export type Comment = { id: string; version: number; field: string; body: string; created_at: string };

export function useVersionComments(draftId: string) {
  return useQuery({
    queryKey: ["admin", "version-comments", draftId],
    queryFn: async () => {
      const { data, error } = await supabase.from("listing_version_comments" as never).select("id,version,field,body,created_at").eq("draft_id", draftId).order("created_at");
      if (error) throw error; return (data ?? []) as unknown as Comment[];
    },
  });
}

/** Private staff comments on one field of one version. Comments are permanent. */
export function FieldComments({ draftId, version, field, comments }: { draftId: string; version: number; field: string; comments: Comment[] }) {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const mine = comments.filter((c) => c.version === version && c.field === field);
  const earlier = comments.filter((c) => c.version < version && c.field === field);

  async function save() {
    if (busy || !body.trim()) return; setBusy(true); setErr(null);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("listing_version_comments" as never).insert({ draft_id: draftId, version, field, body: body.trim(), author: u.user?.id } as never);
    setBusy(false);
    if (error) { setErr(L("Couldn't save the comment.", "تعذّر حفظ التعليق.")); return; }
    setBody(""); setOpen(false); qc.invalidateQueries({ queryKey: ["admin", "version-comments", draftId] });
  }
  const fmt = (t: string) => new Date(t).toLocaleString(ar ? "ar-SA" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="mt-1 space-y-1 text-xs">
      {[...earlier, ...mine].map((c) => (
        <p key={c.id} className="rounded-lg border-s-2 border-warning bg-warning/10 px-2 py-1">
          <span className="text-muted-foreground">v{c.version} · {fmt(c.created_at)} · </span>{c.body}
        </p>))}
      {open ? (
        <div className="space-y-1">
          <label className="sr-only" htmlFor={`fc-${field}`}>{L("Private comment", "تعليق خاص")}</label>
          <textarea id={`fc-${field}`} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={2} className="w-full rounded-xl border border-border bg-background p-2" placeholder={L("Only staff can see this", "يراه فريق المراجعة فقط")} />
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={busy || !body.trim()} className="rounded-full bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50">{busy ? "…" : L("Save comment", "احفظ التعليق")}</button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-border px-3 py-1">{L("Cancel", "إلغاء")}</button>
          </div>
          {err && <p role="alert" className="text-destructive">{err}</p>}
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="text-primary underline">{L("+ Private comment", "+ تعليق خاص")}</button>
      )}
    </div>
  );
}
