import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";
import { useStaff } from "@/lib/auth";
import { DEFAULT_SETTINGS, applySettings, usePlatformSettings, type PlatformSettings } from "@/lib/platform-settings";
import { SettingsAuditAsk } from "@/components/SettingsAuditAsk";
import { ComplianceReview } from "@/components/ComplianceReview";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "Platform settings — Arwiqa staff" },
      { name: "description", content: "Set the return window, print shipping time and license terms." },
      { property: "og:title", content: "Platform settings — Arwiqa staff" },
      { property: "og:description", content: "Return, shipping and licensing numbers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminSettings,
});

type Key = keyof PlatformSettings;

function AdminSettings() {
  const { locale } = useLocale();
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const staff = useStaff();
  const current = usePlatformSettings();
  const qc = useQueryClient();
  const [f, setF] = useState<Record<Key, string>>(() => Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([k, v]) => [k, String(v)])) as Record<Key, string>);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setF(Object.fromEntries(Object.entries(current).map(([k, v]) => [k, String(v)])) as Record<Key, string>); }, [JSON.stringify(current)]);

  if (staff.loading) return <SiteShell><p className="p-16 text-center">…</p></SiteShell>;
  if (!staff.isAdmin) return <SiteShell><p className="p-16 text-center">{L("Only admins can change platform settings.", "إعدادات المنصة متاحة لمدير النظام فقط.")}</p></SiteShell>;

  const fields: { k: Key; label: string; hint: string; step?: string }[] = [
    { k: "return_days", label: L("Return window (days)", "مهلة الإرجاع (أيام)"), hint: L("Buyers can request a refund within this many days. Enforced on every request.", "يمكن للمشتري طلب الاسترداد خلال هذه المدة، وتُطبَّق على كل طلب.") },
    { k: "print_ship_min_days", label: L("Print shipping — from (days)", "شحن المطبوعات — من (أيام)"), hint: "" },
    { k: "print_ship_max_days", label: L("Print shipping — to (days)", "شحن المطبوعات — إلى (أيام)"), hint: L("Shown to buyers of prints.", "تظهر لمشتري المطبوعات.") },
    { k: "commercial_print_limit", label: L("Commercial license print limit (copies)", "حد الطباعة للترخيص التجاري (نسخ)"), hint: "" },
    { k: "commercial_multiplier", label: L("Commercial price × personal", "سعر التجاري × الشخصي"), hint: L("Applies to prices at checkout.", "يُطبَّق على الأسعار عند الدفع."), step: "0.1" },
    { k: "extended_multiplier", label: L("Extended price × personal", "سعر الموسّع × الشخصي"), hint: "", step: "0.1" },
  ];

  async function save(values: Record<Key, string>) {
    const row = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)])) as PlatformSettings;
    if (Object.values(row).some((v) => !Number.isFinite(v) || v < 0)) { toast.error(L("Enter valid numbers.", "أدخل أرقامًا صحيحة.")); return; }
    if (row.print_ship_min_days > row.print_ship_max_days) { toast.error(L("Shipping 'from' must not exceed 'to'.", "يجب ألا تتجاوز بداية مدة الشحن نهايتها.")); return; }
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("platform_settings").update({ ...row, updated_by: u.user?.id, updated_at: new Date().toISOString() }).eq("id", 1);
    setBusy(false);
    if (error) { toast.error(L("Couldn't save — check the values are in range.", "تعذّر الحفظ — تأكد أن القيم ضمن النطاق.")); return; }
    applySettings(row); qc.setQueryData(["platform-settings"], row); void qc.invalidateQueries({ queryKey: ["settings-audit"] });
    toast.success(L("Settings saved", "حُفظت الإعدادات"));
  }

  return (
    <SiteShell>
      <PageTitle eyebrow={L("Staff", "الفريق")} title={L("Platform settings", "إعدادات المنصة")} sub={L("These numbers appear across the site and apply to refunds and license prices.", "تظهر هذه الأرقام في الموقع وتُطبَّق على الاسترداد وأسعار التراخيص.")} />
      <form className="mx-auto grid max-w-2xl gap-5 px-6" onSubmit={(e) => { e.preventDefault(); void save(f); }}>
        {fields.map(({ k, label, hint, step }) => (
          <label key={k} className="grid gap-1 text-sm">
            <span className="font-medium">{label}</span>
            <input type="number" min={1} step={step ?? "1"} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="rounded-sm border border-border bg-background px-3 py-2" />
            <span className="text-xs text-muted-foreground">{hint} {L("Default:", "الافتراضي:")} {DEFAULT_SETTINGS[k]}</span>
          </label>
        ))}
        <div className="flex flex-wrap gap-3">
          <button disabled={busy} className="rounded-full bg-primary px-5 py-2 text-primary-foreground disabled:opacity-50">{L("Save", "حفظ")}</button>
          <button type="button" disabled={busy} onClick={() => { const d = Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([k, v]) => [k, String(v)])) as Record<Key, string>; setF(d); void save(d); }} className="rounded-full border border-border px-5 py-2">{L("Restore defaults", "استعادة الافتراضي")}</button>
        </div>
      </form>
      <SettingsAuditAsk />
      <SettingsAudit L={L} ar={locale === "ar"} labels={Object.fromEntries(fields.map((x) => [x.k, x.label]))} />
    </SiteShell>
  );
}

type AuditRow = { id: string; actor_email: string | null; field: string; old_value: string | null; new_value: string | null; created_at: string };
function SettingsAudit({ L, ar, labels }: { L: (e: string, a: string) => string; ar: boolean; labels: Record<string, string> }) {
  const q = useQuery({ queryKey: ["settings-audit"], queryFn: async () => {
    const { data, error } = await (supabase as any).rpc("admin_settings_audit", { _limit: 1000 });
    if (error) throw error; return (data ?? []) as AuditRow[];
  } });
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [who, setWho] = useState(""); const [field, setField] = useState("");
  const admins = Array.from(new Set((q.data ?? []).map((r) => r.actor_email ?? ""))).sort();
  const rows = (q.data ?? []).filter((r) => {
    const d = r.created_at.slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    if (who && (r.actor_email ?? "") !== (who === "__system" ? "" : who)) return false;
    if (field && r.field !== field) return false;
    return true;
  });
  const active = !!(from || to || who || field);
  const ctl = "rounded-sm border border-border bg-background px-3 py-2 text-sm";
  return (
    <section aria-labelledby="audit-h" className="mx-auto mt-12 max-w-4xl px-6">
      <h2 id="audit-h" className="font-display text-2xl">{L("Change history", "سجل التغييرات")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{L("Every settings change, who made it and when. Entries can't be edited or deleted.", "كل تغيير في الإعدادات ومن أجراه ومتى. لا يمكن تعديل السجل أو حذفه.")}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-xs"><span>{L("From date", "من تاريخ")}</span><input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={ctl} /></label>
        <label className="grid gap-1 text-xs"><span>{L("To date", "إلى تاريخ")}</span><input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={ctl} /></label>
        <label className="grid gap-1 text-xs"><span>{L("Administrator", "المدير")}</span><select value={who} onChange={(e) => setWho(e.target.value)} className={ctl}><option value="">{L("All", "الكل")}</option>{admins.map((a) => <option key={a || "s"} value={a || "__system"}>{a || L("System", "النظام")}</option>)}</select></label>
        <label className="grid gap-1 text-xs"><span>{L("Setting", "الإعداد")}</span><select value={field} onChange={(e) => setField(e.target.value)} className={ctl}><option value="">{L("All", "الكل")}</option>{Object.entries(labels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      </div>
      {q.data && q.data.length > 0 && <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground" aria-live="polite">
        <span>{L(`Showing ${rows.length} of ${q.data.length}`, `عرض ${rows.length} من ${q.data.length}`)}</span>
        {active && <button type="button" onClick={() => { setFrom(""); setTo(""); setWho(""); setField(""); }} className="underline hover:text-foreground">{L("Clear filters", "مسح الفلاتر")}</button>}
        <button type="button" disabled={rows.length === 0} onClick={() => {
          const esc = (v: unknown) => { const s = String(v ?? ""); return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : "") + s.replace(/"/g, '""')}"` : s; };
          const head = ["Timestamp (UTC)", "Administrator", "Setting key", "Setting", "Old value", "New value", "Entry ID"];
          const lines = rows.map((r) => [r.created_at, r.actor_email ?? "System", r.field, labels[r.field] ?? r.field, r.old_value, r.new_value, r.id].map(esc).join(","));
          const blob = new Blob(["\uFEFF" + [head.join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
          const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
          a.download = `arwiqa-settings-audit-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
        }} className="ms-auto rounded-full border border-border px-4 py-1.5 text-sm text-foreground hover:border-primary disabled:opacity-50">{L(`Export CSV (${rows.length})`, `تصدير CSV (${rows.length})`)}</button>
      </div>}
      {q.data && q.data.length > 0 && <ComplianceReview rows={rows} L={L} ar={ar} labels={labels} scope={[from && `from ${from}`, to && `to ${to}`, who && `admin ${who === "__system" ? "system" : who}`, field && `setting ${field}`].filter(Boolean).join(", ") || "all entries"} />}
      {q.isError ? <p className="mt-4 text-sm text-destructive">{L("Couldn't load the history.", "تعذّر تحميل السجل.")}</p>
        : !q.data ? <p className="mt-4 text-sm">…</p>
        : q.data.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{L("No changes yet.", "لا تغييرات بعد.")}</p>
        : rows.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{L("No changes match these filters.", "لا تغييرات تطابق هذه الفلاتر.")}</p> : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted"><tr>{["#", L("When", "متى"), L("Administrator", "المدير"), L("Setting", "الإعداد"), L("From", "من"), L("To", "إلى")].map((h) => <th key={h} className="p-3 text-start">{h}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={r.id} id={`audit-${r.id}`} className="border-t border-border transition-colors">
                <td className="p-3 text-muted-foreground">{i + 1}</td>
                <td className="p-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString(ar ? "ar-SA" : "en-GB", { dateStyle: "medium", timeStyle: "short" })}</td>
                <td className="p-3">{r.actor_email ?? L("System", "النظام")}</td>
                <td className="p-3">{labels[r.field] ?? r.field}</td>
                <td className="p-3 text-muted-foreground">{r.old_value ?? "—"}</td>
                <td className="p-3 font-medium">{r.new_value ?? "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
