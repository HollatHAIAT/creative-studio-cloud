import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircleQuestion } from "lucide-react";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { useLocale } from "@/lib/i18n";
import { useMyOrders } from "@/lib/orders";
import { ActionButton, useAction } from "@/components/ActionButton";
import { askOrderHelp, type OrderHelpAnswer } from "@/lib/order-help.functions";

export const Route = createFileRoute("/_authenticated/order-help")({
  head: () => ({
    meta: [
      { title: "Order help — Arwiqa أروقة" },
      { name: "description", content: "Ask about your orders and shipments and get answers from your order history." },
      { property: "og:title", content: "Order help — Arwiqa أروقة" },
      { property: "og:description", content: "Answers about your orders, payments, shipping and refunds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrderHelp,
});

const EXAMPLES = [
  ["Where is my latest order?", "أين طلبي الأخير؟"],
  ["Why did my payment fail?", "لماذا فشل الدفع؟"],
  ["What's the status of my refund?", "ما حالة طلب الاسترداد؟"],
] as const;

function OrderHelp() {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const L = (en: string, a: string) => (ar ? a : en);
  const call = useServerFn(askOrderHelp);
  const myOrders = useMyOrders();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<OrderHelpAnswer | null>(null);
  const act = useAction(async () => {
    const r = await call({ data: { question: q } });
    setRes(r);
    if (r.error) throw new Error(r.error);
  });
  const idOf = (ref: string) => (myOrders.data as { id: string; reference: string }[] | undefined)?.find((o) => o.reference === ref)?.id;

  return (
    <SiteShell>
      <PageTitle eyebrow={L("Order help", "مساعدة الطلبات")} title={L("Ask about your orders", "اسأل عن طلباتك")}
        sub={L("Describe your question — we'll answer from your own order and shipping history.", "صِف سؤالك وسنجيب من سجل طلباتك وشحناتك.")} />
      <div className="mx-auto max-w-3xl px-6 pb-20">
        <form onSubmit={(e) => { e.preventDefault(); if (q.trim().length >= 3) void act.run(); }} className="space-y-3">
          <label htmlFor="q" className="sr-only">{L("Your question", "سؤالك")}</label>
          <textarea id="q" rows={4} maxLength={1000} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={L("e.g. When will the print I ordered last week arrive?", "مثال: متى تصل المطبوعة التي طلبتها الأسبوع الماضي؟")}
            className="w-full rounded-md border border-border bg-card p-4 outline-none focus:border-primary" />
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => <button key={ex[0]} type="button" onClick={() => setQ(ar ? ex[1] : ex[0])}
              className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground hover:border-primary hover:text-foreground">{ar ? ex[1] : ex[0]}</button>)}
          </div>
          <ActionButton type="submit" state={act.state} disabled={q.trim().length < 3}
            loadingLabel={L("Checking your orders…", "جارٍ مراجعة طلباتك…")} successLabel={L("Done", "تم")}
            errorLabel={res?.error ?? L("Couldn't get an answer", "تعذّر الحصول على إجابة")}
            onRetry={act.retry} retryLabel={L("Try again", "حاول مجددًا")}
            className="rounded-md bg-primary px-5 py-2.5 text-primary-foreground">
            <MessageCircleQuestion aria-hidden className="h-4 w-4" />{L("Ask", "اسأل")}
          </ActionButton>
        </form>

        {res && !res.error && (
          <section aria-live="polite" className="mt-10 border-t border-border pt-8">
            {res.noOrders ? (
              <p className="text-muted-foreground">{L("You don't have any orders yet.", "لا توجد لديك طلبات بعد.")} <Link to="/explore" className="underline">{L("Explore artworks", "تصفّح الأعمال")}</Link></p>
            ) : (
              <>
                <p className="font-display text-xl leading-relaxed">{ar ? res.answerAr : res.answer}</p>
                {!!res.orders?.length && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {res.orders.map((r) => { const id = idOf(r); return id
                      ? <Link key={r} to="/orders/$id" params={{ id }} className="rounded-full border border-border px-3 py-1 text-sm hover:border-primary">{L("Order", "الطلب")} {r}</Link>
                      : <span key={r} className="rounded-full border border-border px-3 py-1 text-sm">{r}</span>; })}
                  </div>
                )}
                <p className="mt-6 text-xs text-muted-foreground">{L("Answers use only your order history. For anything else, contact support.", "تعتمد الإجابات على سجل طلباتك فقط. لأي أمر آخر تواصل مع الدعم.")}</p>
              </>
            )}
          </section>
        )}
      </div>
    </SiteShell>
  );
}
