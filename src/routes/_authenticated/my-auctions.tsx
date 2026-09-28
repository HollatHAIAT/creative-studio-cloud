import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X, Trophy } from "lucide-react";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { AuctionList, CreateAuctionForm, StatusPill, auctionsDb, titleOf, type AuctionRow } from "@/components/AuctionManager";
import { useSession } from "@/lib/auth";
import { fmt } from "@/lib/data";
import { useLocale } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/my-auctions")({
  head: () => ({ meta: [
    { title: "My auctions — Arwiqa أروقة" },
    { name: "description", content: "Run your own auctions, answer invitations and pay for auctions you won." },
    { property: "og:title", content: "My auctions — Arwiqa" },
    { property: "og:description", content: "Owner tools, invitations and won auctions in one place." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: MyAuctions,
});

function MyAuctions() {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const { user } = useSession(); const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["manage-auctions", "mine", user?.id], enabled: !!user,
    queryFn: async () => {
      const [own, won, inv, listings] = await Promise.all([
        auctionsDb.from("auctions").select("*").eq("owner_user_id", user!.id).order("ends_at", { ascending: false }),
        auctionsDb.from("auctions").select("*").eq("winner_user_id", user!.id),
        auctionsDb.from("auction_invites").select("*").order("created_at", { ascending: false }),
        auctionsDb.from("listings").select("id").eq("owner_user_id", user!.id),
      ]);
      const invites = ((inv.data ?? []) as any[]).filter((i) => i.email?.toLowerCase() === user!.email?.toLowerCase());
      return { own: (own.data ?? []) as AuctionRow[], won: (won.data ?? []) as AuctionRow[], invites, listingIds: ((listings.data ?? []) as { id: string }[]).map((x) => x.id) };
    },
  });
  async function respond(id: string, accept: boolean) {
    const { error } = await auctionsDb.rpc("respond_auction_invite", { _invite: id, _accept: accept });
    if (error) { toast.error(L("Couldn't save your answer.", "تعذّر حفظ ردّك.")); return; }
    toast.success(accept ? L("Invitation accepted — you can bid now", "قُبلت الدعوة — يمكنك المزايدة الآن") : L("Invitation declined", "رُفضت الدعوة"));
    qc.invalidateQueries({ queryKey: ["manage-auctions"] });
  }
  const d = q.data;
  return (
    <SiteShell>
      <PageTitle eyebrow={L("Auctions", "المزادات")} title={L("My auctions", "مزاداتي")} sub={L("Invitations, auctions you won, and auctions you run.", "الدعوات، والمزادات التي فزت بها، والمزادات التي تديرها.")} />
      <div className="mx-auto max-w-6xl space-y-10 px-6 pb-16">
        <section>
          <h2 className="mb-3 font-display text-2xl">{L("Invitations", "الدعوات")}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {d?.invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                <Link to="/auctions/$id" params={{ id: i.auction_id }} className="font-medium underline-offset-4 hover:underline">{titleOf(i.auction_id.split("-auc-")[0].replace(/-auction$/, ""), ar)}</Link>
                {i.status === "invited" ? (
                  <span className="flex gap-2">
                    <button onClick={() => respond(i.id, true)} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"><Check className="h-4 w-4" />{L("Accept", "قبول")}</button>
                    <button onClick={() => respond(i.id, false)} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm"><X className="h-4 w-4" />{L("Decline", "رفض")}</button>
                  </span>) : <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs">{i.status === "accepted" ? L("Accepted", "مقبولة") : L("Declined", "مرفوضة")}</span>}
              </li>))}
            {d && !d.invites.length && <li className="text-sm text-muted-foreground">{L("No invitations.", "لا توجد دعوات.")}</li>}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 font-display text-2xl">{L("Auctions I won", "مزادات فزت بها")}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {d?.won.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                <span><Trophy className="me-1 inline h-4 w-4 text-success" />{titleOf(a.listing_id, ar)} · {fmt(Number(a.winning_amount))}<span className="ms-2"><StatusPill status={a.status} /></span>
                  {a.status === "awaiting_payment" && a.pay_by && <span className="block text-xs text-warning">{L("Pay by", "ادفع قبل")} {new Date(a.pay_by).toLocaleString(ar ? "ar-SA" : "en-GB")}</span>}</span>
                {a.order_id && <Link to="/orders/$id" params={{ id: a.order_id }} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">{a.status === "awaiting_payment" ? L("Pay now", "ادفع الآن") : L("View order", "عرض الطلب")}</Link>}
              </li>))}
            {d && !d.won.length && <li className="text-sm text-muted-foreground">{L("You haven't won an auction yet.", "لم تفز بمزاد بعد.")}</li>}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 font-display text-2xl">{L("Auctions I run", "مزادات أديرها")}</h2>
          {d && <div className="mb-4"><CreateAuctionForm listingIds={d.listingIds} /></div>}
          {d && <AuctionList rows={d.own} />}
        </section>
      </div>
    </SiteShell>
  );
}
