import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";
import { ROLES } from "@/components/OwnershipHeritage";

export const Route = createFileRoute("/_authenticated/owner-approvals")({
  head: () => ({ meta: [
    { title: "Owner approvals — Arwiqa أروقة" },
    { name: "description", content: "Approve artworks that agents, galleries, heirs or joint owners want to sell on your behalf." },
    { property: "og:title", content: "Owner approvals — Arwiqa" },
    { property: "og:description", content: "Approve listings that name you as the owner." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: OwnerApprovals,
});

type D = { id: string; user_id: string; title: string; title_ar: string; description: string; seller_role: string; owner_name: string; consignment_terms: string; co_owners: { name: string; email: string; share: string }[]; owner_approved_at: string | null; price: number | null };

function OwnerApprovals() {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const qc = useQueryClient(); const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["owner-approvals"], queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    const email = u.user?.email?.toLowerCase() ?? "";
    const { data, error } = await (supabase as any).from("listing_drafts").select("id,user_id,title,title_ar,description,seller_role,owner_name,consignment_terms,co_owners,owner_approved_at,price").eq("owner_email", email).neq("seller_role", "owner");
    if (error) throw error; return (data ?? []) as D[];
  } });
  async function approve(id: string) {
    if (busy) return; setBusy(id);
    const { error } = await (supabase as any).rpc("approve_listing_as_owner", { _draft: id });
    setBusy(null);
    if (error) { toast.error(String(error.message).includes("SELF") ? L("You can't approve your own listing.", "لا يمكنك الموافقة على إعلانك.") : L("Couldn't approve — make sure your email is confirmed.", "تعذّرت الموافقة — تأكد من تأكيد بريدك.")); return; }
    toast.success(L("Approved. The seller has been told.", "تمت الموافقة وأُبلغ البائع.")); void qc.invalidateQueries({ queryKey: ["owner-approvals"] });
  }
  const rows = q.data ?? [];
  return (
    <SiteShell>
      <PageTitle eyebrow={L("Selling for someone else", "البيع نيابة عن الغير")} title={L("Owner approvals", "موافقات المالك")} sub={L("Listings that someone wants to sell on your behalf. Nothing goes live until you approve.", "إعلانات يريد أحدهم بيعها نيابة عنك. لا يُنشر شيء قبل موافقتك.")} />
      <div className="mx-auto max-w-3xl space-y-3 px-4 pb-16">
        {q.isLoading ? <p>…</p> : q.error ? <p role="alert" className="text-destructive">{L("Couldn't load.", "تعذّر التحميل.")}</p>
          : rows.length === 0 ? <p className="text-muted-foreground">{L("No listings name you as the owner.", "لا توجد إعلانات تذكرك مالكاً.")}</p>
          : rows.map((d) => { const role = ROLES.find((r) => r[0] === d.seller_role); return (
            <article key={d.id} className="space-y-2 rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-lg">{(ar ? d.title_ar : d.title) || L("Untitled", "بلا عنوان")}</h2>
                <span className={`rounded-full px-2 py-0.5 text-xs ${d.owner_approved_at ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>{d.owner_approved_at ? L("Approved", "تمت الموافقة") : L("Waiting for you", "بانتظارك")}</span>
              </div>
              <p className="text-sm text-muted-foreground">{L("Seller's role", "صفة البائع")}: {role ? (ar ? role[2] : role[1]) : d.seller_role}{d.price ? ` · $${d.price}` : ""}</p>
              {d.consignment_terms && <p className="text-sm"><span className="text-muted-foreground">{L("Consignment terms", "شروط الأمانة")}: </span>{d.consignment_terms}</p>}
              {d.co_owners?.length > 0 && <p className="text-sm"><span className="text-muted-foreground">{L("Joint owners", "المالكون المشاركون")}: </span>{d.co_owners.map((c) => `${c.name}${c.share ? ` (${c.share}%)` : ""}`).join("، ")}</p>}
              <p className="line-clamp-3 text-sm">{d.description}</p>
              {!d.owner_approved_at && <button type="button" disabled={busy === d.id} onClick={() => void approve(d.id)} className="rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50">{L("Approve this listing", "وافق على هذا الإعلان")}</button>}
            </article>); })}
      </div>
    </SiteShell>
  );
}
