import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ClipboardCheck, Flag, Package, Scale, Star } from "lucide-react";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { StaffGate } from "@/components/StaffGate";
import { StockEditor } from "@/components/StockEditor";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";

const sb = supabase as any;

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  head: () => ({ meta: [
    { title: "Admin dashboard — Arwiqa أروقة" },
    { name: "description", content: "Staff overview of listings, stock levels, pending approvals and review activity." },
    { property: "og:title", content: "Admin dashboard — Arwiqa" },
    { property: "og:description", content: "Listings, stock, approvals and review moderation at a glance." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    const { data: ok } = u.user ? await sb.rpc("is_staff", { _uid: u.user.id }) : { data: false };
    if (!ok) {
      const { toast } = await import("sonner");
      toast.error(document.documentElement.lang === "ar" ? "لوحة الإدارة للمشرفين والمديرين فقط." : "The admin dashboard is only for moderators and admins.");
      throw redirect({ to: "/", replace: true });
    }
  },
  component: () => <StaffGate><AdminDashboard /></StaffGate>,
});

const ACT: Record<string, [string, string]> = {
  listing_approve: ["Approved listing", "وافق على إعلان"], listing_reject: ["Rejected listing", "رفض إعلانًا"], listing_publish: ["Published listing", "نشر إعلانًا"],
  listing_unpublish: ["Unpublished listing", "ألغى نشر إعلان"], review_remove: ["Removed review", "أزال تقييمًا"], review_restore: ["Restored review", "استعاد تقييمًا"],
  block_user: ["Suspended user", "علّق مستخدمًا"], lift_block: ["Reinstated user", "أعاد مستخدمًا"], stock_update: ["Changed stock", "غيّر المخزون"],
  email_retry: ["Retried email", "أعاد إرسال بريد"], reminder_email_retry: ["Retried reminder", "أعاد إرسال تذكير"],
};

function AdminDashboard() {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const q = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const [drafts, listings, reports, appeals, reviews, audit] = await Promise.all([
        sb.from("listing_drafts").select("id,title,title_ar,status,submitted_at,review_mode").in("status", ["submitted", "approved", "rejected", "published"]).order("submitted_at", { ascending: true, nullsFirst: false }).limit(300),
        sb.from("listings").select("id,title,title_ar,status,price,stock,low_stock_at,category").order("created_at", { ascending: false }),
        sb.from("review_reports").select("id", { count: "exact", head: true }).is("resolved_at", null),
        sb.from("review_appeals").select("id", { count: "exact", head: true }).eq("status", "pending"),
        sb.from("reviews").select("id,listing_id,rating,body,author_name,status,created_at").order("created_at", { ascending: false }).limit(8),
        sb.from("moderation_audit").select("id,action,target_type,target_id,reason,created_at").order("created_at", { ascending: false }).limit(12),
      ]);
      return { drafts: drafts.data ?? [], listings: listings.data ?? [], reports: reports.count ?? 0, appeals: appeals.count ?? 0, reviews: reviews.data ?? [], audit: audit.data ?? [] };
    },
  });
  const d = q.data;
  const title = (x: any) => (ar ? x.title_ar || x.title : x.title || x.title_ar) || L("Untitled", "بدون عنوان");
  const pending = d?.drafts.filter((x: any) => x.status === "submitted") ?? [];
  const awaitingPub = d?.drafts.filter((x: any) => x.status === "approved").length ?? 0;
  const live = d?.listings.filter((l: any) => l.status === "published") ?? [];
  const low = d?.listings.filter((l: any) => l.stock != null && l.stock <= l.low_stock_at) ?? [];
  const names = new Map<string, string>((d?.listings ?? []).map((l: any) => [l.id, title(l)]));
  const age = (s: string | null) => s ? Math.max(0, Math.floor((Date.now() - Date.parse(s)) / 86400000)) : null;
  const card = "rounded-2xl border border-border p-4";

  return (
    <SiteShell>
      <PageTitle eyebrow={L("Staff", "الفريق")} title={L("Admin dashboard", "لوحة الإدارة")} sub={L("What needs attention across listings, stock and reviews.", "ما يحتاج انتباهك في الإعلانات والمخزون والتقييمات.")} />
      <div className="mx-auto max-w-7xl space-y-8 px-6 pb-16">
        {q.isLoading ? <p className="text-muted-foreground">{L("Loading…", "جارٍ التحميل…")}</p> : q.error ? <p role="alert" className="text-destructive">{L("Couldn't load the dashboard.", "تعذّر تحميل اللوحة.")}</p> : d && (<>
          <section aria-label={L("Summary", "الملخص")} className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {([
              [L("Awaiting review", "بانتظار المراجعة"), pending.length, <ClipboardCheck key="a" className="h-4 w-4" />, "/admin/listings"],
              [L("Awaiting publication", "بانتظار النشر"), awaitingPub, <ClipboardCheck key="b" className="h-4 w-4" />, "/admin/listings"],
              [L("Live listings", "منشورة"), live.length, <Package key="c" className="h-4 w-4" />, null],
              [L("Low or out of stock", "مخزون منخفض/نافد"), low.length, <AlertTriangle key="d" className="h-4 w-4" />, null],
              [L("Open review reports", "بلاغات مفتوحة"), d.reports, <Flag key="e" className="h-4 w-4" />, "/admin/reviews"],
              [L("Pending appeals", "طعون معلّقة"), d.appeals, <Scale key="f" className="h-4 w-4" />, "/admin/reviews"],
            ] as const).map(([label, n, icon, to], i) => (
              <div key={i} className={card}>
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><span aria-hidden className="text-primary">{icon}</span>{label}</p>
                <p className="mt-1 font-display text-3xl">{n}</p>
                {to && <Link to={to} className="text-xs underline">{L("Open", "افتح")}</Link>}
              </div>))}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="ad-q" className={card}>
              <h2 id="ad-q" className="font-display text-xl">{L("Approval queue", "قائمة الموافقات")}</h2>
              <p className="text-sm text-muted-foreground">{L("Oldest first.", "الأقدم أولًا.")}</p>
              <ul className="mt-3 divide-y divide-border">{pending.slice(0, 10).map((x: any) => { const a = age(x.submitted_at); return (
                <li key={x.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="truncate">{title(x)}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${a != null && a >= 3 ? "bg-destructive/10 text-destructive" : "bg-muted"}`}>{a == null ? "—" : L(`${a}d waiting`, `${a} يوم انتظار`)}</span>
                </li>); })}
                {pending.length === 0 && <li className="py-2 text-sm text-muted-foreground">{L("Nothing waiting for review.", "لا شيء بانتظار المراجعة.")}</li>}
              </ul>
              <Link to="/admin/listings" className="mt-3 inline-block rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground">{L("Open listing review", "افتح مراجعة الإعلانات")}</Link>
            </section>

            <section aria-labelledby="ad-s" className={card}>
              <h2 id="ad-s" className="font-display text-xl">{L("Stock levels", "مستويات المخزون")}</h2>
              <p className="text-sm text-muted-foreground">{L("Low and out-of-stock first. Staff changes to a seller's stock are logged.", "المنخفض والنافد أولًا. تغييرات الفريق على مخزون البائع تُسجّل.")}</p>
              <ul className="mt-3 max-h-96 divide-y divide-border overflow-y-auto">{[...live].sort((a: any, b: any) => {
                const r = (l: any) => l.stock == null ? 2 : l.stock <= l.low_stock_at ? 0 : 1; return r(a) - r(b); }).map((l: any) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="truncate">{title(l)}</span>
                  <StockEditor listingId={l.id} stock={l.stock} low={l.low_stock_at} onSaved={() => void q.refetch()} />
                </li>))}</ul>
            </section>

            <section aria-labelledby="ad-r" className={card}>
              <h2 id="ad-r" className="flex items-center gap-2 font-display text-xl"><Star aria-hidden className="h-4 w-4 text-primary" />{L("Latest reviews", "أحدث التقييمات")}</h2>
              <ul className="mt-3 space-y-2">{d.reviews.map((r: any) => (
                <li key={r.id} className="rounded-xl bg-muted/40 p-3 text-sm">
                  <p><span aria-label={L(`${r.rating} of 5 stars`, `${r.rating} من 5`)}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span> · {r.author_name} · {names.get(r.listing_id) ?? r.listing_id}{r.status !== "visible" && <span className="ms-2 rounded-full bg-muted px-2 py-0.5 text-xs">{r.status}</span>}</p>
                  <p className="mt-1 line-clamp-2">{r.body}</p>
                </li>))}
                {d.reviews.length === 0 && <li className="text-sm text-muted-foreground">{L("No reviews yet.", "لا تقييمات بعد.")}</li>}
              </ul>
              <Link to="/admin/reviews" className="mt-3 inline-block text-sm underline">{L("Review moderation", "الإشراف على التقييمات")}</Link>
            </section>

            <section aria-labelledby="ad-a" className={card}>
              <h2 id="ad-a" className="font-display text-xl">{L("Recent staff activity", "نشاط الفريق الأخير")}</h2>
              <ul className="mt-3 divide-y divide-border">{d.audit.map((a: any) => (
                <li key={a.id} className="py-2 text-sm">
                  <span className="font-medium">{ACT[a.action] ? L(ACT[a.action]![0], ACT[a.action]![1]) : a.action}</span>
                  <span className="text-muted-foreground"> · {names.get(a.target_id) ?? a.target_type} · {new Date(a.created_at).toLocaleString(ar ? "ar" : "en")}</span>
                  {a.reason && <span className="block truncate text-xs text-muted-foreground">{a.reason}</span>}
                </li>))}
                {d.audit.length === 0 && <li className="py-2 text-sm text-muted-foreground">{L("No staff actions yet.", "لا إجراءات بعد.")}</li>}
              </ul>
            </section>
          </div>
        </>)}
      </div>
    </SiteShell>
  );
}
