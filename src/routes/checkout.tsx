import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CreditCard, Landmark, Smartphone, Apple, Check } from "lucide-react";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { actions, useStore } from "@/lib/store";
import { priceCart } from "@/lib/pricing";
import { placeOrder } from "@/lib/orders.functions";
const SELL_ERR: Record<string, [string, string]> = {
  LISTING_UNAVAILABLE: ["This artwork is no longer available.", "هذا العمل لم يعد متاحًا."],
  OUT_OF_STOCK: ["Sorry, this item just sold out.", "عذرًا، نفدت الكمية المتاحة من هذا العمل."],
  NOT_ENOUGH_STOCK: ["There aren't enough pieces left — reduce the quantity.", "الكمية المتبقية لا تكفي، قلّل العدد."],
  AGENT_NOT_APPROVED: ["The seller's agent isn't approved by the owner yet.", "وكيل البائع غير معتمد من المالك بعد."],
  AGENT_LICENSE_EXPIRED: ["The seller's agent authorization has expired.", "انتهت صلاحية تفويض وكيل البائع."],
  AGENT_SCOPE: ["The agent isn't authorized to sell this format.", "الوكيل غير مخوّل ببيع هذا الشكل."],
};
import { useLocale, type Key } from "@/lib/i18n";
import { useSession } from "@/lib/auth";
import { fmt } from "@/lib/data";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [
    { title: "Checkout — Arwiqa أروقة" }, { name: "description", content: "Review your cart and place your order for artworks, prints, licenses and exhibition tickets." },
    { property: "og:title", content: "Checkout — Arwiqa أروقة" }, { property: "og:description", content: "Complete your order." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: Checkout,
});

const METHODS = [
  { id: "card", k: "co.card", Icon: CreditCard }, { id: "mada", k: "co.mada", Icon: CreditCard },
  { id: "applepay", k: "co.applepay", Icon: Apple }, { id: "stcpay", k: "co.stcpay", Icon: Smartphone }, { id: "bank", k: "co.bank", Icon: Landmark },
] as const;
type Method = (typeof METHODS)[number]["id"];

function Checkout() {
  const { t, locale } = useLocale();
  const { cart } = useStore();
  const { user } = useSession();
  const items = cart ?? [];
  const priced = priceCart(items);
  const [step, setStep] = useState(0);
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [addr, setAddr] = useState({ line: "", city: "", country: "Saudi Arabia", postal: "" });
  const arCo = useLocale().locale === "ar";
  const [pickedId, setPickedId] = useState<string | null>(null);
  type Saved = { id: string; label: string; full_name: string; phone: string; line1: string; line2: string; city: string; region: string; postal_code: string; country: string; is_default: boolean };
  const saved = useQuery({ queryKey: ["addresses"], queryFn: async () => {
    const { data } = await (supabase as any).from("shipping_addresses").select("*").order("is_default", { ascending: false }).order("created_at");
    return (data ?? []) as Saved[];
  } });
  const useSaved = (a: Saved) => {
    setPickedId(a.id);
    setAddr({ line: [a.line1, a.line2, a.region].filter(Boolean).join("، "), city: a.city, country: a.country, postal: a.postal_code });
    setContact((c) => ({ ...c, name: c.name || a.full_name, phone: c.phone || a.phone }));
  };
  useEffect(() => { const d = saved.data?.[0]; if (d && !pickedId && !addr.line) useSaved(d); }, [saved.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const [method, setMethod] = useState<Method>("card");
  const [card, setCard] = useState({ number: "", exp: "", cvc: "" });
  const place = useServerFn(placeOrder);
  const [idem] = useState(() => crypto.randomUUID());
  const qc = useQueryClient();
  const navigate = useNavigate();
  const email = contact.email || user?.email || "";

  const m = useMutation({
    mutationFn: () => place({ data: { items, contact: { ...contact, email }, address: priced.needsShipping ? addr : null, paymentMethod: method, idempotencyKey: idem } }),
    onSuccess: (r) => {
      if (!r.ok) { toast.error(r.error === "SLOT_FULL" ? t("ex.soldOut") : SELL_ERR[r.error]?.[locale === "ar" ? 1 : 0] ?? r.error); return; }
      actions.clearCart();
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`${t("co.done")} · ${r.reference}`);
      navigate({ to: "/orders/$id", params: { id: r.orderId } });
    },
    onError: () => toast.error("Could not place order"),
  });

  const steps: Key[] = ["co.step1", "co.step2", "co.step3", "co.step4"];
  const field = "w-full rounded-sm border border-border bg-background px-3 py-2";
  const canNext = step === 0 ? contact.name.trim().length > 1 && /\S+@\S+\.\S+/.test(email)
    : step === 1 ? (!priced.needsShipping || (addr.line && addr.city && addr.country)) : true;

  if (!items.length) return (
    <SiteShell><PageTitle eyebrow={t("nav.cart")} title={t("cart.title")} /><div className="mx-auto max-w-7xl px-6"><p className="text-muted-foreground">{t("cart.empty")} <Link to="/explore" className="underline">{t("nav.explore")}</Link></p></div></SiteShell>
  );

  return (
    <SiteShell>
      <PageTitle eyebrow={t("nav.cart")} title={t("co.title")} />
      <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ol className="mb-8 flex gap-2 text-sm">
            {steps.map((s, i) => (
              <li key={s} className={`flex flex-1 items-center gap-2 border-b-2 pb-2 ${i <= step ? "border-primary" : "border-border text-muted-foreground"}`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${i < step ? "bg-primary text-primary-foreground" : "border border-border"}`}>{i < step ? <Check className="h-3 w-3" /> : i + 1}</span>{t(s)}
              </li>
            ))}
          </ol>

          {!user && <div className="mb-6 rounded-sm border border-primary p-4 text-sm">{t("auth.required")} — <Link to="/auth" search={{ next: "/checkout" }} className="underline">{t("auth.title")}</Link></div>}

          {step === 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm md:col-span-2">{t("co.fullName")}<input className={field} maxLength={100} value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} /></label>
              <label className="text-sm">{t("auth.email")}<input type="email" dir="ltr" className={field} maxLength={255} value={email} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></label>
              <label className="text-sm">{t("co.phone")}<input dir="ltr" className={field} maxLength={30} value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} /></label>
            </div>
          )}
          {step === 1 && (priced.needsShipping ? (
            <div className="grid gap-4 md:grid-cols-2">
              {!!saved.data?.length && (
                <fieldset className="md:col-span-2">
                  <legend className="text-sm font-medium">{arCo ? "اختر عنوانًا محفوظًا" : "Choose a saved address"}</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {saved.data.map((a) => (
                      <button type="button" key={a.id} onClick={() => useSaved(a)} aria-pressed={pickedId === a.id}
                        className={`rounded-md border p-3 text-start text-sm ${pickedId === a.id ? "border-primary bg-primary/5" : "border-border"}`}>
                        <span className="font-medium">{a.label || (arCo ? "عنوان" : "Address")}{a.is_default && <span className="ms-2 text-xs text-primary">{arCo ? "افتراضي" : "Default"}</span>}</span>
                        <span className="block text-muted-foreground">{[a.full_name, a.line1, a.line2, a.city, a.country].filter(Boolean).join("، ")}</span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{arCo ? "يمكنك تعديل الحقول أدناه لهذا الطلب فقط. " : "You can edit the fields below for this order only. "}<Link to="/profile" className="underline">{arCo ? "إدارة العناوين" : "Manage addresses"}</Link></p>
                </fieldset>
              )}
              <label className="text-sm md:col-span-2">{t("co.address")}<input className={field} maxLength={200} value={addr.line} onChange={(e) => setAddr({ ...addr, line: e.target.value })} /></label>
              <label className="text-sm">{t("co.city")}<input className={field} maxLength={100} value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} /></label>
              <label className="text-sm">{t("co.postal")}<input className={field} maxLength={20} value={addr.postal} onChange={(e) => setAddr({ ...addr, postal: e.target.value })} /></label>
              <label className="text-sm md:col-span-2">{t("co.country")}<input className={field} maxLength={100} value={addr.country} onChange={(e) => setAddr({ ...addr, country: e.target.value })} /></label>
            </div>
          ) : <p className="rounded-sm bg-muted p-4 text-sm">{t("co.noShipping")}</p>)}
          {step === 2 && (
            <div>
              <p className="mb-3 text-sm">{t("co.method")}</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {METHODS.map(({ id, k, Icon }) => (
                  <button key={id} onClick={() => setMethod(id)} className={`flex items-center gap-2 rounded-sm border p-4 text-sm ${method === id ? "border-primary bg-primary/10" : "border-border"}`}><Icon className="h-4 w-4" />{t(k)}</button>
                ))}
              </div>
              {(method === "card" || method === "mada") && (
                <div className="mt-6 grid gap-4 rounded-sm border border-border bg-card p-5 md:grid-cols-3" dir="ltr">
                  <label className="text-sm md:col-span-3">{t("co.cardNumber")}<input inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242" className={field} value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value.replace(/[^\d ]/g, "").slice(0, 19) })} /></label>
                  <label className="text-sm">{t("co.expiry")}<input placeholder="MM/YY" autoComplete="off" className={field} value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value.slice(0, 5) })} /></label>
                  <label className="text-sm">{t("co.cvc")}<input placeholder="123" autoComplete="off" className={field} value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) })} /></label>
                </div>
              )}
              <p className="mt-4 rounded-sm bg-muted p-3 text-xs">{t("co.demoPay")}</p>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-2 text-sm">
              <p><b>{contact.name}</b> · <span dir="ltr">{email}</span> {contact.phone && <>· <span dir="ltr">{contact.phone}</span></>}</p>
              {priced.needsShipping && <p>{addr.line}, {addr.city} {addr.postal}, {addr.country}</p>}
              <p>{t("co.method")}: {t(METHODS.find((x) => x.id === method)!.k)}</p>
              <p className="rounded-sm bg-muted p-3 text-xs">{t("co.demoPay")}</p>
            </div>
          )}

          <div className="mt-8 flex gap-3">
            {step > 0 && <button onClick={() => setStep(step - 1)} className="rounded-full border border-border px-6 py-3">{t("co.back")}</button>}
            {step < 3 ? <button disabled={!canNext} onClick={() => setStep(step + 1)} className="rounded-full bg-primary px-6 py-3 text-primary-foreground disabled:opacity-50">{t("co.next")}</button>
              : <button disabled={!user || m.isPending} onClick={() => m.mutate()} className="rounded-full bg-primary px-6 py-3 text-primary-foreground disabled:opacity-50">{m.isPending ? t("co.placing") : t("co.place")}</button>}
          </div>
        </div>

        <aside className="h-fit rounded-sm border border-border bg-card p-6 lg:col-span-2">
          <h2 className="font-display text-2xl">{t("cart.title")}</h2>
          <ul className="mt-4 divide-y divide-border">
            {priced.lines.map((l) => (
              <li key={l.key} className="flex items-start justify-between gap-3 py-3 text-sm">
                <div><p className="font-medium">{locale === "ar" ? l.titleAr : l.title}</p><p className="text-xs text-muted-foreground">{l.kind} · {l.detail} · ×{l.qty}</p>
                  <button onClick={() => actions.removeFromCart(l.key)} className="text-xs text-destructive underline">{t("cart.remove")}</button></div>
                <span>{fmt(l.amount)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
            <div className="flex justify-between"><dt>{t("co.subtotal")}</dt><dd>{fmt(priced.subtotal)}</dd></div>
            <div className="flex justify-between"><dt>{t("co.shipping")}</dt><dd>{fmt(priced.shipping)}</dd></div>
            <div className="flex justify-between"><dt>{t("co.vat")}</dt><dd>{fmt(priced.vat)}</dd></div>
            <div className="flex justify-between pt-2 font-display text-2xl"><dt>{t("co.total")}</dt><dd>{fmt(priced.total)}</dd></div>
          </dl>
        </aside>
      </div>
    </SiteShell>
  );
}
