import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, ShieldCheck, ShieldOff, Ban, RotateCcw } from "lucide-react";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { StaffGate } from "@/components/StaffGate";
import { useStaff } from "@/lib/auth";
import { useLocale } from "@/lib/i18n";
import { listAdminUsers, setUserRole, type AdminUser } from "@/lib/admin-users.functions";
import { suspendUser, reinstateUser } from "@/lib/moderation.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [
    { title: "Users & roles — Arwiqa admin" },
    { name: "description", content: "Manage accounts, staff roles and suspensions on Arwiqa." },
    { property: "og:title", content: "Users & roles — Arwiqa admin" },
    { property: "og:description", content: "Admin tools for accounts, roles and suspensions." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <StaffGate><Users /></StaffGate>,
});

function Users() {
  const { locale } = useLocale();
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const { isAdmin } = useStaff();
  const qc = useQueryClient();
  const list = useServerFn(listAdminUsers);
  const setRole = useServerFn(setUserRole);
  const suspend = useServerFn(suspendUser);
  const reinstate = useServerFn(reinstateUser);
  const [q, setQ] = useState(""); const [term, setTerm] = useState(""); const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"all" | "staff" | "blocked">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["admin-users", term, page], queryFn: () => list({ data: { q: term, page } }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users"] });
  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString(locale === "ar" ? "ar-SA-u-ca-gregory" : "en-GB") : "—";

  const run = async (id: string, fn: () => Promise<{ ok: boolean; error?: string; warning?: string }>, done: string) => {
    setBusy(id);
    try { const r = await fn(); if (!r.ok) toast.error(r.error ?? L("Failed", "تعذّر التنفيذ")); else { toast.success(r.warning ?? done); refresh(); } }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };
  const toggleRole = (u: AdminUser, role: "admin" | "moderator") => {
    const grant = !u.roles.includes(role);
    if (!confirm(grant ? L(`Give ${role} role to ${u.email}?`, `منح دور ${role === "admin" ? "مدير" : "مشرف"} إلى ${u.email}؟`) : L(`Remove ${role} role from ${u.email}?`, `إزالة دور ${role === "admin" ? "مدير" : "مشرف"} من ${u.email}؟`))) return;
    void run(u.id, () => setRole({ data: { userId: u.id, role, grant } }), L("Role updated", "تم تحديث الدور"));
  };
  const doSuspend = (u: AdminUser) => {
    const reason = prompt(L("Reason for suspension (required):", "سبب الإيقاف (مطلوب):"))?.trim();
    if (!reason || reason.length < 2) return;
    const d = prompt(L("Days (leave empty for indefinite):", "عدد الأيام (اتركه فارغًا لإيقاف دائم):"))?.trim();
    const days = d ? Math.max(1, Math.min(3650, parseInt(d, 10) || 0)) : null;
    void run(u.id, () => suspend({ data: { userId: u.id, days, reason } }), L("Account suspended", "تم إيقاف الحساب"));
  };
  const doReinstate = (u: AdminUser) => {
    if (!confirm(L(`Reinstate ${u.email}?`, `إعادة تفعيل ${u.email}؟`))) return;
    void run(u.id, () => reinstate({ data: { userId: u.id, reason: "Reinstated from admin portal" } }), L("Account reinstated", "تمت إعادة تفعيل الحساب"));
  };

  const rows = (query.data?.users ?? []).filter((u) => filter === "all" || (filter === "staff" ? u.roles.length > 0 : !!u.blocked));
  const roleBtn = (on: boolean) => `inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-foreground"}`;

  return (
    <SiteShell>
      <PageTitle eyebrow={L("Administration", "إدارة النظام")} title={L("Users & roles", "المستخدمون والأدوار")}
        sub={L("Search accounts, give or remove staff roles, and suspend or reinstate accounts.", "ابحث في الحسابات، وامنح أدوار الفريق أو أزلها، وأوقف الحسابات أو أعد تفعيلها.")} />
      <div className="mx-auto max-w-6xl px-6 pb-20">
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); setTerm(q); }} className="flex flex-wrap items-center gap-2">
          <label htmlFor="uq" className="sr-only">{L("Search by email", "ابحث بالبريد")}</label>
          <div className="relative flex-1"><Search aria-hidden className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input id="uq" value={q} onChange={(e) => setQ(e.target.value)} maxLength={120} placeholder={L("Search by email", "ابحث بالبريد الإلكتروني")} className="w-full rounded-md border border-border bg-card py-2 ps-9 pe-3" /></div>
          <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground">{L("Search", "بحث")}</button>
          <div role="group" className="flex gap-1">
            {(["all", "staff", "blocked"] as const).map((f) => <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={roleBtn(filter === f)}>
              {f === "all" ? L("All", "الكل") : f === "staff" ? L("Staff", "الفريق") : L("Suspended", "موقوفون")}</button>)}
          </div>
        </form>
        {!isAdmin && <p className="mt-4 rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">{L("Moderators can suspend accounts. Only admins can change roles.", "يمكن للمشرفين إيقاف الحسابات، أما تغيير الأدوار فللمديرين فقط.")}</p>}
        {query.isLoading ? <p className="mt-8 text-muted-foreground">{L("Loading…", "جارٍ التحميل…")}</p>
        : query.error ? <p className="mt-8 text-destructive">{(query.error as Error).message}</p>
        : rows.length === 0 ? <p className="mt-8 text-muted-foreground">{L("No accounts match.", "لا توجد حسابات مطابقة.")}</p>
        : (
          <div className="mt-6 overflow-x-auto rounded-md border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-start text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="p-3 text-start">{L("Account", "الحساب")}</th><th className="p-3 text-start">{L("Joined", "الانضمام")}</th><th className="p-3 text-start">{L("Last sign-in", "آخر دخول")}</th><th className="p-3 text-start">{L("Roles", "الأدوار")}</th><th className="p-3 text-start">{L("Status", "الحالة")}</th></tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0 align-top">
                    <td className="p-3"><p className="font-medium">{u.email || "—"}</p>{!u.confirmed && <p className="text-xs text-muted-foreground">{L("Email not confirmed", "البريد غير مؤكد")}</p>}{u.id === query.data?.me && <p className="text-xs text-primary">{L("You", "أنت")}</p>}</td>
                    <td className="p-3">{fmt(u.createdAt)}</td>
                    <td className="p-3">{fmt(u.lastSignIn)}</td>
                    <td className="p-3"><div className="flex flex-wrap gap-1">
                      {(["admin", "moderator"] as const).map((r) => isAdmin
                        ? <button key={r} disabled={busy === u.id} aria-pressed={u.roles.includes(r)} onClick={() => toggleRole(u, r)} className={roleBtn(u.roles.includes(r))}>{u.roles.includes(r) ? <ShieldCheck aria-hidden className="h-3 w-3" /> : <ShieldOff aria-hidden className="h-3 w-3" />}{r === "admin" ? L("Admin", "مدير") : L("Moderator", "مشرف")}</button>
                        : u.roles.includes(r) && <span key={r} className={roleBtn(true)}>{r === "admin" ? L("Admin", "مدير") : L("Moderator", "مشرف")}</span>)}
                    </div></td>
                    <td className="p-3">
                      {u.blocked ? (<div className="space-y-1">
                        <p className="text-destructive">{L("Suspended", "موقوف")} {u.blocked.until ? L(`until ${fmt(u.blocked.until)}`, `حتى ${fmt(u.blocked.until)}`) : L("indefinitely", "دائمًا")}</p>
                        <p className="text-xs text-muted-foreground">{u.blocked.reason}</p>
                        <button disabled={busy === u.id} onClick={() => doReinstate(u)} className="inline-flex items-center gap-1 text-xs underline"><RotateCcw aria-hidden className="h-3 w-3" />{L("Reinstate", "إعادة التفعيل")}</button>
                      </div>) : (<div className="space-y-1">
                        <p>{L("Active", "نشط")}</p>
                        {u.id !== query.data?.me && <button disabled={busy === u.id} onClick={() => doSuspend(u)} className="inline-flex items-center gap-1 text-xs text-destructive underline"><Ban aria-hidden className="h-3 w-3" />{L("Suspend", "إيقاف")}</button>}
                      </div>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!term && (page > 1 || query.data?.hasMore) && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <button disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded-md border border-border px-3 py-1.5 disabled:opacity-40">{L("Previous", "السابق")}</button>
            <span>{L(`Page ${page}`, `صفحة ${page}`)}</span>
            <button disabled={!query.data?.hasMore} onClick={() => setPage(page + 1)} className="rounded-md border border-border px-3 py-1.5 disabled:opacity-40">{L("Next", "التالي")}</button>
          </div>
        )}
      </div>
    </SiteShell>
  );
}
