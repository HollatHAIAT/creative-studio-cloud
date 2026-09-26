import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type OrderItem = { kind: string; title: string; titleAr?: string; detail: string; unit: number; qty: number; amount: number };
export const itemsOf = (j: Json): OrderItem[] => (Array.isArray(j) ? (j as unknown as OrderItem[]) : []);
export const ORDER_STATUSES = ["awaiting_payment", "paid", "processing", "shipped", "delivered", "completed", "cancelled", "refunded"] as const;

export function useMyOrders() {
  return useQuery({
    queryKey: ["orders", "mine"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ["orders", "detail", id],
    queryFn: async () => {
      const [o, ev, bk, tk, rq] = await Promise.all([
        supabase.from("orders").select("*").eq("id", id).maybeSingle(),
        supabase.from("order_events").select("*").eq("order_id", id).order("created_at"),
        supabase.from("bookings").select("*").eq("order_id", id),
        supabase.from("tickets").select("*, bookings!inner(order_id, exhibition_id, visit_date, slot)").eq("bookings.order_id", id),
        supabase.from("refund_requests").select("*").eq("order_id", id).order("created_at", { ascending: false }),
      ]);
      if (o.error) throw o.error;
      return { order: o.data, events: ev.data ?? [], bookings: bk.data ?? [], tickets: tk.data ?? [], requests: rq.data ?? [] };
    },
  });
}

export function fmtDateTime(iso: string, locale: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return locale === "ar"
    ? `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
    : `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function toCsv(rows: (string | number | null | undefined)[][]) {
  return "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
}
export function downloadText(text: string, name: string, type = "text/csv") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
