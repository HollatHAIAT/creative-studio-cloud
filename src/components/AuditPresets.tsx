import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Pencil, Copy, ChevronUp, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type AuditPreset = { name: string; from: string; to: string; who: string; field: string };
type Row = { id: string; owner_id: string; owner_email: string | null; name: string; from_date: string; to_date: string; actor: string; field: string; shared: boolean; position: number };
const LEGACY_KEY = "arwiqa:audit-presets";
const KEY = ["audit-presets"];

/** Named Change history filter sets stored per admin; an owner can share one with all admins. */
export function AuditPresets({ current, apply, L }: { current: Omit<AuditPreset, "name">; apply: (p: AuditPreset) => void; L: (e: string, a: string) => string }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [shareNew, setShareNew] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const me = useQuery({ queryKey: ["me-id"], queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null });
  const q = useQuery({ queryKey: KEY, queryFn: async () => {
    const { data, error } = await (supabase as any).from("audit_filter_presets").select("id, owner_id, owner_email, name, from_date, to_date, actor, field, shared, position").order("position").order("created_at");
    if (error) throw error; return (data ?? []) as Row[];
  } });
  // One-time move of presets saved in this browser before sharing existed.
  useEffect(() => {
    if (!me.data || !q.data) return;
    let old: AuditPreset[] = [];
    try { old = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? "[]"); } catch { /* ignore */ }
    if (!old.length) return;
    const mine = new Set(q.data.filter((r) => r.owner_id === me.data).map((r) => r.name));
    const rows = old.filter((p) => p.name && !mine.has(p.name)).map((p) => ({ name: p.name.slice(0, 40), from_date: p.from, to_date: p.to, actor: p.who, field: p.field }));
    void (async () => {
      if (rows.length) { const { error } = await (supabase as any).from("audit_filter_presets").insert(rows); if (error) return; }
      localStorage.removeItem(LEGACY_KEY); void qc.invalidateQueries({ queryKey: KEY });
    })();
  }, [me.data, q.data, qc]);

  const list = q.data ?? [];
  const mine = list.filter((r) => r.owner_id === me.data);
  const others = list.filter((r) => r.owner_id !== me.data);
  const hasFilters = !!(current.from || current.to || current.who || current.field);
  const same = (r: Row) => r.from_date === current.from && r.to_date === current.to && r.actor === current.who && r.field === current.field;
  const done = (error: { message: string } | null) => { if (error) setErr(L("Couldn't save. Please try again.", "تعذّر الحفظ. حاول مجددًا.")); else { setErr(null); void qc.invalidateQueries({ queryKey: KEY }); } };
  async function save() {
    const n = name.trim().slice(0, 40); if (!n || !hasFilters) return;
    if (mine.length >= 12 && !mine.some((r) => r.name === n)) { setErr(L("You can keep up to 12 saved searches. Delete one first.", "يمكنك حفظ ١٢ بحثًا كحد أقصى. احذف واحدًا أولًا.")); return; }
    const { error } = await (supabase as any).from("audit_filter_presets").upsert({ owner_id: me.data, name: n, position: mine.find((r) => r.name === n)?.position ?? mine.length, from_date: current.from, to_date: current.to, actor: current.who, field: current.field, shared: shareNew }, { onConflict: "owner_id,name" });
    done(error); if (!error) setName("");
  }
  const toggleShare = async (r: Row) => done((await (supabase as any).from("audit_filter_presets").update({ shared: !r.shared }).eq("id", r.id)).error);
  const remove = async (r: Row) => done((await (supabase as any).from("audit_filter_presets").delete().eq("id", r.id)).error);
  async function rename(r: Row) {
    const n = draft.trim().slice(0, 40); setEditing(null);
    if (!n || n === r.name) return;
    if (mine.some((x) => x.name === n)) { setErr(L("You already have a saved search with that name.", "لديك بحث محفوظ بهذا الاسم.")); return; }
    done((await (supabase as any).from("audit_filter_presets").update({ name: n }).eq("id", r.id)).error);
  }
  async function move(i: number, dir: -1 | 1) {
    const j = i + dir; if (j < 0 || j >= mine.length) return;
    const next = [...mine]; [next[i], next[j]] = [next[j]!, next[i]!];
    qc.setQueryData<Row[]>(KEY, [...next.map((r, k) => ({ ...r, position: k })), ...others]);
    const results = await Promise.all(next.map((r, k) => (supabase as any).from("audit_filter_presets").update({ position: k }).eq("id", r.id)));
    done(results.find((x: any) => x.error)?.error ?? null);
  }
  async function duplicate(r: Row) {
    if (mine.length >= 12) { setErr(L("You can keep up to 12 saved searches. Delete one first.", "يمكنك حفظ ١٢ بحثًا كحد أقصى. احذف واحدًا أولًا.")); return; }
    const base = `${r.name.slice(0, 30)} ${L("(copy)", "(نسخة)")}`; let n = base;
    for (let k = 2; mine.some((x) => x.name === n); k++) n = `${base} ${k}`;
    const { data, error } = await (supabase as any).from("audit_filter_presets").insert({ owner_id: me.data, name: n, position: mine.length, from_date: r.from_date, to_date: r.to_date, actor: r.actor, field: r.field, shared: false }).select("id").single();
    done(error); if (error) return;
    use(r); await qc.invalidateQueries({ queryKey: KEY }); setEditing(data.id); setDraft(n);
  }
  const dupBtn = (r: Row) => <button type="button" onClick={() => void duplicate(r)} disabled={!me.data} aria-label={L(`Duplicate ${r.name}`, `انسخ ${r.name}`)} title={L("Duplicate as a new search", "انسخ كبحث جديد")} className="px-1 text-muted-foreground hover:text-primary"><Copy aria-hidden className="h-3 w-3" /></button>;
  const use = (r: Row) => apply({ name: r.name, from: r.from_date, to: r.to_date, who: r.actor, field: r.field });
  const pill = (r: Row) => `inline-flex items-center rounded-full border ${same(r) ? "border-primary bg-accent" : "border-border"}`;

  return (
    <div className="mt-3 space-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">{L("My saved searches:", "عمليات بحثي المحفوظة:")}</span>
        {mine.length === 0 && <span className="text-muted-foreground">{L("none yet", "لا يوجد بعد")}</span>}
        {mine.map((r, i) => (
          <span key={r.id} className={pill(r)}>
            {mine.length > 1 && <span className="inline-flex flex-col ps-1">
              <button type="button" disabled={i === 0} onClick={() => void move(i, -1)} aria-label={L(`Move ${r.name} earlier`, `انقل ${r.name} للأمام`)} className="text-muted-foreground hover:text-primary disabled:opacity-30"><ChevronUp aria-hidden className="h-3 w-3" /></button>
              <button type="button" disabled={i === mine.length - 1} onClick={() => void move(i, 1)} aria-label={L(`Move ${r.name} later`, `انقل ${r.name} للخلف`)} className="text-muted-foreground hover:text-primary disabled:opacity-30"><ChevronDown aria-hidden className="h-3 w-3" /></button>
            </span>}
            {editing === r.id
              ? <form onSubmit={(e) => { e.preventDefault(); void rename(r); }}><label htmlFor={`rn-${r.id}`} className="sr-only">{L("New name", "الاسم الجديد")}</label><input id={`rn-${r.id}`} autoFocus value={draft} maxLength={40} onChange={(e) => setDraft(e.target.value)} onBlur={() => void rename(r)} onKeyDown={(e) => { if (e.key === "Escape") setEditing(null); }} className="w-32 rounded-full bg-background px-2 py-0.5" /></form>
              : <button type="button" onClick={() => use(r)} aria-pressed={same(r)} className="px-3 py-1">{r.name}</button>}
            <button type="button" onClick={() => { setEditing(r.id); setDraft(r.name); }} aria-label={L(`Rename ${r.name}`, `أعد تسمية ${r.name}`)} title={L("Rename", "إعادة تسمية")} className="px-1 text-muted-foreground hover:text-primary"><Pencil aria-hidden className="h-3 w-3" /></button>
            {dupBtn(r)}
            <button type="button" onClick={() => void toggleShare(r)} aria-pressed={r.shared} aria-label={r.shared ? L(`Stop sharing ${r.name}`, `إيقاف مشاركة ${r.name}`) : L(`Share ${r.name} with admins`, `شارك ${r.name} مع المشرفين`)} title={r.shared ? L("Shared with admins — click to stop", "مُشارك مع المشرفين — انقر للإيقاف") : L("Share with admins", "شارك مع المشرفين")} className={`px-1 ${r.shared ? "text-primary" : "text-muted-foreground"} hover:text-primary`}><Users aria-hidden className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => { if (window.confirm(L(`Delete "${r.name}"?`, `حذف «${r.name}»؟`))) void remove(r); }} aria-label={L(`Delete ${r.name}`, `حذف ${r.name}`)} className="pe-2 text-muted-foreground hover:text-destructive">×</button>
          </span>
        ))}
        <form className="ms-auto flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <label htmlFor="preset-name" className="sr-only">{L("Preset name", "اسم البحث")}</label>
          <input id="preset-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder={L("Name these filters", "سمِّ هذه الفلاتر")} className="rounded-full border border-input bg-background px-3 py-1" />
          <label className="inline-flex items-center gap-1"><input type="checkbox" checked={shareNew} onChange={(e) => setShareNew(e.target.checked)} />{L("Share with admins", "شارك مع المشرفين")}</label>
          <button disabled={!name.trim() || !hasFilters || !me.data} title={hasFilters ? undefined : L("Set at least one filter first", "اختر فلترًا واحدًا على الأقل")} className="rounded-full bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50">{L("Save", "حفظ")}</button>
        </form>
      </div>
      {others.length > 0 && <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">{L("Shared by other admins:", "مُشارَكة من مشرفين آخرين:")}</span>
        {others.map((r) => <span key={r.id} className={pill(r)}><button type="button" onClick={() => use(r)} aria-pressed={same(r)} title={r.owner_email ?? undefined} className="px-3 py-1">{r.name} <span className="text-muted-foreground">· {r.owner_email?.split("@")[0] ?? L("admin", "مشرف")}</span></button><span className="pe-2">{dupBtn(r)}</span></span>)}
      </div>}
      {err && <p role="alert" className="text-destructive">{err}</p>}
    </div>
  );
}
