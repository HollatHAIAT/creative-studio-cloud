import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MessageSquare, Package, Star, Tag } from "lucide-react";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { StockEditor } from "@/components/StockEditor";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";

const sb = supabase as any;

export const Route = createFileRoute("/_authenticated/seller-dashboard")({
  head: () => ({ meta: [
    { title: "Seller dashboard — Arwiqa أروقة" },
    { name: "description", content: "Manage your listings, stock levels, approvals and review activity in one place." },
    { property: "og:title", content: "Seller dashboard — Arwiqa" },
    { property: "og:description", content: "Your listings, stock, approvals and reviews on Arwiqa." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: SellerDashboard,
});

const ST: Record<string, [string, string, string]> = {
  draft: ["Draft", "مسودة", "bg-muted text-muted-foreground"],
  submitted: ["Awaiting review", "بانتظار المراجعة", "bg-warning/15 text-warning"],
  approved: ["Approved", "مقبولة", "bg-primary/10 text-primary"],
  rejected: ["Changes needed", "تحتاج تعديلات", "bg-destructive/10 text-destructive"],
  published: ["Live", "منشورة", "bg-success/15 text-success"],
};

function SellerDashboard() {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const [f, setF] = useState("all");
  const q = useQuery({
    queryKey: ["seller-dashboard"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser(); const uid = u.user!.id;
      const [drafts, listings] = await Promise.all([
        sb.from("listing_drafts").select("id,title,title_ar,status,review_note,updated_at,published_listing_id,workflow_id,workflow_step").eq("user_id", uid).order("updated_at", { ascending: false }).limit(100),
        sb.from("listings").select("id,title,title_ar,price,status,stock,low_stock_at,created_at").eq("owner_user_id", uid).order("created_at", { ascending: false }),
      ]);
      const ids = (listings.data ?? []).map((l: any) => l.id); const dIds = (drafts.data ?? []).map((d: any) => d.id);
      const [reviews, offers, inquiries, comments] = await Promise.all([
        ids.length ? sb.from("reviews").select("id,listing_id,rating,body,author_name,owner_reply,created_at").in("listing_id", ids).eq("status", "visible").order("created_at", { ascending: false }).limit(10) : { data: [] },
        ids.length ? sb.from("offers").select("id,listing_id,amount,status,created_at").in("listing_id", ids).eq("status", "pending") : { data: [] },
        ids.length ? sb.from("inquiries").select("id,listing_id,reply").in("listing_id", ids).is("reply", null) : { data: [] },
        dIds.length ? sb.from("listing_review_comments").select("id,draft_id,body,created_at,score,recommendation").in("draft_id", dIds).order("created_at", { ascending: false }).limit(8) : { data: [] },
      ]);
      return { drafts: drafts.data ?? [], listings: listings.data ?? [], reviews: reviews.data ?? [], offers: offers.data ?? [], inquiries: inquiries.data ?? [], comments: comments.data ?? [] };
    },
  });
  const d = q.data;
  const count = (s: string) => d?.drafts.filter((x: any) => x.status === s).length ?? 0;
  const low = d?.listings.filter((l: any) => l.stock != null && l.stock <= l.low_stock_at) ?? [];
  const avg = d?.reviews.length ? (d.reviews.reduce((s: number, r: any) => s + r.rating, 0) / d.reviews.length).toFixed(1) : null;
  const title = (x: any) => (ar ? x.title_ar || x.title : x.title || x.title_ar) || L("Untitled", "بدون عنوان");
  const tLookup = new Map<string, string>([...(d?.listings ?? []).map((l: any) => [l.id, title(l)] as [string, string]), ...(d?.drafts ?? []).map((x: any) => [x.id, title(x)] as [string, string])]);
  const card = "rounded-2xl border border-border p-4";

  return (
    <SiteShell>
      <PageTitle eyebrow={L("Sellers", "البائعون")} title={L("Seller dashboard", "لوحة البائع")} sub={L("Your listings, stock, approvals and what buyers and reviewers are saying.", "إعلاناتك ومخزونك وموافقاتك وما يقوله المشترون والمراجعون.")} />
      <div className="mx-auto max-w-7xl space-y-8 px-6 pb-16">
        {q.isLoading ? <p className="text-muted-foreground">{L("Loading…", "جارٍ التحميل…")}</p> : q.error ? <p role="alert" className="text-destructive">{L("Couldn't load your dashboard.", "تعذّر تحميل لوحتك.")}</p> : d && (<>
          <section aria-label={L("Summary", "الملخص")} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              [L("Live listings", "إعلانات منشورة"), d.listings.filter((l: any) => l.status === "published").length, <Package key="p" className="h-4 w-4" />],
              [L("Awaiting review", "بانتظار المراجعة"), count("submitted"), <Tag key="t" className="h-4 w-4" />],
              [L("Low or out of stock", "مخزون منخفض أو نافد"), low.length, <Package key="l" className="h-4 w-4" />],
              [L("Open offers & questions", "عروض وأسئلة مفتوحة"), d.offers.length + d.inquiries.length, <MessageSquare key="m" className="h-4 w-4" />],
              [L("Average rating", "متوسط التقييم"), avg ?? "—", <Star key="s" className="h-4 w-4" />],
            ].map(([label, n, icon], i) => (
              <div key={i} className={card}><p className="flex items-center gap-2 text-sm text-muted-foreground"><span aria-hidden className="text-primary">{icon}</span>{label}</p><p className="mt-1 font-display text-3xl">{n}</p></div>))}
          </section>

          <section aria-labelledby="sd-drafts" className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="sd-drafts" className="font-display text-xl">{L("Listings & approvals", "الإعلانات والموافقات")}</h2>
              <Link to="/listing-writer" className="rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground">{L("New listing", "إعلان جديد")}</Link>
            </div>
            <div role="group" aria-label={L("Filter by status", "تصفية حسب الحالة")} className="mt-3 flex flex-wrap gap-2">
              {["all", ...Object.keys(ST)].map((s) => (
                <button key={s} type="button" aria-pressed={f === s} onClick={() => setF(s)} className={`rounded-full border px-3 py-1 text-sm ${f === s ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>
                  {s === "all" ? L("All", "الكل") : L(ST[s]![0], ST[s]![1])} ({s === "all" ? d.drafts.length : count(s)})</button>))}
            </div>
            <ul className="mt-3 divide-y divide-border">{d.drafts.filter((x: any) => f === "all" || x.status === f).map((x: any) => { const s = ST[x.status] ?? ST["draft"]!; return (
              <li key={x.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{title(x)}</p>
                  {x.review_note && x.status === "rejected" && <p className="text-muted-foreground">{L("Reviewer:", "المراجع:")} {x.review_note}</p>}
                  <p className="text-xs text-muted-foreground">{L("Updated", "حُدّث")} {new Date(x.updated_at).toLocaleDateString(ar ? "ar" : "en")}</p>
                </div>
                <span className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${s[2]}`}>{L(s[0], s[1])}</span>
                  {x.published_listing_id ? <Link to="/listing/$id" params={{ id: x.published_listing_id }} className="text-xs underline">{L("View", "اعرض")}</Link>
                    : <Link to="/listing-writer" className="text-xs underline">{L("Edit", "حرّر")}</Link>}
                  {x.status === "rejected" && <Link to="/revision-check" className="text-xs underline">{L("Revision check", "فحص التعديلات")}</Link>}
                </span>
              </li>); })}
              {d.drafts.length === 0 && <li className="py-3 text-sm text-muted-foreground">{L("No listings yet — start one in the listing writer.", "لا إعلانات بعد — ابدأ من كاتب الإعلانات.")}</li>}
            </ul>
          </section>

          <section aria-labelledby="sd-stock" className={card}>
            <h2 id="sd-stock" className="font-display text-xl">{L("Stock levels", "مستويات المخزون")}</h2>
            <p className="text-sm text-muted-foreground">{L("Leave empty for one-of-a-kind originals you don't track. You'll see a warning at or below the low level.", "اتركه فارغًا للأعمال الأصلية الفريدة التي لا تتتبّعها. سترى تنبيهًا عند الحد المنخفض أو أقل.")}</p>
            <ul className="mt-3 divide-y divide-border">{d.listings.map((l: any) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span><span className="font-medium">{title(l)}</span> <span className="text-muted-foreground">· ${Number(l.price).toLocaleString()}</span></span>
                <StockEditor listingId={l.id} stock={l.stock} low={l.low_stock_at} onSaved={() => void q.refetch()} />
              </li>))}
              {d.listings.length === 0 && <li className="py-3 text-sm text-muted-foreground">{L("Nothing live in the shop yet.", "لا شيء منشور في المتجر بعد.")}</li>}
            </ul>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="sd-rev" className={card}>
              <h2 id="sd-rev" className="font-display text-xl">{L("Buyer reviews", "تقييمات المشترين")}</h2>
              <ul className="mt-3 space-y-2">{d.reviews.map((r: any) => (
                <li key={r.id} className="rounded-xl bg-muted/40 p-3 text-sm">
                  <p><span aria-label={L(`${r.rating} of 5 stars`, `${r.rating} من 5`)}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span> · {r.author_name} · {tLookup.get(r.listing_id)}</p>
                  <p className="mt-1">{r.body}</p>
                  {!r.owner_reply && <p className="mt-1 text-xs text-warning">{L("No reply yet", "لم يُرد بعد")}</p>}
                </li>))}
                {d.reviews.length === 0 && <li className="text-sm text-muted-foreground">{L("No reviews yet.", "لا تقييمات بعد.")}</li>}
              </ul>
            </section>
            <section aria-labelledby="sd-com" className={card}>
              <h2 id="sd-com" className="font-display text-xl">{L("Reviewer activity", "نشاط المراجعين")}</h2>
              <ul className="mt-3 space-y-2">{d.comments.map((c: any) => (
                <li key={c.id} className="rounded-xl bg-muted/40 p-3 text-sm">
                  <p className="text-xs text-muted-foreground">{tLookup.get(c.draft_id)} · {new Date(c.created_at).toLocaleDateString(ar ? "ar" : "en")}{c.score ? ` · ★${c.score}` : ""}{c.recommendation ? ` · ${c.recommendation}` : ""}</p>
                  <p className="mt-1 line-clamp-3 whitespace-pre-line">{c.body}</p>
                </li>))}
                {d.comments.length === 0 && <li className="text-sm text-muted-foreground">{L("No reviewer comments yet.", "لا تعليقات من المراجعين بعد.")}</li>}
              </ul>
              {(d.offers.length > 0 || d.inquiries.length > 0) && <p className="mt-3 text-sm">{L(`${d.offers.length} offer(s) and ${d.inquiries.length} question(s) are waiting for your answer on your artwork pages.`, `${d.offers.length} عرض و${d.inquiries.length} سؤال بانتظار ردك في صفحات أعمالك.`)}</p>}
            </section>
          </div>
        </>)}
      </div>
    </SiteShell>
  );
}
