import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, ShoppingBag, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useStaff } from "@/lib/auth";
import { useLocale } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function AccountNav() {
  const { user, ready } = useSession();
  const { isStaff } = useStaff();
  const { t, locale } = useLocale();
  const { cart } = useStore();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const unread = useQuery({
    queryKey: ["notifications", "unread", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null)).count ?? 0,
  });

  // Live notifications: toast + refresh counts.
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`notif-${user.id}-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (p) => {
        const n = p.new as { title: string; title_ar: string };
        toast(locale === "ar" ? n.title_ar : n.title);
        qc.invalidateQueries({ queryKey: ["notifications"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` }, () => qc.invalidateQueries({ queryKey: ["orders"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `user_id=eq.${user.id}` }, () => qc.invalidateQueries({ queryKey: ["orders"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets", filter: `user_id=eq.${user.id}` }, () => qc.invalidateQueries({ queryKey: ["orders"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc, locale]);

  const count = (cart ?? []).length;
  return (
    <div className="flex items-center gap-3">
      <Link to="/checkout" className="relative" aria-label={t("nav.cart")}>
        <ShoppingBag className="h-5 w-5" />
        {count > 0 && <span className="absolute -end-2 -top-2 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{count}</span>}
      </Link>
      {ready && user ? (
        <>
          <Link to="/notifications" className="relative" aria-label={t("nav.notifications")}>
            <Bell className="h-5 w-5" />
            {(unread.data ?? 0) > 0 && <span className="absolute -end-2 -top-2 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{unread.data}</span>}
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={t("nav.account")}><User className="h-5 w-5" /></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-xs text-muted-foreground" disabled>{user.email}</DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/dashboard">{t("nav.dashboard")}</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/analytics">{t("nav.analytics")}</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/listing-writer">{locale === "ar" ? "كاتب الإعلانات الذكي" : "AI listing writer"}</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/alt-checker">{locale === "ar" ? "فاحص النص البديل" : "Alt text checker"}</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/alt-writer">{locale === "ar" ? "كاتب النص البديل" : "Alt text writer"}</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/search-terms">{locale === "ar" ? "كلمات البحث والوسوم" : "Search terms & tags"}</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/crop-helper">{locale === "ar" ? "مساعد القص للهاتف" : "Mobile crop helper"}</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/revision-check">{locale === "ar" ? "فحص التعديلات المطلوبة" : "Revision check"}</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/owner-approvals">{locale === "ar" ? "موافقات المالك" : "Owner approvals"}</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/review-invites">{locale === "ar" ? "دعوات المراجعة" : "Review invitations"}</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/seller-dashboard">{locale === "ar" ? "لوحة البائع" : "Seller dashboard"}</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/teams">{locale === "ar" ? "الفرق والمعارض" : "Teams & galleries"}</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link to="/orders">{t("nav.orders")}</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/my-auctions">{locale === "ar" ? "مزاداتي" : "My auctions"}</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/my-reviews">{locale === "ar" ? "تقييماتي" : "My reviews"}</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/notifications">{t("nav.notifications")}</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/settings">{t("nav.settings")}</Link></DropdownMenuItem>
              {isStaff && (<>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/admin/dashboard">{locale === "ar" ? "لوحة الإدارة" : "Admin dashboard"}</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/admin/orders">{t("adm.orders")}</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/admin/reports">{t("adm.reports")}</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/admin/emails">{locale === "ar" ? "حالة البريد" : "Email delivery"}</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/admin/scan">{t("adm.scan")}</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/admin/reviews">{locale === "ar" ? "الإشراف على التقييمات" : "Review moderation"}</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/admin/auctions">{locale === "ar" ? "إدارة المزادات" : "Auction administration"}</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/admin/listings">{locale === "ar" ? "مراجعة الإعلانات" : "Listing review"}</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/admin/settings">{locale === "ar" ? "إعدادات المنصة" : "Platform settings"}</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/admin/users">{locale === "ar" ? "المستخدمون والأدوار" : "Users & roles"}</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/admin/review-policy">{locale === "ar" ? "سياسة المراجعة" : "Review policy"}</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/admin/policy-review">{locale === "ar" ? "مراجعة سياسات الإعلانات" : "Listing policy review"}</Link></DropdownMenuItem>
              </>)}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={async () => { await supabase.auth.signOut(); qc.clear(); navigate({ to: "/" }); }}>{t("auth.signout")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : (
        <Link to="/auth" search={{ next: undefined }} className="text-sm underline">{t("auth.title")}</Link>
      )}
    </div>
  );
}
