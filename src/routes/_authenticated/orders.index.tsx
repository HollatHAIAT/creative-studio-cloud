import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { useLocale, type Key } from "@/lib/i18n";
import { fmtDateTime, itemsOf, useMyOrders } from "@/lib/orders";
import { fmt } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/orders/")({
  head: () => ({ meta: [
    { title: "My orders — Arwiqa أروقة" }, { name: "description", content: "Your artwork, print, license and ticket orders." },
    { property: "og:title", content: "My orders — Arwiqa أروقة" }, { property: "og:description", content: "Your orders and tickets." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: Orders,
});

function Orders() {
  const { t, locale } = useLocale();
  const q = useMyOrders();
  return (
    <SiteShell>
      <PageTitle eyebrow={t("nav.account")} title={t("ord.title")} />
      <div className="mx-auto max-w-7xl px-6">
        {q.isLoading && <p className="text-muted-foreground">…</p>}
        {q.data?.length === 0 && <p className="text-muted-foreground">{t("ord.none")} <Link to="/explore" className="underline">{t("nav.explore")}</Link></p>}
        <div className="divide-y divide-border border-y border-border">
          {q.data?.map((o) => {
            const items = itemsOf(o.items);
            const kinds = [...new Set(items.map((i) => i.kind))];
            return (
              <Link key={o.id} to="/orders/$id" params={{ id: o.id }} className="flex flex-wrap items-center gap-4 py-4 hover:bg-muted/40">
                <div className="flex-1">
                  <p className="font-display text-xl" dir="ltr">{o.reference}</p>
                  <p className="text-sm text-muted-foreground">{fmtDateTime(o.created_at, locale)} · {items.map((i) => (locale === "ar" ? i.titleAr ?? i.title : i.title)).join("، ")}</p>
                  <p className="text-xs text-muted-foreground">{kinds.join(" · ")}</p>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-xs">{t(`st.${o.status}` as Key)}</span>
                <span className="font-display text-xl">{fmt(Number(o.total))}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </SiteShell>
  );
}
