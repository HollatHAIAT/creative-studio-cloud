import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [
    { title: "Notification settings — creativestudio" }, { name: "description", content: "Choose which order, ticket and bid alerts you receive." },
    { property: "og:title", content: "Settings — creativestudio" }, { property: "og:description", content: "Notification settings." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: Settings,
});

type Prefs = { orders: boolean; tickets: boolean; bids: boolean };

function Settings() {
  const { t } = useLocale();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["prefs"],
    queryFn: async () => {
      const { data } = await supabase.from("notification_prefs").select("orders, tickets, bids").maybeSingle();
      return (data ?? { orders: true, tickets: true, bids: true }) as Prefs;
    },
  });
  const save = useMutation({
    mutationFn: async (p: Prefs) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("notification_prefs").upsert({ user_id: u.user!.id, ...p, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("set.saved")); qc.invalidateQueries({ queryKey: ["prefs"] }); },
  });
  const p = q.data;
  return (
    <SiteShell>
      <PageTitle eyebrow={t("nav.account")} title={t("set.title")} />
      <div className="mx-auto max-w-xl space-y-4 px-6">
        {p && (["orders", "tickets", "bids"] as const).map((k) => (
          <label key={k} className="flex items-center justify-between rounded-sm border border-border bg-card p-4">
            <span>{t(`set.${k}`)}</span>
            <Switch checked={p[k]} onCheckedChange={(v) => save.mutate({ ...p, [k]: v })} />
          </label>
        ))}
      </div>
    </SiteShell>
  );
}
