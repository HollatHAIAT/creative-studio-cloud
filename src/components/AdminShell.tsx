import type { ReactNode } from "react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { LayoutDashboard, Users, ListChecks, ShoppingBag, Gavel, Flag, Star, Mail, ShieldCheck, ScanLine, Settings, FileSearch, Languages, ExternalLink, FileText, Menu, X } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import logoMark from "@/assets/arwiqa-mark.png";

const items = [
  { to: "/admin/dashboard", en: "Overview", ar: "نظرة عامة", icon: LayoutDashboard },
  { to: "/admin/users", en: "Users & roles", ar: "المستخدمون والأدوار", icon: Users },
  { to: "/admin/content", en: "Site content", ar: "إدارة المحتوى", icon: FileText },
  { to: "/admin/listings", en: "Listings", ar: "الإعلانات", icon: ListChecks },
  { to: "/admin/policy-review", en: "Policy review", ar: "مراجعة السياسات", icon: FileSearch },
  { to: "/admin/review-policy", en: "Review rules", ar: "قواعد المراجعة", icon: ShieldCheck },
  { to: "/admin/orders", en: "Orders", ar: "الطلبات", icon: ShoppingBag },
  { to: "/admin/auctions", en: "Auctions", ar: "المزادات", icon: Gavel },
  { to: "/admin/reviews", en: "Reviews", ar: "التقييمات", icon: Star },
  { to: "/admin/reports", en: "Reports", ar: "البلاغات", icon: Flag },
  { to: "/admin/emails", en: "Emails", ar: "الرسائل البريدية", icon: Mail },
  { to: "/admin/scan", en: "Ticket scan", ar: "مسح التذاكر", icon: ScanLine },
  { to: "/admin/settings", en: "Platform settings", ar: "إعدادات المنصة", icon: Settings },
] as const;

/** Separate back-office frame for every /admin page — no public header or footer. */
export function AdminShell({ children }: { children: ReactNode }) {
  const { locale, toggle } = useLocale();
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [open, setOpen] = useState(false);
  const nav = (
    <nav aria-label={L("Admin", "الإدارة")} className="space-y-0.5 p-3">
      {items.map((i) => (
        <Link key={i.to} to={i.to} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          activeProps={{ className: "bg-primary/10 font-medium text-foreground" }}>
          <i.icon aria-hidden className="h-4 w-4" />{L(i.en, i.ar)}
        </Link>
      ))}
    </nav>
  );
  return (
    <div className="flex min-h-screen bg-muted/30 text-foreground">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e border-border bg-card lg:flex">
        <Brand L={L} />
        <div className="flex-1 overflow-y-auto">{nav}</div>
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label={L("Close menu", "إغلاق القائمة")} className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-72 overflow-y-auto bg-card">
            <div className="flex items-center justify-between pe-3"><Brand L={L} /><button onClick={() => setOpen(false)} aria-label={L("Close menu", "إغلاق القائمة")}><X className="h-5 w-5" /></button></div>
            {nav}
          </aside>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label={L("Open menu", "فتح القائمة")}><Menu className="h-5 w-5" /></button>
          <span className="text-sm font-medium">{L("Admin portal", "بوابة إدارة النظام")}</span>
          <div className="ms-auto flex items-center gap-3 text-sm">
            <button onClick={toggle} className="flex items-center gap-1 rounded-full border border-border px-3 py-1"><Languages aria-hidden className="h-4 w-4" />{locale === "ar" ? "English" : "العربية"}</button>
            <Link to="/" className="flex items-center gap-1 text-muted-foreground hover:text-foreground"><ExternalLink aria-hidden className="h-4 w-4" />{L("View site", "عرض الموقع")}</Link>
          </div>
        </header>
        <main id="main">{children}</main>
      </div>
    </div>
  );
}

function Brand({ L }: { L: (en: string, ar: string) => string }) {
  return (
    <Link to="/admin/dashboard" className="flex items-center gap-2 border-b border-border px-5 py-4">
      <img src={logoMark} alt="" className="h-8 w-8" />
      <span><span className="block font-display text-lg leading-none">أروقة</span><span className="text-xs text-muted-foreground">{L("Administration", "إدارة النظام")}</span></span>
    </Link>
  );
}
