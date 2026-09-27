import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Heart, Share2, MessageCircle, HandCoins, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocale } from "@/lib/i18n";
import { useSession } from "@/lib/auth";
import { actions, useStore } from "@/lib/store";
import { fmt } from "@/lib/data";
import { ruleMessage, useMyListingActivity, useSendInquiry, useSendOffer } from "@/lib/marketplace";

type Props = { listingId: string; title: string; price: number | null; disabled: boolean; blockedReason?: string; onAdd: () => boolean };

/** Buy / basket / favorite / share / ask / offer — each a complete journey. */
export function ArtworkActions({ listingId, title, price, disabled, blockedReason, onAdd }: Props) {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const L = (en: string, a: string) => (ar ? a : en);
  const { user } = useSession();
  const { favorites } = useStore();
  const fav = favorites.includes(listingId);
  const navigate = useNavigate();
  const [open, setOpen] = useState<null | "share" | "ask" | "offer">(null);
  const [msg, setMsg] = useState("");
  const [amount, setAmount] = useState("");
  const offer = useSendOffer(listingId);
  const ask = useSendInquiry(listingId);
  const mine = useMyListingActivity(listingId, !!user);
  const url = typeof window !== "undefined" ? window.location.href : "";
  const minOffer = price ? Math.ceil(price * 0.5) : 1;
  const needSignIn = () => { toast.info(L("Sign in to continue", "سجّل الدخول للمتابعة")); navigate({ to: "/auth", search: { next: `/artwork/${listingId}` } as never }); };
  const btn = "inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";
  const field = "w-full rounded-sm border border-border bg-background px-3 py-2";

  return (
    <>
      {blockedReason && <p role="alert" className="mt-4 rounded-sm border border-destructive p-3 text-sm text-destructive">{blockedReason}</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button disabled={disabled} onClick={() => { if (onAdd()) navigate({ to: "/checkout" }); }} className="rounded-full bg-primary py-4 text-primary-foreground transition hover:opacity-90 disabled:opacity-50">{L("Buy now", "اشترِ الآن")}</button>
        <button disabled={disabled} onClick={() => { if (onAdd()) toast.success(L("Added to your basket", "أُضيف إلى السلة"), { action: { label: L("View basket", "عرض السلة"), onClick: () => navigate({ to: "/checkout" }) } }); }}
          className="rounded-full border border-foreground py-4 transition hover:bg-foreground hover:text-background disabled:opacity-50">{L("Add to basket", "أضف إلى السلة")}</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <button aria-pressed={fav} onClick={() => { actions.toggleFavorite(listingId); toast.success(fav ? L("Removed from favorites", "أُزيل من المفضلة") : L("Saved to favorites", "حُفظ في المفضلة"), fav ? undefined : { action: { label: L("View", "عرض"), onClick: () => navigate({ to: "/favorites" }) } }); }} className={btn}>
          <Heart aria-hidden className={`h-4 w-4 ${fav ? "fill-primary text-primary" : ""}`} />{fav ? L("In favorites", "في المفضلة") : L("Add to favorites", "أضف إلى المفضلة")}
        </button>
        <button onClick={() => setOpen("share")} className={btn}><Share2 aria-hidden className="h-4 w-4" />{L("Share", "مشاركة")}</button>
        <button onClick={() => (user ? setOpen("ask") : needSignIn())} className={btn}><MessageCircle aria-hidden className="h-4 w-4" />{L("Ask the seller", "اسأل البائع")}</button>
        {price !== null && <button onClick={() => (user ? setOpen("offer") : needSignIn())} className={btn}><HandCoins aria-hidden className="h-4 w-4" />{L("Make an offer", "قدّم عرضًا")}</button>}
      </div>

      {user && ((mine.data?.offers.length ?? 0) > 0 || (mine.data?.inquiries.length ?? 0) > 0) && (
        <div className="mt-4 rounded-sm bg-muted p-4 text-sm">
          <p className="font-medium">{L("Your activity on this work", "نشاطك على هذا العمل")}</p>
          <ul className="mt-2 grid gap-2">
            {mine.data!.offers.map((o) => <li key={o.id}>{L("Offer", "عرض")} {fmt(Number(o.amount))} · <strong>{L(o.status, ({ pending: "قيد المراجعة", accepted: "مقبول", declined: "مرفوض", withdrawn: "مسحوب" } as Record<string, string>)[o.status] ?? o.status)}</strong>{o.response ? ` — ${o.response}` : ""}</li>)}
            {mine.data!.inquiries.map((q) => <li key={q.id}>{L("Question", "سؤال")}: “{q.message}” — {q.reply ? <span>{L("Reply", "الرد")}: {q.reply}</span> : <em>{L("awaiting reply", "بانتظار الرد")}</em>}</li>)}
          </ul>
        </div>
      )}

      <Dialog open={open === "share"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{L("Share this work", "شارك هذا العمل")}</DialogTitle><DialogDescription>{title}</DialogDescription></DialogHeader>
          <div className="flex gap-2"><input readOnly value={url} aria-label={L("Link", "الرابط")} className={field} dir="ltr" />
            <button onClick={async () => { await navigator.clipboard.writeText(url); toast.success(L("Link copied", "نُسخ الرابط")); }} className={btn}><Copy aria-hidden className="h-4 w-4" />{L("Copy", "نسخ")}</button></div>
          <div className="flex flex-wrap gap-2 text-sm">
            <a className={btn} target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`}>WhatsApp</a>
            <a className={btn} target="_blank" rel="noreferrer" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`}>X</a>
            <a className={btn} href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`}>{L("Email", "البريد")}</a>
            {typeof navigator !== "undefined" && "share" in navigator && <button className={btn} onClick={() => navigator.share({ title, url }).catch(() => {})}>{L("More…", "المزيد…")}</button>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "ask"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{L("Ask the seller", "اسأل البائع")}</DialogTitle><DialogDescription>{L("The seller and our team are notified; replies appear on this page and in your notifications.", "يُبلَّغ البائع وفريقنا، وتظهر الردود هنا وفي إشعاراتك.")}</DialogDescription></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (msg.trim().length < 2) return;
            ask.mutate(msg.trim(), { onSuccess: () => { toast.success(L("Question sent", "أُرسل سؤالك")); setMsg(""); setOpen(null); void mine.refetch(); }, onError: (er) => toast.error(ruleMessage(er, ar)) }); }}>
            <label htmlFor="ask-msg" className="text-sm">{L("Your question", "سؤالك")}</label>
            <textarea id="ask-msg" required minLength={2} maxLength={2000} rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} className={`${field} mt-1`} />
            <button disabled={ask.isPending} className="mt-3 rounded-full bg-primary px-5 py-2 text-primary-foreground disabled:opacity-50">{L("Send", "إرسال")}</button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "offer"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{L("Make an offer", "قدّم عرضًا")}</DialogTitle>
            <DialogDescription>{L(`Listed at ${fmt(price ?? 0)}. Offers from ${fmt(minOffer)}. The seller can accept or decline — you'll be notified.`, `السعر ${fmt(price ?? 0)}. العروض من ${fmt(minOffer)}. يمكن للبائع القبول أو الرفض وستصلك إشعارات.`)}</DialogDescription></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); const n = Number(amount);
            if (!Number.isFinite(n) || n < minOffer || (price && n >= price)) { toast.error(L(`Enter an amount between ${fmt(minOffer)} and ${fmt((price ?? 0) - 1)}`, `أدخل مبلغًا بين ${fmt(minOffer)} و${fmt((price ?? 0) - 1)}`)); return; }
            offer.mutate({ amount: n, message: msg.trim() }, { onSuccess: () => { toast.success(L("Offer sent", "أُرسل العرض")); setAmount(""); setMsg(""); setOpen(null); void mine.refetch(); }, onError: (er) => toast.error(ruleMessage(er, ar)) }); }}>
            <label htmlFor="offer-amt" className="text-sm">{L("Your offer (USD)", "عرضك (دولار)")}</label>
            <input id="offer-amt" type="number" inputMode="decimal" min={minOffer} max={price ? price - 1 : undefined} required value={amount} onChange={(e) => setAmount(e.target.value)} className={`${field} mt-1`} dir="ltr" />
            <label htmlFor="offer-msg" className="mt-3 block text-sm">{L("Message (optional)", "رسالة (اختياري)")}</label>
            <textarea id="offer-msg" maxLength={1000} rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} className={`${field} mt-1`} />
            <p className="mt-2 text-xs text-muted-foreground">{L("If the seller accepts, you'll be notified here and in your notifications to complete the purchase.", "إذا قبل البائع ستصلك إشعارات هنا لإتمام الشراء.")}</p>
            <button disabled={offer.isPending} className="mt-3 rounded-full bg-primary px-5 py-2 text-primary-foreground disabled:opacity-50">{L("Send offer", "إرسال العرض")}</button>
          </form>
        </DialogContent>
      </Dialog>
      {!user && <p className="mt-2 text-xs text-muted-foreground">{L("Your basket and favorites are saved on this device; ", "تُحفظ سلتك ومفضلتك على هذا الجهاز؛ ")}<Link to="/auth" className="underline">{L("sign in", "سجّل الدخول")}</Link>{L(" to keep them in your account.", " لحفظها في حسابك.")}</p>}
    </>
  );
}
