import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SiteShell } from "@/components/SiteShell";
import { TicketQR } from "@/components/TicketQR";
import { ActionButton, useAction } from "@/components/ActionButton";
import { supabase } from "@/integrations/supabase/client";
import { useLocale, type Key } from "@/lib/i18n";
import { fmtDateTime, itemsOf, useOrder } from "@/lib/orders";
import { exhibitions, fmt } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/orders/$id")({
  head: () => ({ meta: [
    { title: "Order details — Arwiqa أروقة" }, { name: "description", content: "Order status, items, tickets and receipt." },
    { property: "og:title", content: "Order details — Arwiqa أروقة" }, { property: "og:description", content: "Your order on Arwiqa." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: OrderPage,
});

const REFUND_ERR: Record<string, { en: string; ar: string }> = {
  REQUEST_PENDING: { en: "A request for this order is already under review.", ar: "يوجد طلب قيد المراجعة لهذا الطلب." },
  ALREADY_CLOSED: { en: "This order is already cancelled or refunded.", ar: "هذا الطلب ملغى أو مسترد مسبقًا." },
  TICKET_TOO_LATE: { en: "Tickets can only be cancelled up to 48 hours before the visit.", ar: "لا يمكن إلغاء التذاكر قبل أقل من ٤٨ ساعة من الزيارة." },
  CANCEL_NOT_ALLOWED: { en: "This order has shipped — request a refund instead.", ar: "تم شحن الطلب — قدّم طلب استرداد بدلًا من ذلك." },
  NOT_PAID: { en: "Refunds are for paid orders. Cancel it instead.", ar: "الاسترداد للطلبات المدفوعة فقط. يمكنك إلغاؤه." },
  REFUND_WINDOW_CLOSED: { en: "The 14-day refund window has closed.", ar: "انتهت مهلة الاسترداد (١٤ يومًا)." },
  LICENSE_NOT_REFUNDABLE: { en: "Paid digital licenses can't be refunded.", ar: "التراخيص الرقمية المدفوعة غير قابلة للاسترداد." },
};

function OrderPage() {
  const { id } = Route.useParams();
  const { t, locale } = useLocale();
  const q = useOrder(id);
  const qc = useQueryClient();
  const [kind, setKind] = useState<"cancel" | "refund">("cancel");
  const [reason, setReason] = useState("");
  const req = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("refund_requests").insert({ order_id: id, user_id: u.user!.id, kind, reason: reason.trim() });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { setReason(""); toast.success(t("st.pending")); qc.invalidateQueries({ queryKey: ["orders"] }); },
    onError: (e: Error) => { const k = Object.keys(REFUND_ERR).find((c) => e.message.includes(c)); toast.error(k ? REFUND_ERR[k]![locale] : e.message); },
  });

  if (q.isLoading) return <SiteShell><p className="p-16 text-center">…</p></SiteShell>;
  const o = q.data?.order;
  if (!o) return <SiteShell><p className="p-16 text-center">Order not found. <Link to="/orders" className="underline">{t("ord.title")}</Link></p></SiteShell>;
  const items = itemsOf(o.items);
  const d = q.data!;
  const exName = (eid: string) => { const e = exhibitions.find((x) => x.id === eid); return e ? (locale === "ar" ? e.titleAr : e.title) : eid; };

  return (
    <SiteShell>
      <div className="mx-auto max-w-5xl px-6 pt-12 print:pt-0">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-primary">{t("ord.receipt")}</p>
            <h1 className="font-display text-5xl" dir="ltr">{o.reference}</h1>
            <p className="text-sm text-muted-foreground">{t("ord.placed")}: {fmtDateTime(o.created_at, locale)}</p>
          </div>
          <div className="flex items-center gap-3 print:hidden">
            <span className="rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground">{t(`st.${o.status}` as Key)}</span>
            <button onClick={() => window.print()} className="rounded-full border border-border px-4 py-1.5 text-sm">{t("ord.print")}</button>
          </div>
        </div>

        <Fulfillment status={o.status} ar={locale === "ar"} />
        {o.status === "payment_failed" && <RetryPayment orderId={o.id} ar={locale === "ar"} error={(o as { payment_error?: string | null }).payment_error ?? null} onDone={() => qc.invalidateQueries({ queryKey: ["orders"] })} />}

        <section className="mt-8 rounded-sm border border-border bg-card p-6">
          <h2 className="font-display text-2xl">{t("ord.items")}</h2>
          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y divide-border">
              {items.map((i, n) => (
                <tr key={n}><td className="py-2">{locale === "ar" ? i.titleAr ?? i.title : i.title}<br /><span className="text-xs text-muted-foreground">{i.kind} · {i.detail}</span></td><td className="py-2 text-center">×{i.qty}</td><td className="py-2 text-end">{fmt(i.amount)}</td></tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
            <div className="flex justify-between"><dt>{t("co.subtotal")}</dt><dd>{fmt(Number(o.subtotal))}</dd></div>
            <div className="flex justify-between"><dt>{t("co.shipping")}</dt><dd>{fmt(Number(o.shipping))}</dd></div>
            <div className="flex justify-between"><dt>{t("co.vat")}</dt><dd>{fmt(Number(o.vat))}</dd></div>
            <div className="flex justify-between font-display text-2xl"><dt>{t("co.total")}</dt><dd>{fmt(Number(o.total))}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">{t("co.method")}: {t(`co.${o.payment_method}` as Key)}</p>
        </section>

        {d.tickets.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-2xl">{t("ord.tickets")}</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {d.tickets.map((tk) => (
                <div key={tk.id} className="flex gap-4 rounded-sm border border-border bg-card p-4">
                  <TicketQR code={tk.code} />
                  <div className="text-sm">
                    <p className="font-display text-lg">{exName(tk.bookings.exhibition_id)}</p>
                    <p>{tk.bookings.visit_date} · <span dir="ltr">{tk.bookings.slot}</span></p>
                    <p className="text-muted-foreground">{tk.ticket_type}</p>
                    <p className="mt-2 font-mono text-xs" dir="ltr">{tk.code}</p>
                    <span className="mt-2 inline-block rounded-full bg-muted px-3 py-0.5 text-xs">{t(`st.${tk.status}` as Key)}{tk.used_at ? ` · ${fmtDateTime(tk.used_at, locale)}` : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        {d.bookings.length > 0 && d.tickets.length === 0 && (
          <p className="mt-6 rounded-sm bg-muted p-4 text-sm">{d.bookings.map((b) => `${exName(b.exhibition_id)} · ${b.visit_date} ${b.slot} · ${t(`st.${b.status}` as Key)}`).join(" | ")}</p>
        )}

        <section className="mt-8 grid gap-8 md:grid-cols-2 print:hidden">
          <div>
            <h2 className="font-display text-2xl">{t("ord.history")}</h2>
            <ol className="mt-3 space-y-3 border-s border-border ps-4 text-sm">
              {d.events.map((e) => (
                <li key={e.id}><p>{e.from_status ? `${t(`st.${e.from_status}` as Key)} → ` : ""}{t(`st.${e.to_status}` as Key)}</p><p className="text-xs text-muted-foreground">{fmtDateTime(e.created_at, locale)}{e.note ? ` · ${e.note}` : ""}</p></li>
              ))}
            </ol>
          </div>
          <div>
            <h2 className="font-display text-2xl">{t("ord.request")}</h2>
            <p className="mt-2 text-xs text-muted-foreground">{t("ord.rules")}</p>
            {d.requests.map((r) => (
              <p key={r.id} className="mt-3 rounded-sm bg-muted p-3 text-sm">{r.kind === "cancel" ? t("ord.cancel") : t("ord.refund")} · {t(`st.${r.status}` as Key)}<br /><span className="text-xs">{r.reason}{r.decision_note ? ` — ${r.decision_note}` : ""}</span></p>
            ))}
            {!["cancelled", "refunded"].includes(o.status) && (
              <form onSubmit={(e) => { e.preventDefault(); if (reason.trim().length >= 5) req.mutate(); }} className="mt-4 space-y-3">
                <div className="flex gap-2">
                  {(["cancel", "refund"] as const).map((k) => <button type="button" key={k} onClick={() => setKind(k)} className={`rounded-full border px-4 py-1.5 text-sm ${kind === k ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{k === "cancel" ? t("ord.cancel") : t("ord.refund")}</button>)}
                </div>
                <label className="block text-sm">{t("ord.reason")}<textarea required minLength={5} maxLength={1000} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-sm border border-border bg-background px-3 py-2" /></label>
                <button disabled={req.isPending || reason.trim().length < 5} className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground disabled:opacity-50">{t("ord.submit")}</button>
              </form>
            )}
          </div>
        </section>
      </div>
    </SiteShell>
  );
}

const STEPS: { k: string; en: string; ar: string }[] = [
  { k: "pending", en: "Order placed", ar: "تم الطلب" },
  { k: "paid", en: "Payment confirmed", ar: "تأكيد الدفع" },
  { k: "processing", en: "Preparing", ar: "قيد التجهيز" },
  { k: "shipped", en: "Shipped", ar: "تم الشحن" },
  { k: "delivered", en: "Delivered", ar: "تم التسليم" },
];

function Fulfillment({ status, ar }: { status: string; ar: boolean }) {
  const idx = STEPS.findIndex((s) => s.k === status);
  if (idx < 0) return null;
  return (
    <ol className="mt-8 grid grid-cols-5 gap-2 print:hidden" aria-label={ar ? "مراحل الطلب" : "Order progress"}>
      {STEPS.map((s, i) => (
        <li key={s.k} aria-current={i === idx ? "step" : undefined} className="text-center text-xs">
          <span className={`mx-auto mb-2 block h-1.5 rounded-full ${i <= idx ? "bg-primary" : "bg-muted"}`} />
          <span className={i === idx ? "font-semibold" : "text-muted-foreground"}>{ar ? s.ar : s.en}</span>
        </li>
      ))}
    </ol>
  );
}

function RetryPayment({ orderId, ar, error, onDone }: { orderId: string; ar: boolean; error: string | null; onDone: () => void }) {
  const L = (en: string, a: string) => (ar ? a : en);
  const act = useAction(async () => {
    const { error: e } = await supabase.rpc("retry_payment", { _order: orderId });
    if (e) throw new Error(e.message.includes("TOO_MANY") ? L("Too many attempts — contact support.", "محاولات كثيرة — تواصل مع الدعم.") : e.message);
    toast.success(L("Payment resubmitted — we'll notify you once confirmed", "أُعيد إرسال الدفع — سنُعلمك عند التأكيد"));
    onDone();
  });
  return (
    <section role="status" className="mt-6 rounded-sm border border-destructive/40 bg-destructive/5 p-4">
      <p className="font-medium text-destructive">{L("Payment failed", "فشل الدفع")}{error ? ` — ${error}` : ""}</p>
      <p className="mt-1 text-sm text-muted-foreground">{L("Your order and details are kept. Retrying won't create a second order.", "طلبك وبياناتك محفوظة. إعادة المحاولة لا تُنشئ طلبًا جديدًا.")}</p>
      <div className="mt-3"><ActionButton state={act.state} onClick={() => void act.run()} className="rounded-full bg-primary px-5 py-2 text-primary-foreground"
        loadingLabel={L("Retrying…", "جارٍ إعادة المحاولة…")} successLabel={L("Resubmitted", "أُعيد الإرسال")} errorLabel={act.error instanceof Error ? act.error.message : L("Retry failed", "فشلت المحاولة")}
        onRetry={() => void act.retry()} retryLabel={L("Try again", "حاول مجددًا")}>{L("Retry payment", "أعد محاولة الدفع")}</ActionButton></div>
    </section>
  );
}
