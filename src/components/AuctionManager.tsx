import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gavel, Lock, Globe, Mail, X, Trophy, History, Ban, SkipForward, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { seedListings, fmt } from "@/lib/data";
import { useLocale } from "@/lib/i18n";

// Typed loosely: new RPCs/tables may not be in generated types yet.
const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a?: object) => Promise<{ data: any; error: { message: string } | null }> };

export type AuctionRow = { id: string; listing_id: string; start_bid: number; reserve: number; increment: number; starts_at: string; ends_at: string; status: string; visibility: string; owner_user_id: string | null; winner_user_id: string | null; winning_amount: number | null; pay_by: string | null; order_id: string | null };

export const STATUS_LABEL: Record<string, [string, string]> = {
  scheduled: ["Scheduled", "مجدول"], live: ["Live", "مباشر"], ended: ["Ended", "انتهى"], awaiting_payment: ["Awaiting winner payment", "بانتظار دفع الفائز"],
  sold: ["Sold", "مُباع"], unsold: ["Unsold", "لم يُبع"], cancelled: ["Cancelled", "ملغى"],
};
const EVENT_LABEL: Record<string, [string, string]> = {
  created: ["Auction created", "أُنشئ المزاد"], updated: ["Settings changed", "عُدّلت الإعدادات"], invited: ["Invitation sent", "أُرسلت دعوة"], invite_revoked: ["Invitation revoked", "أُلغيت دعوة"],
  invite_accepted: ["Invitation accepted", "قُبلت الدعوة"], invite_declined: ["Invitation declined", "رُفضت الدعوة"], bid: ["Bid placed", "مزايدة"], closed: ["Bidding closed", "أُغلقت المزايدة"],
  winner: ["Winner offered the lot", "عُرض العمل على الفائز"], passed: ["Passed to next bidder", "انتقل إلى المزايد التالي"], sold: ["Paid — sold", "دُفع — بيع"], unsold: ["Closed unsold", "انتهى دون بيع"], cancelled: ["Auction cancelled", "أُلغي المزاد"],
};

export const titleOf = (listingId: string, ar: boolean) => { const l = seedListings.find((x) => x.id === listingId); return l ? (ar ? l.titleAr ?? l.title : l.title) : listingId; };

export function StatusPill({ status }: { status: string }) {
  const { locale } = useLocale();
  const tone = status === "live" ? "bg-live/15 text-live" : status === "sold" ? "bg-success/15 text-success" : status === "awaiting_payment" ? "bg-warning/15 text-warning" : status === "cancelled" || status === "unsold" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary";
  const l = STATUS_LABEL[status] ?? [status, status];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>{locale === "ar" ? l[1] : l[0]}</span>;
}

const errText = (m: string, ar: boolean) => {
  const map: Record<string, [string, string]> = {
    NOT_ALLOWED: ["You can't manage this auction.", "لا يمكنك إدارة هذا المزاد."], LISTING_NOT_FOUND: ["Artwork not found.", "العمل غير موجود."],
    BAD_DATES: ["The end must be after the start and in the future.", "يجب أن تكون النهاية بعد البداية وفي المستقبل."], BAD_AMOUNTS: ["Check the amounts.", "تحقق من المبالغ."],
    AUCTION_ALREADY_OPEN: ["This artwork already has an open auction.", "لهذا العمل مزاد مفتوح بالفعل."], AUCTION_CLOSED: ["This auction is already closed.", "هذا المزاد مغلق."],
    BAD_EMAIL: ["Enter a valid email.", "أدخل بريدًا صحيحًا."], NOT_AWAITING_PAYMENT: ["No winner is waiting to pay.", "لا يوجد فائز بانتظار الدفع."], BAD_INPUT: ["Check the values.", "تحقق من القيم."],
  };
  const k = Object.keys(map).find((x) => m.includes(x));
  return k ? map[k]![ar ? 1 : 0] : ar ? "تعذّر تنفيذ العملية." : "Couldn't complete that.";
};

/** Create form: staff pick any artwork; owners get their own listings. */
export function CreateAuctionForm({ listingIds, onCreated }: { listingIds: string[]; onCreated?: () => void }) {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const qc = useQueryClient();
  const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [f, setF] = useState({ listing: listingIds[0] ?? "", start: "500", reserve: "1000", increment: "50", starts: local(new Date()), ends: local(new Date(Date.now() + 3 * 86400000)), visibility: "open" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true);
    const { error } = await db.rpc("create_auction", { _listing: f.listing, _start: Number(f.start), _reserve: Number(f.reserve), _increment: Number(f.increment), _starts: new Date(f.starts).toISOString(), _ends: new Date(f.ends).toISOString(), _visibility: f.visibility });
    setBusy(false);
    if (error) { toast.error(errText(error.message, ar)); return; }
    toast.success(L("Auction created", "أُنشئ المزاد"));
    qc.invalidateQueries({ queryKey: ["manage-auctions"] }); qc.invalidateQueries({ queryKey: ["auctions"] }); onCreated?.();
  }
  const field = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2";
  if (!listingIds.length) return <p className="text-sm text-muted-foreground">{L("You have no artworks to auction yet.", "لا توجد لديك أعمال لطرحها في مزاد.")}</p>;
  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm sm:col-span-2">{L("Artwork", "العمل")}
        <select value={f.listing} onChange={set("listing")} className={field}>{listingIds.map((id) => <option key={id} value={id}>{titleOf(id, ar)}</option>)}</select></label>
      <label className="text-sm">{L("Starting bid ($)", "المزايدة الافتتاحية ($)")}<input type="number" min={1} value={f.start} onChange={set("start")} className={field} required /></label>
      <label className="text-sm">{L("Reserve ($)", "السعر الأدنى ($)")}<input type="number" min={0} value={f.reserve} onChange={set("reserve")} className={field} required /></label>
      <label className="text-sm">{L("Bid increment ($)", "الحد الأدنى للزيادة ($)")}<input type="number" min={1} value={f.increment} onChange={set("increment")} className={field} required /></label>
      <label className="text-sm">{L("Opens", "يفتح")}<input type="datetime-local" value={f.starts} onChange={set("starts")} className={field} required /></label>
      <label className="text-sm">{L("Closes", "يغلق")}<input type="datetime-local" value={f.ends} onChange={set("ends")} className={field} required /></label>
      <fieldset className="text-sm"><legend>{L("Who can bid", "من يمكنه المزايدة")}</legend>
        <div className="mt-1 flex gap-2">
          {(["open", "invite"] as const).map((v) => (
            <label key={v} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 ${f.visibility === v ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>
              <input type="radio" name="vis" className="sr-only" checked={f.visibility === v} onChange={() => setF({ ...f, visibility: v })} />
              {v === "open" ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}{v === "open" ? L("Open", "مفتوح") : L("Invite-only", "بالدعوة")}
            </label>))}
        </div></fieldset>
      <div className="flex items-end sm:col-span-2 lg:col-span-4">
        <button disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-primary-foreground disabled:opacity-50"><Gavel className="h-4 w-4" />{busy ? L("Creating…", "جارٍ الإنشاء…") : L("Create auction", "إنشاء مزاد")}</button>
      </div>
    </form>
  );
}

/** Full management panel for one auction: settings, invites, bids, winner, log. */
export function AuctionPanel({ a }: { a: AuctionRow }) {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, x: string) => (ar ? x : e);
  const qc = useQueryClient();
  const [email, setEmail] = useState(""); const [busy, setBusy] = useState<string | null>(null);
  const open = a.status === "scheduled" || a.status === "live";
  const detail = useQuery({
    queryKey: ["manage-auction", a.id],
    queryFn: async () => {
      const [inv, ev, bids] = await Promise.all([
        db.from("auction_invites").select("*").eq("auction_id", a.id).order("created_at", { ascending: false }),
        db.from("auction_events").select("*").eq("auction_id", a.id).order("created_at", { ascending: false }).limit(200),
        db.from("bids").select("id, bidder_name, amount, created_at, user_id").eq("auction_id", a.id).order("amount", { ascending: false }),
      ]);
      return { invites: (inv.data ?? []) as any[], events: (ev.data ?? []) as any[], bids: (bids.data ?? []) as any[] };
    },
  });
  async function act(key: string, fn: string, args: object, ok: string) {
    if (busy) return; setBusy(key);
    const { error } = await db.rpc(fn, args); setBusy(null);
    if (error) { toast.error(errText(error.message, ar)); return; }
    toast.success(ok);
    qc.invalidateQueries({ queryKey: ["manage-auction", a.id] }); qc.invalidateQueries({ queryKey: ["manage-auctions"] }); qc.invalidateQueries({ queryKey: ["auctions"] });
  }
  const when = (t: string | null) => (t ? new Date(t).toLocaleString(ar ? "ar-SA" : "en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—");
  const d = detail.data;
  const pill = "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm disabled:opacity-50";

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {[[L("Starting bid", "الافتتاح"), fmt(a.start_bid)], [L("Reserve", "السعر الأدنى"), fmt(a.reserve)], [L("Increment", "الزيادة"), fmt(a.increment)], [L("Access", "الوصول"), a.visibility === "invite" ? L("Invite-only", "بالدعوة") : L("Open", "مفتوح")],
          [L("Opens", "يفتح"), when(a.starts_at)], [L("Closes", "يغلق"), when(a.ends_at)], [L("Winner pays by", "مهلة دفع الفائز"), when(a.pay_by)], [L("Winning bid", "العرض الفائز"), a.winning_amount ? fmt(Number(a.winning_amount)) : "—"]].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-muted/50 p-3"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-0.5 font-medium">{v}</dd></div>))}
      </dl>

      <div className="flex flex-wrap gap-2">
        <Link to="/auctions/$id" params={{ id: a.id }} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm"><Gavel className="h-4 w-4" />{L("Open public page", "فتح صفحة المزاد")}</Link>
        {open && <button disabled={!!busy} onClick={() => act("close", "close_auction", { _auction: a.id }, L("Bidding closed", "أُغلقت المزايدة"))} className={`${pill} border-border`}><Square className="h-4 w-4" />{L("Close now & pick winner", "أغلق الآن واختر الفائز")}</button>}
        {open && <button disabled={!!busy} onClick={() => act("vis", "update_auction", { _auction: a.id, _reserve: a.reserve, _increment: a.increment, _ends: a.ends_at, _visibility: a.visibility === "open" ? "invite" : "open" }, L("Access updated", "تم تحديث الوصول"))} className={`${pill} border-border`}>{a.visibility === "open" ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}{a.visibility === "open" ? L("Make invite-only", "اجعله بالدعوة") : L("Open to everyone", "افتحه للجميع")}</button>}
        {a.status === "awaiting_payment" && <button disabled={!!busy} onClick={() => act("pass", "pass_auction_to_next", { _auction: a.id }, L("Passed to next bidder", "انتقل إلى المزايد التالي"))} className={`${pill} border-warning text-warning`}><SkipForward className="h-4 w-4" />{L("Winner didn't pay — offer next bidder", "لم يدفع الفائز — اعرض على التالي")}</button>}
        {a.order_id && <Link to="/admin/orders" className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm"><Trophy className="h-4 w-4" />{L("Winner's order", "طلب الفائز")}</Link>}
        {a.status !== "sold" && a.status !== "cancelled" && <button disabled={!!busy} onClick={() => { const r = window.prompt(L("Reason for cancelling (shown to bidders)", "سبب الإلغاء (يظهر للمزايدين)")); if (r !== null) act("cancel", "cancel_auction", { _auction: a.id, _reason: r }, L("Auction cancelled", "أُلغي المزاد")); }} className={`${pill} border-destructive text-destructive`}><Ban className="h-4 w-4" />{L("Cancel auction", "إلغاء المزاد")}</button>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-labelledby={`inv-${a.id}`} className="rounded-2xl border border-border p-4">
          <h3 id={`inv-${a.id}`} className="flex items-center gap-2 font-medium"><Mail className="h-4 w-4" />{L("Invitees", "المدعوون")} ({d?.invites.length ?? 0})</h3>
          <form onSubmit={(e) => { e.preventDefault(); act("inv", "invite_to_auction", { _auction: a.id, _email: email }, L("Invitation sent", "أُرسلت الدعوة")).then(() => setEmail("")); }} className="mt-3 flex gap-2">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" aria-label={L("Invitee email", "بريد المدعو")} className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm" />
            <button disabled={!!busy} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">{L("Invite", "دعوة")}</button>
          </form>
          {a.visibility === "open" && <p className="mt-2 text-xs text-muted-foreground">{L("This auction is open, so anyone signed in can bid. Invitations still notify people.", "المزاد مفتوح، لذا يمكن لأي مستخدم المزايدة. الدعوات تنبّه الأشخاص فقط.")}</p>}
          <ul className="mt-3 space-y-2 text-sm">
            {d?.invites.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2">
                <span className="truncate" dir="ltr">{i.email}</span>
                <span className="flex items-center gap-2"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{i.status === "accepted" ? L("Accepted", "قبل") : i.status === "declined" ? L("Declined", "رفض") : L("Invited", "مدعو")}</span>
                  <button onClick={() => act(`rv-${i.id}`, "revoke_auction_invite", { _invite: i.id }, L("Invitation revoked", "أُلغيت الدعوة"))} aria-label={L("Revoke", "إلغاء")} className="rounded-full p-1 hover:bg-muted"><X className="h-4 w-4" /></button></span>
              </li>))}
          </ul>
        </section>

        <section aria-labelledby={`bids-${a.id}`} className="rounded-2xl border border-border p-4">
          <h3 id={`bids-${a.id}`} className="flex items-center gap-2 font-medium"><Gavel className="h-4 w-4" />{L("Offers (highest first)", "العروض (الأعلى أولًا)")} ({d?.bids.length ?? 0})</h3>
          <ol className="mt-3 space-y-2 text-sm">
            {d?.bids.map((b, i) => (
              <li key={b.id} className={`flex justify-between gap-2 rounded-lg px-2 py-1 ${b.user_id && b.user_id === a.winner_user_id ? "bg-success/10" : ""}`}>
                <span>{i + 1}. {b.bidder_name}{b.user_id && b.user_id === a.winner_user_id && <Trophy className="ms-1 inline h-3.5 w-3.5 text-success" aria-label={L("Winner", "الفائز")} />}</span>
                <span className="font-medium">{fmt(Number(b.amount))}{Number(b.amount) < Number(a.reserve) && <span className="ms-1 text-xs text-muted-foreground">({L("below reserve", "أقل من الأدنى")})</span>}</span>
              </li>))}
            {d && !d.bids.length && <li className="text-muted-foreground">{L("No offers yet.", "لا توجد عروض بعد.")}</li>}
          </ol>
        </section>

        <section aria-labelledby={`log-${a.id}`} className="rounded-2xl border border-border p-4">
          <h3 id={`log-${a.id}`} className="flex items-center gap-2 font-medium"><History className="h-4 w-4" />{L("Transaction log", "سجل العمليات")}</h3>
          <ol className="mt-3 max-h-80 space-y-2 overflow-auto text-sm">
            {d?.events.map((e) => { const l = EVENT_LABEL[e.kind] ?? [e.kind, e.kind]; return (
              <li key={e.id} className="border-s-2 border-primary/30 ps-3">
                <p className="font-medium">{ar ? l[1] : l[0]}{e.amount != null && ` · ${fmt(Number(e.amount))}`}</p>
                <p className="text-xs text-muted-foreground">{when(e.created_at)}{e.details?.bidder ? ` · ${e.details.bidder}` : ""}{e.details?.email ? ` · ${e.details.email}` : ""}{e.details?.reason ? ` · ${e.details.reason === "payment_deadline" ? L("payment deadline passed", "انتهت مهلة الدفع") : e.details.reason}` : ""}</p>
              </li>); })}
            {d && !d.events.length && <li className="text-muted-foreground">{L("Nothing logged yet.", "لا يوجد سجل بعد.")}</li>}
          </ol>
        </section>
      </div>
    </div>
  );
}

/** List of auctions with expandable panels and status filter. */
export function AuctionList({ rows }: { rows: AuctionRow[] }) {
  const { locale } = useLocale(); const ar = locale === "ar";
  const [filter, setFilter] = useState("all"); const [openId, setOpenId] = useState<string | null>(null);
  const shown = filter === "all" ? rows : rows.filter((r) => r.status === filter);
  return (
    <div className="space-y-4">
      <div role="group" aria-label={ar ? "تصفية حسب الحالة" : "Filter by status"} className="flex flex-wrap gap-2">
        {["all", ...Object.keys(STATUS_LABEL)].map((s) => (
          <button key={s} aria-pressed={filter === s} onClick={() => setFilter(s)} className={`rounded-md border px-3 py-1.5 text-sm ${filter === s ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
            {s === "all" ? (ar ? "الكل" : "All") : (ar ? STATUS_LABEL[s]![1] : STATUS_LABEL[s]![0])} ({s === "all" ? rows.length : rows.filter((r) => r.status === s).length})
          </button>))}
      </div>
      <ul className="space-y-3">
        {shown.map((a) => (
          <li key={a.id} className="rounded-2xl border border-border bg-card">
            <button aria-expanded={openId === a.id} onClick={() => setOpenId(openId === a.id ? null : a.id)} className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-start">
              <span className="flex items-center gap-2 font-medium">{a.visibility === "invite" ? <Lock className="h-4 w-4 text-muted-foreground" /> : <Globe className="h-4 w-4 text-muted-foreground" />}{titleOf(a.listing_id, ar)}</span>
              <span className="flex items-center gap-3 text-sm text-muted-foreground"><StatusPill status={a.status} /> {new Date(a.ends_at).toLocaleDateString(ar ? "ar-SA" : "en-GB")}</span>
            </button>
            {openId === a.id && <div className="border-t border-border p-4"><AuctionPanel a={a} /></div>}
          </li>))}
        {!shown.length && <li className="text-sm text-muted-foreground">{ar ? "لا توجد مزادات." : "No auctions."}</li>}
      </ul>
    </div>
  );
}

export const auctionsDb = db;
