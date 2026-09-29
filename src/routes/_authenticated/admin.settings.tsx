import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";
import { useStaff } from "@/lib/auth";
import { DEFAULT_SETTINGS, applySettings, usePlatformSettings, type PlatformSettings } from "@/lib/platform-settings";

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
    applySettings(row); qc.setQueryData(["platform-settings"], row);
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
    </SiteShell>
  );
}
