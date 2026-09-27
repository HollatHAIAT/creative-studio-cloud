import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [
    { title: "Notification settings — Arwiqa أروقة" }, { name: "description", content: "Choose which order, ticket and bid alerts you receive." },
    { property: "og:title", content: "Settings — Arwiqa أروقة" }, { property: "og:description", content: "Notification settings." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: Settings,
});

type Prefs = { orders: boolean; tickets: boolean; bids: boolean; shipping: boolean; email_orders: boolean; email_shipping: boolean };
const DEFAULTS: Prefs = { orders: true, tickets: true, bids: true, shipping: true, email_orders: true, email_shipping: true };

function Settings() {
  const { t, locale } = useLocale();
  const ar = locale === "ar";
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["prefs"],
    queryFn: async () => {
      const { data } = await supabase.from("notification_prefs").select("orders, tickets, bids, shipping, email_orders, email_shipping").maybeSingle();
      return { ...DEFAULTS, ...(data ?? {}) } as Prefs;
    },
  });
  const save = useMutation({
    mutationFn: async (p: Prefs) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("notification_prefs").upsert({ user_id: u.user!.id, ...p, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onMutate: (p) => qc.setQueryData(["prefs"], p),
    onSuccess: () => toast.success(t("set.saved")),
    onError: () => { toast.error(ar ? "تعذّر حفظ الإعدادات، حاول مجدداً" : "Couldn't save settings, please try again"); qc.invalidateQueries({ queryKey: ["prefs"] }); },
  });
  const p = q.data;
  const rows: { label: string; hint: string; app: keyof Prefs; email?: keyof Prefs }[] = [
    { label: ar ? "تحديثات الطلب" : "Order updates", hint: ar ? "الدفع، التجهيز، الإلغاء والاسترداد" : "Payment, preparation, cancellation and refunds", app: "orders", email: "email_orders" },
    { label: ar ? "تحديثات الشحن" : "Shipment updates", hint: ar ? "عند شحن طلبك وتسليمه" : "When your order ships and is delivered", app: "shipping", email: "email_shipping" },
    { label: t("set.tickets"), hint: ar ? "إصدار التذاكر وتغييراتها" : "Ticket issue and changes", app: "tickets" },
    { label: t("set.bids"), hint: ar ? "عند تجاوز مزايدتك" : "When you are outbid", app: "bids" },
  ];
  return (
    <SiteShell>
      <PageTitle eyebrow={t("nav.account")} title={t("set.title")} />
      <div className="mx-auto max-w-2xl px-6">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 border-b border-border pb-2 text-xs uppercase tracking-wide text-muted-foreground">
          <span>{ar ? "النوع" : "Type"}</span><span>{ar ? "داخل المنصة" : "In-app"}</span><span>{ar ? "البريد" : "Email"}</span>
        </div>
        {p && rows.map((r) => (
          <div key={r.app} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 border-b border-border py-4">
            <div><div className="font-medium">{r.label}</div><div className="text-sm text-muted-foreground">{r.hint}</div></div>
            <Switch aria-label={`${r.label} — ${ar ? "داخل المنصة" : "in-app"}`} checked={p[r.app]} onCheckedChange={(v) => save.mutate({ ...p, [r.app]: v })} />
            {r.email ? (
              <Switch aria-label={`${r.label} — ${ar ? "البريد" : "email"}`} checked={p[r.email]} onCheckedChange={(v) => save.mutate({ ...p, [r.email!]: v })} />
            ) : <span className="w-11 text-center text-muted-foreground">—</span>}
          </div>
        ))}
        <p className="mt-4 text-sm text-muted-foreground">{ar ? "تُرسل الرسائل إلى بريد حسابك." : "Emails go to your account's email address."}</p>
      </div>
    </SiteShell>
  );
}
