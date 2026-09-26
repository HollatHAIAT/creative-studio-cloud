import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";
import { fmtDateTime } from "@/lib/orders";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [
    { title: "Notifications — creativestudio" }, { name: "description", content: "Order, ticket and bid alerts." },
    { property: "og:title", content: "Notifications — creativestudio" }, { property: "og:description", content: "Your alerts." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: Notifications,
});

function Notifications() {
  const { t, locale } = useLocale();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["notifications", "list"], queryFn: async () => (await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [] });
  const mark = useMutation({
    mutationFn: async (id?: string) => {
      const base = supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
      await (id ? base.eq("id", id) : base);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  return (
    <SiteShell>
      <PageTitle eyebrow={t("nav.account")} title={t("nt.title")} />
      <div className="mx-auto max-w-3xl px-6">
        <div className="mb-4 flex justify-between text-sm"><Link to="/settings" className="underline">{t("set.title")}</Link><button onClick={() => mark.mutate(undefined)} className="underline">{t("nt.markAll")}</button></div>
        {q.data?.length === 0 && <p className="text-muted-foreground">{t("nt.none")}</p>}
        <ul className="divide-y divide-border border-y border-border">
          {q.data?.map((n) => (
            <li key={n.id} className={`flex gap-3 py-4 ${n.read_at ? "opacity-60" : ""}`}>
              <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-primary"}`} />
              <div className="flex-1">
                <p className="font-medium">{locale === "ar" ? n.title_ar : n.title}</p>
                <p className="text-sm text-muted-foreground">{locale === "ar" ? n.body_ar : n.body}</p>
                <p className="text-xs text-muted-foreground">{fmtDateTime(n.created_at, locale)} · {n.kind}</p>
              </div>
              {n.link && <a href={n.link} onClick={() => mark.mutate(n.id)} className="self-center text-sm underline">→</a>}
            </li>
          ))}
        </ul>
      </div>
    </SiteShell>
  );
}
