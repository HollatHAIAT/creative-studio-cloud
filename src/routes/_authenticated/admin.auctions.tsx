import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { StaffGate } from "@/components/StaffGate";
import { AuctionList, CreateAuctionForm, auctionsDb, type AuctionRow } from "@/components/AuctionManager";
import { seedListings, fmt } from "@/lib/data";
import { useLocale } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/auctions")({
  head: () => ({ meta: [
    { title: "Auction administration — Arwiqa أروقة" },
    { name: "description", content: "Create and run auctions, manage invitees, choose winners and review every transaction." },
    { property: "og:title", content: "Auction administration — Arwiqa" },
    { property: "og:description", content: "Staff tools for the full auction lifecycle." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: () => <StaffGate><AdminAuctions /></StaffGate>,
});

function AdminAuctions() {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const q = useQuery({ queryKey: ["manage-auctions", "all"], queryFn: async () => ((await auctionsDb.from("auctions").select("*").order("ends_at", { ascending: false })).data ?? []) as AuctionRow[] });
  const rows = q.data ?? [];
  const stat = (s: string) => rows.filter((r) => r.status === s).length;
  const sold = rows.filter((r) => r.status === "sold").reduce((s, r) => s + Number(r.winning_amount ?? 0), 0);
  return (
    <SiteShell>
      <PageTitle eyebrow={L("Staff", "الفريق")} title={L("Auction administration", "إدارة المزادات")} sub={L("Create auctions, manage who can bid, close bidding, offer the lot to the winner and follow every transaction.", "أنشئ المزادات، وحدد من يزايد، وأغلق المزايدة، واعرض العمل على الفائز، وتابع كل عملية.")} />
      <div className="mx-auto max-w-6xl space-y-8 px-6 pb-16">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[[L("Live", "مباشر"), stat("live")], [L("Scheduled", "مجدول"), stat("scheduled")], [L("Awaiting payment", "بانتظار الدفع"), stat("awaiting_payment")], [L("Sold", "مُباع"), stat("sold")], [L("Sold value", "قيمة المبيعات"), fmt(sold)]].map(([k, v]) => (
            <div key={String(k)} className="rounded-2xl border border-border bg-card p-4"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-1 font-display text-2xl">{v}</dd></div>))}
        </dl>
        <section><h2 className="mb-3 font-display text-2xl">{L("New auction", "مزاد جديد")}</h2><CreateAuctionForm listingIds={seedListings.map((l) => l.id)} /></section>
        <section><h2 className="mb-3 font-display text-2xl">{L("All auctions", "كل المزادات")}</h2>
          {q.isLoading ? <p className="text-sm text-muted-foreground">…</p> : <AuctionList rows={rows} />}</section>
      </div>
    </SiteShell>
  );
}
