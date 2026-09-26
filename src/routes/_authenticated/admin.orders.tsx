import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { StaffGate } from "@/components/StaffGate";
import { supabase } from "@/integrations/supabase/client";
import { useLocale, type Key } from "@/lib/i18n";
import { fmtDateTime, itemsOf, ORDER_STATUSES } from "@/lib/orders";
import { fmt } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  head: () => ({ meta: [
    { title: "Order management — Arwiqa أروقة" }, { name: "description", content: "Staff review of ticket, artwork and license orders." },
    { property: "og:title", content: "Order management — Arwiqa أروقة" }, { property: "og:description", content: "Staff order management." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: () => <StaffGate><AdminOrders /></StaffGate>,
});

function AdminOrders() {
  const { t, locale } = useLocale();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [kind, setKind] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const orders = useQuery({ queryKey: ["admin", "orders"], queryFn: async () => (await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(500)).data ?? [] });
  const reqs = useQuery({ queryKey: ["admin", "requests"], queryFn: async () => (await supabase.from("refund_requests").select("*").order("created_at", { ascending: false })).data ?? [] });
  const events = useQuery({ queryKey: ["admin", "events", open], enabled: !!open, queryFn: async () => (await supabase.from("order_events").select("*").eq("order_id", open!).order("created_at")).data ?? [] });

  useEffect(() => {
    const ch = supabase.channel(`admin-orders-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => qc.invalidateQueries({ queryKey: ["admin"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "refund_requests" }, () => qc.invalidateQueries({ queryKey: ["admin"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.rpc("admin_set_order_status", { _order_id: id, _status: status, _note: note.trim().slice(0, 500) });
      if (error) throw error;
    },
    onSuccess: () => { setNote(""); toast.success(t("adm.setStatus")); qc.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const decide = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = await supabase.rpc("admin_decide_refund", { _request_id: id, _approve: approve, _note: note.trim().slice(0, 500) });
      if (error) throw error;
    },
    onSuccess: () => { setNote(""); qc.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = (reqs.data ?? []).filter((r) => r.status === "pending");
  const list = (orders.data ?? []).filter((o) => (filter === "all" || o.status === filter) && (kind === "all" || itemsOf(o.items).some((i) => i.kind === kind)));
  const field = "rounded-full border border-border bg-background px-3 py-1.5 text-sm";

  return (
    <SiteShell>
      <PageTitle eyebrow={t("nav.admin")} title={t("adm.orders")} />
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-4 flex flex-wrap gap-2 text-sm"><Link to="/admin/reports" className="underline">{t("adm.reports")}</Link> · <Link to="/admin/scan" className="underline">{t("adm.scan")}</Link></div>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={t("adm.note")} className="mb-6 w-full rounded-sm border border-border bg-background px-3 py-2 text-sm" />

        {pending.length > 0 && (
          <section className="mb-10 rounded-sm border border-primary p-4">
            <h2 className="font-display text-2xl">{t("adm.pendingReq")} ({pending.length})</h2>
            <ul className="mt-3 divide-y divide-border">
              {pending.map((r) => {
                const o = orders.data?.find((x) => x.id === r.order_id);
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                    <span className="flex-1"><b dir="ltr">{o?.reference}</b> · {r.kind === "cancel" ? t("ord.cancel") : t("ord.refund")} · {r.reason}<br /><span className="text-xs text-muted-foreground">{fmtDateTime(r.created_at, locale)}</span></span>
                    <button onClick={() => decide.mutate({ id: r.id, approve: true })} className="rounded-full bg-primary px-4 py-1.5 text-primary-foreground">{t("adm.approve")}</button>
                    <button onClick={() => decide.mutate({ id: r.id, approve: false })} className="rounded-full border border-border px-4 py-1.5">{t("adm.reject")}</button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <div className="mb-4 flex flex-wrap gap-3">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className={field}><option value="all">{t("adm.all")}</option>{ORDER_STATUSES.map((s) => <option key={s} value={s}>{t(`st.${s}` as Key)}</option>)}</select>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={field}><option value="all">{t("adm.all")}</option><option value="ticket">ticket</option><option value="original">original</option><option value="print">print</option><option value="license">license</option></select>
          <span className="self-center text-sm text-muted-foreground">{list.length}</span>
        </div>
        <div className="divide-y divide-border border-y border-border">
          {list.map((o) => (
            <div key={o.id} className="py-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <button onClick={() => setOpen(open === o.id ? null : o.id)} className="font-display text-lg underline" dir="ltr">{o.reference}</button>
                <span className="flex-1 text-muted-foreground">{fmtDateTime(o.created_at, locale)} · {(o.contact as { name?: string })?.name} · {itemsOf(o.items).map((i) => i.kind).join(", ")}</span>
                <span>{fmt(Number(o.total))}</span>
                <select value={o.status} onChange={(e) => setStatus.mutate({ id: o.id, status: e.target.value })} className={field} aria-label={t("adm.setStatus")}>
                  {ORDER_STATUSES.map((s) => <option key={s} value={s}>{t(`st.${s}` as Key)}</option>)}
                </select>
              </div>
              {open === o.id && (
                <div className="mt-3 grid gap-4 rounded-sm bg-muted p-4 text-sm md:grid-cols-2">
                  <ul>{itemsOf(o.items).map((i, n) => <li key={n}>{i.title} · {i.kind} · {i.detail} ×{i.qty} — {fmt(i.amount)}</li>)}</ul>
                  <ol className="space-y-1">{events.data?.map((e) => <li key={e.id}>{fmtDateTime(e.created_at, locale)} · {e.from_status ?? "—"} → {e.to_status}{e.note ? ` · ${e.note}` : ""}</li>)}</ol>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </SiteShell>
  );
}
