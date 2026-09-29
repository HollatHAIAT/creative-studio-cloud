import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { useLocale } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support — Arwiqa أروقة" },
      { name: "description", content: "Answers about orders, payments, shipping, licenses, auctions and exhibitions, and a form to reach our team." },
      { property: "og:title", content: "Arwiqa support" },
      { property: "og:description", content: "Help with orders, auctions, exhibitions and selling on Arwiqa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Support,
});

type Ticket = { id: string; topic: string; subject: string; message: string; order_ref: string | null; status: string; reply: string | null; replied_at: string | null; created_at: string; user_id: string };
const TOPICS = ["order", "payment", "shipping", "licensing", "selling", "auction", "exhibition", "account", "other"] as const;
const TOPIC_AR: Record<string, string> = { order: "طلب", payment: "دفع", shipping: "شحن", licensing: "ترخيص", selling: "البيع", auction: "مزاد", exhibition: "معرض", account: "الحساب", other: "أخرى" };

function Support() {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [staff, setStaff] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [f, setF] = useState({ topic: "order", subject: "", message: "", order_ref: "" });
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    setUid(u.user?.id ?? null);
    if (!u.user) return;
    const { data: s } = await sb.rpc("caller_is_staff"); setStaff(!!s);
    const { data } = await sb.from("support_tickets").select("*").order("created_at", { ascending: false }).limit(100);
    setTickets(data ?? []);
  }
  useEffect(() => { void load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const { error } = await sb.from("support_tickets").insert({ topic: f.topic, subject: f.subject.trim(), message: f.message.trim(), order_ref: f.order_ref.trim() || null });
    setBusy(false);
    if (error) { toast.error(L("Couldn't send — subject needs 3+ characters and message 10+.", "تعذّر الإرسال — العنوان ٣ أحرف على الأقل والرسالة ١٠.")); return; }
    toast.success(L("Sent. We'll reply here and notify you.", "أُرسلت. سنرد هنا ونرسل لك إشعارًا."));
    setF({ topic: "order", subject: "", message: "", order_ref: "" }); void load();
  }

  const faq: [string, string, string][] = [
    [L("How do I pay?", "كيف أدفع؟"), L("By bank transfer to a Saudi bank. Your order page shows the details and reference; staff confirm the payment.", "بالتحويل إلى بنك سعودي. تظهر التفاصيل والرقم المرجعي في صفحة طلبك، ويؤكد الفريق الدفع."), "/orders"],
    [L("Where is my order?", "أين طلبي؟"), L("Open My orders to see the status timeline and tracking once shipped.", "افتح «طلباتي» لترى مراحل الطلب ورقم التتبع بعد الشحن."), "/orders"],
    [L("Can I return an artwork?", "هل يمكنني إرجاع عمل؟"), L("Request a return or refund from the order page within 14 days of delivery.", "اطلب الإرجاع أو الاسترداد من صفحة الطلب خلال ١٤ يومًا من الاستلام."), "/orders"],
    [L("I won an auction — what now?", "فزت بمزاد — ماذا الآن؟"), L("You'll get a notification with a payment deadline. Pay from My auctions before it expires, or it passes to the next bidder.", "يصلك إشعار بمهلة الدفع. ادفع من «مزاداتي» قبل انتهائها، وإلا ينتقل العمل للمزايد التالي."), "/my-auctions"],
    [L("How do exhibition tickets work?", "كيف تعمل تذاكر المعارض؟"), L("Book a date and slot; each ticket gets a code scanned at the entrance.", "احجز التاريخ والفترة، ولكل تذكرة رمز يُمسح عند الدخول."), "/exhibitions"],
    [L("How do I start selling?", "كيف أبدأ البيع؟"), L("Use the AI listing writer, choose a review path, then manage stock and offers from the seller dashboard.", "استخدم كاتب الإعلان بالذكاء الاصطناعي، واختر مسار المراجعة، ثم أدِر المخزون والعروض من لوحة البائع."), "/sell"],
  ];

  return (
    <SiteShell>
      <PageTitle eyebrow={L("Company", "الشركة")} title={L("Support", "الدعم")} sub={L("Quick answers first — and a direct line to our team.", "إجابات سريعة أولًا، وخط مباشر مع فريقنا.")} />
      <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-2">
        <section aria-labelledby="faq-h">
          <h2 id="faq-h" className="font-display text-2xl">{L("Common questions", "أسئلة شائعة")}</h2>
          <div className="mt-4 space-y-2">{faq.map(([q, a, to]) => (
            <details key={q} className="rounded-xl border border-border p-4">
              <summary className="cursor-pointer font-medium">{q}</summary>
              <p className="mt-2 text-sm text-muted-foreground">{a}</p>
              <Link to={to} className="mt-2 inline-block text-sm text-primary underline">{L("Go there", "انتقل")}</Link>
            </details>
          ))}</div>
        </section>
        <section aria-labelledby="contact-h">
          <h2 id="contact-h" className="font-display text-2xl">{L("Contact us", "راسلنا")}</h2>
          {uid === null ? (
            <p className="mt-4 text-sm">{L("Sign in to send a message and follow our reply.", "سجّل الدخول لإرسال رسالة ومتابعة الرد.")} <Link to="/auth" search={{ next: "/support" }} className="text-primary underline">{L("Sign in", "تسجيل الدخول")}</Link></p>
          ) : (
            <form onSubmit={submit} className="mt-4 space-y-3">
              <label className="block text-sm">{L("Topic", "الموضوع")}
                <select value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2">
                  {TOPICS.map((t) => <option key={t} value={t}>{ar ? TOPIC_AR[t] : t[0]!.toUpperCase() + t.slice(1)}</option>)}
                </select></label>
              <label className="block text-sm">{L("Subject", "العنوان")}<input required minLength={3} maxLength={150} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" /></label>
              <label className="block text-sm">{L("Order reference (optional)", "رقم الطلب (اختياري)")}<input maxLength={40} value={f.order_ref} onChange={(e) => setF({ ...f, order_ref: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" /></label>
              <label className="block text-sm">{L("Message", "الرسالة")}<textarea required minLength={10} maxLength={3000} rows={5} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" /></label>
              <button disabled={busy} className="rounded-full bg-primary px-5 py-2 text-primary-foreground disabled:opacity-50">{busy ? L("Sending…", "جارٍ الإرسال…") : L("Send", "أرسل")}</button>
            </form>
          )}
        </section>
      </div>
      {uid && (
        <section className="mx-auto mt-12 max-w-6xl px-6">
          <h2 className="font-display text-2xl">{staff ? L("All support requests", "كل طلبات الدعم") : L("My requests", "طلباتي")}</h2>
          {tickets.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{L("No requests yet.", "لا طلبات بعد.")}</p> : (
            <ul className="mt-4 space-y-3">{tickets.map((t) => <TicketRow key={t.id} t={t} staff={staff} ar={ar} onDone={load} />)}</ul>
          )}
        </section>
      )}
    </SiteShell>
  );
}

function TicketRow({ t, staff, ar, onDone }: { t: Ticket; staff: boolean; ar: boolean; onDone: () => void }) {
  const L = (e: string, a: string) => (ar ? a : e);
  const [reply, setReply] = useState("");
  const status = { open: L("Open", "مفتوح"), answered: L("Answered", "تم الرد"), closed: L("Closed", "مغلق") }[t.status] ?? t.status;
  async function send(close: boolean) {
    const { error } = await sb.rpc("staff_reply_support", { _ticket: t.id, _reply: reply.trim(), _close: close });
    if (error) toast.error(error.message); else { setReply(""); onDone(); }
  }
  return (
    <li className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{t.subject}</p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{(ar ? TOPIC_AR[t.topic] : t.topic)} · {status} · {new Date(t.created_at).toLocaleDateString(ar ? "ar-SA" : "en-GB")}</span>
      </div>
      {t.order_ref && <p className="text-xs text-muted-foreground">{L("Order", "الطلب")}: {t.order_ref}</p>}
      <p className="mt-2 whitespace-pre-line text-sm">{t.message}</p>
      {t.reply && <div className="mt-3 rounded-lg bg-muted p-3 text-sm"><p className="text-xs text-muted-foreground">{L("Arwiqa team", "فريق أروقة")}</p><p className="whitespace-pre-line">{t.reply}</p></div>}
      {staff && t.status !== "closed" && (
        <div className="mt-3 space-y-2">
          <textarea aria-label={L("Reply", "الرد")} rows={2} value={reply} onChange={(e) => setReply(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button type="button" disabled={reply.trim().length < 2} onClick={() => void send(false)} className="rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50">{L("Reply", "رد")}</button>
            <button type="button" disabled={reply.trim().length < 2} onClick={() => void send(true)} className="rounded-full border border-border px-4 py-1.5 text-sm disabled:opacity-50">{L("Reply & close", "رد وأغلق")}</button>
          </div>
        </div>
      )}
    </li>
  );
}
