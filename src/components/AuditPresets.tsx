import { useEffect, useState } from "react";

export type AuditPreset = { name: string; from: string; to: string; who: string; field: string };
const PRESET_KEY = "arwiqa:audit-presets";

/** Named Change history filter sets, saved in this browser. */
export function AuditPresets({ current, apply, L }: { current: Omit<AuditPreset, "name">; apply: (p: AuditPreset) => void; L: (e: string, a: string) => string }) {
  const [list, setList] = useState<AuditPreset[]>([]);
  const [name, setName] = useState("");
  useEffect(() => { try { setList(JSON.parse(localStorage.getItem(PRESET_KEY) ?? "[]")); } catch { setList([]); } }, []);
  const persist = (next: AuditPreset[]) => { setList(next); localStorage.setItem(PRESET_KEY, JSON.stringify(next)); };
  const hasFilters = !!(current.from || current.to || current.who || current.field);
  const save = () => { const n = name.trim().slice(0, 40); if (!n || !hasFilters) return; persist([...list.filter((p) => p.name !== n), { name: n, ...current }].slice(-12)); setName(""); };
  const same = (p: AuditPreset) => p.from === current.from && p.to === current.to && p.who === current.who && p.field === current.field;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">{L("Saved searches:", "عمليات بحث محفوظة:")}</span>
      {list.length === 0 && <span className="text-muted-foreground">{L("none yet", "لا يوجد بعد")}</span>}
      {list.map((p) => (
        <span key={p.name} className={`inline-flex items-center rounded-full border ${same(p) ? "border-primary bg-accent" : "border-border"}`}>
          <button type="button" onClick={() => apply(p)} aria-pressed={same(p)} className="px-3 py-1">{p.name}</button>
          <button type="button" onClick={() => persist(list.filter((x) => x.name !== p.name))} aria-label={L(`Delete ${p.name}`, `حذف ${p.name}`)} className="pe-2 text-muted-foreground hover:text-destructive">×</button>
        </span>
      ))}
      <form className="ms-auto flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label htmlFor="preset-name" className="sr-only">{L("Preset name", "اسم البحث")}</label>
        <input id="preset-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder={L("Name these filters", "سمِّ هذه الفلاتر")} className="rounded-full border border-input bg-background px-3 py-1" />
        <button disabled={!name.trim() || !hasFilters} title={hasFilters ? undefined : L("Set at least one filter first", "اختر فلترًا واحدًا على الأقل")} className="rounded-full bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50">{L("Save", "حفظ")}</button>
      </form>
    </div>
  );
}
