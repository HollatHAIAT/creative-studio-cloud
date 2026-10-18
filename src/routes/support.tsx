import { usePlatformSettings, num } from "@/lib/platform-settings";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { useLocale } from "@/lib/i18n";
import { fill } from "@/lib/i18n-pages";
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

type Ticket = { id: string; reference: string; updated_at: string; topic: string; subject: string; message: string; order_ref: string | null; status: string; reply: string | null; replied_at: string | null; created_at: string; user_id: string };
const TOPICS = ["order", "payment", "shipping", "licensing", "selling", "auction", "exhibition", "account", "other"] as const;
const TOPIC_AR: Record<string, string> = { order: "طلب", payment: "دفع", shipping: "شحن", licensing: "ترخيص", selling: "البيع", auction: "مزاد", exhibition: "معرض", account: "الحساب", other: "أخرى" };

function Support() {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [staff, setStaff] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [f, setF] = useState({ topic: "order", subject: "", message: "", order_ref: "" });
  const [busy, setBusy] = useState(false);
  const [guest, setGuest] = useState({ name: "", email: "" });
  const [sent, setSent] = useState<{ ref: string; email: string } | null>(null);

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
    const { data: ref, error } = await sb.rpc("submit_support_request", { _topic: f.topic, _subject: f.subject.trim(), _message: f.message.trim(), _order_ref: f.order_ref.trim(), _name: guest.name.trim(), _email: guest.email.trim() });
    setBusy(false);
    if (error) {
      const m = String(error.message);
      toast.error(m.includes("BAD_EMAIL") ? L("Enter a valid email address.", "أدخل بريدًا إلكترونيًا صحيحًا.")
        : m.includes("BAD_NAME") ? L("Enter your name.", "أدخل اسمك.")
        : m.includes("TOO_MANY") ? L("Too many requests today — please try tomorrow.", "طلبات كثيرة اليوم — حاول غدًا.")
        : L("Couldn't send — subject needs 3+ characters and message 10+.", "تعذّر الإرسال — العنوان ٣ أحرف على الأقل والرسالة ١٠."));
      return;
    }
    setSent({ ref: String(ref), email: guest.email.trim() });
    setF({ topic: "order", subject: "", message: "", order_ref: "" }); void load();
  }

  const ps = usePlatformSettings();
  const faqTo = ["/orders", "/orders", "/orders", "/my-auctions", "/exhibitions", "/sell"];
  const faq: [string, string, string][] = faqTo.map((to, i) => [t(`faq.q${i + 1}`), fill(t(`faq.a${i + 1}`), { n: num(ps.return_days, ar) }), to]);

  return (
    <SiteShell>
      <PageTitle eyebrow={L("Company", "الشركة")} title={L("Support", "الدعم")} sub={L("Quick answers first — and a direct line to our team.", "إجابات سريعة أولًا، وخط مباشر مع فريقنا.")} />
      <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-2">
        <section aria-labelledby="faq-h">
          <h2 id="faq-h" className="font-display text-2xl">{t("faq.title")}</h2>
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
          {sent ? (
            <div role="status" className="mt-4 rounded-xl border border-success/60 bg-muted p-5 text-sm">
              <p className="font-medium text-success">{L("We received your request.", "استلمنا طلبك.")}</p>
              <p className="mt-2">{L("Your tracking number:", "رقم التتبع:")} <span className="font-mono text-lg font-semibold">{sent.ref}</span></p>
              <p className="mt-2 text-muted-foreground">{uid ? L("Follow it below under My requests — you'll also get a notification when we reply.", "تابعه أدناه في «طلباتي» — وسيصلك إشعار عند الرد.") : L("Keep this number. Check its status any time below with the number and your email.", "احتفظ بهذا الرقم، وتابع حالته في أي وقت أدناه بالرقم وبريدك.")}</p>
              <button type="button" onClick={() => setSent(null)} className="mt-3 rounded-full border border-border px-4 py-1.5">{L("Send another request", "أرسل طلبًا آخر")}</button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-4 space-y-3">
              {uid === null && (<>
                <p className="text-xs text-muted-foreground">{L("No account needed.", "لا يلزم حساب.")} <Link to="/auth" search={{ next: "/support" }} className="text-primary underline">{L("Sign in", "سجّل الدخول")}</Link> {L("to see all your requests in one place.", "لترى كل طلباتك في مكان واحد.")}</p>
                <label className="block text-sm">{L("Your name", "اسمك")}<input required minLength={2} maxLength={100} value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" /></label>
                <label className="block text-sm">{L("Email", "البريد الإلكتروني")}<input required type="email" maxLength={200} value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" /></label>
              </>)}
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
      <TrackRequest ar={ar} initial={sent && !uid ? sent : null} />
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
        <p className="font-medium">{t.subject} <span className="font-mono text-xs text-muted-foreground">{t.reference}</span></p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{(ar ? TOPIC_AR[t.topic] : t.topic)} · {status} · {new Date(t.created_at).toLocaleDateString(ar ? "ar-SA" : "en-GB")}</span>
      </div>
      <StatusSteps status={t.status} ar={ar} />
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

const STAGES = ["open", "answered", "closed"] as const;
function StatusSteps({ status, ar }: { status: string; ar: boolean }) {
  const L = (e: string, a: string) => (ar ? a : e);
  const names = [L("Received", "مستلم"), L("Answered", "تم الرد"), L("Closed", "مغلق")];
  const at = Math.max(0, STAGES.indexOf(status as never));
  return (
    <ol className="mt-3 flex gap-2 text-xs" aria-label={L("Request status", "حالة الطلب")}>
      {names.map((n, i) => <li key={n} aria-current={i === at ? "step" : undefined} className={`flex-1 rounded-full px-3 py-1 text-center ${i <= at ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{n}</li>)}
    </ol>
  );
}

type Tracked = { reference: string; topic: string; subject: string; status: string; reply: string | null; replied_at: string | null; created_at: string; updated_at: string };
function TrackRequest({ ar, initial }: { ar: boolean; initial: { ref: string; email: string } | null }) {
  const L = (e: string, a: string) => (ar ? a : e);
  const [q, setQ] = useState({ ref: "", email: "" });
  const [res, setRes] = useState<Tracked | null | "none">(null);
  const [busy, setBusy] = useState(false);
  async function look(ref: string, email: string) {
    setBusy(true);
    const { data } = await sb.rpc("track_support_request", { _reference: ref, _email: email });
    setBusy(false); setRes(data?.[0] ?? "none");
  }
  useEffect(() => { if (initial) { setQ(initial); void look(initial.ref, initial.email); } }, [initial?.ref]);
  return (
    <section aria-labelledby="track-h" className="mx-auto mt-12 max-w-6xl px-6">
      <h2 id="track-h" className="font-display text-2xl">{L("Track a request", "تتبّع طلبًا")}</h2>
      <form onSubmit={(e) => { e.preventDefault(); void look(q.ref, q.email); }} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">{L("Tracking number", "رقم التتبع")}<input required placeholder="SUP-XXXXXXXX" value={q.ref} onChange={(e) => setQ({ ...q, ref: e.target.value })} className="mt-1 block rounded-md border border-input bg-background px-3 py-2 font-mono" /></label>
        <label className="text-sm">{L("Email used", "البريد المستخدم")}<input required type="email" value={q.email} onChange={(e) => setQ({ ...q, email: e.target.value })} className="mt-1 block rounded-md border border-input bg-background px-3 py-2" /></label>
        <button disabled={busy} className="rounded-full bg-primary px-5 py-2 text-primary-foreground disabled:opacity-50">{L("Check status", "اعرض الحالة")}</button>
      </form>
      <div aria-live="polite">
        {res === "none" && <p className="mt-3 text-sm text-destructive">{L("No request matches that number and email.", "لا يوجد طلب بهذا الرقم والبريد.")}</p>}
        {res && res !== "none" && (
          <div className="mt-4 rounded-xl border border-border p-4 text-sm">
            <p className="font-medium">{res.subject} <span className="font-mono text-xs text-muted-foreground">{res.reference}</span></p>
            <p className="text-xs text-muted-foreground">{L("Sent", "أُرسل")} {new Date(res.created_at).toLocaleString(ar ? "ar-SA" : "en-GB")} · {L("Updated", "آخر تحديث")} {new Date(res.updated_at).toLocaleString(ar ? "ar-SA" : "en-GB")}</p>
            <StatusSteps status={res.status} ar={ar} />
            {res.reply ? <div className="mt-3 rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">{L("Arwiqa team", "فريق أروقة")}</p><p className="whitespace-pre-line">{res.reply}</p></div>
              : <p className="mt-3 text-muted-foreground">{L("Our team usually replies within 1–2 working days.", "يرد فريقنا عادةً خلال يوم إلى يومي عمل.")}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
