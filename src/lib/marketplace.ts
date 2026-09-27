import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "./auth";
import { actions, useStore, type CartItem } from "./store";

/**
 * Keeps the browser cart/favorites in sync with the signed-in account.
 * Guests keep a local basket; on sign-in it is merged into the account, then the account copy wins.
 */
export function AccountSync() {
  const { user } = useSession();
  const s = useStore();
  const ready = useRef<string | null>(null);
  const last = useRef<{ cart: string; fav: string }>({ cart: "", fav: "" });

  // Merge local → account once per sign-in, then load account data.
  useEffect(() => {
    if (!user) { ready.current = null; return; }
    let cancelled = false;
    (async () => {
      await supabase.rpc("close_expired_blocks");
      const local = actions.get();
      if (local.cart.length) await supabase.from("cart_items").upsert(local.cart.map((i) => ({ user_id: user.id, key: i.key, item: i as never })));
      if (local.favorites.length) await supabase.from("favorites").upsert(local.favorites.map((id) => ({ user_id: user.id, listing_id: id })), { ignoreDuplicates: true });
      const [c, f] = await Promise.all([supabase.from("cart_items").select("item"), supabase.from("favorites").select("listing_id")]);
      if (cancelled) return;
      const cart = (c.data ?? []).map((r) => r.item as unknown as CartItem);
      const fav = (f.data ?? []).map((r) => r.listing_id);
      actions.replaceAccountData(cart, fav);
      last.current = { cart: JSON.stringify(cart), fav: JSON.stringify(fav) };
      ready.current = user.id;
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Push local changes to the account.
  useEffect(() => {
    if (!user || ready.current !== user.id) return;
    const cart = JSON.stringify(s.cart), fav = JSON.stringify(s.favorites);
    if (cart !== last.current.cart) {
      const prev: CartItem[] = JSON.parse(last.current.cart || "[]");
      const gone = prev.filter((p) => !s.cart.some((x) => x.key === p.key)).map((p) => p.key);
      if (gone.length) void supabase.from("cart_items").delete().in("key", gone);
      if (s.cart.length) void supabase.from("cart_items").upsert(s.cart.map((i) => ({ user_id: user.id, key: i.key, item: i as never, updated_at: new Date().toISOString() })));
    }
    if (fav !== last.current.fav) {
      const prev: string[] = JSON.parse(last.current.fav || "[]");
      const gone = prev.filter((p) => !s.favorites.includes(p));
      const added = s.favorites.filter((p) => !prev.includes(p));
      if (gone.length) void supabase.from("favorites").delete().in("listing_id", gone);
      if (added.length) void supabase.from("favorites").upsert(added.map((id) => ({ user_id: user.id, listing_id: id })), { ignoreDuplicates: true });
    }
    last.current = { cart, fav };
  }, [s.cart, s.favorites, user?.id]);
  return null;
}

export type AgentAuth = { id: string; agent_name: string; agent_name_ar: string; agency: string; agency_ar: string; license_no: string; valid_from: string; valid_until: string; scope: string[]; owner_approved_at: string | null; revoked_at: string | null };

/** Latest agent authorization for a listing plus whether it's currently valid. */
export function useListingAgent(listingId: string) {
  return useQuery({
    queryKey: ["agent", listingId],
    queryFn: async () => {
      const { data } = await supabase.from("listing_agents").select("*").eq("listing_id", listingId).is("revoked_at", null).order("created_at", { ascending: false }).limit(1);
      const a = (data?.[0] ?? null) as AgentAuth | null;
      if (!a) return null;
      const today = new Date().toISOString().slice(0, 10);
      return { ...a, valid: !!a.owner_approved_at && a.valid_from <= today && today <= a.valid_until };
    },
  });
}

export function useSendOffer(listingId: string) {
  return useMutation({
    mutationFn: async ({ amount, message }: { amount: number; message: string }) => {
      const { error } = await supabase.from("offers").insert({ listing_id: listingId, amount, message: message.slice(0, 1000) });
      if (error) throw error;
    },
  });
}
export function useSendInquiry(listingId: string) {
  return useMutation({
    mutationFn: async (message: string) => {
      const { error } = await supabase.from("inquiries").insert({ listing_id: listingId, message: message.slice(0, 2000) });
      if (error) throw error;
    },
  });
}
/** Buyer's own offers and questions on this listing (with seller replies). */
export function useMyListingActivity(listingId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["my-activity", listingId],
    enabled,
    queryFn: async () => {
      const [o, q] = await Promise.all([
        supabase.from("offers").select("id, amount, status, response, created_at").eq("listing_id", listingId).order("created_at", { ascending: false }),
        supabase.from("inquiries").select("id, message, reply, created_at").eq("listing_id", listingId).order("created_at", { ascending: false }),
      ]);
      return { offers: o.data ?? [], inquiries: q.data ?? [] };
    },
  });
}

export type Review = { id: string; user_id: string; author_name: string; rating: number; body: string; verified: boolean; helpful_count: number; owner_reply: string | null; replied_at: string | null; created_at: string; edited_at: string | null; status: string };
export const EDIT_HOURS = 48;
export const DELETE_DAYS = 7;

export function summarize(rs: Review[]) {
  const visible = rs.filter((r) => r.status === "visible");
  const dist = [5, 4, 3, 2, 1].map((n) => ({ stars: n, count: visible.filter((r) => r.rating === n).length }));
  const avg = visible.length ? visible.reduce((s, r) => s + r.rating, 0) / visible.length : 0;
  return { avg, total: visible.length, dist, verified: visible.filter((r) => r.verified).length };
}

export type ReviewFilter = { stars: number | null; verified: boolean; sort: "helpful" | "newest" | "oldest" | "highest" | "lowest" };
export function filterReviews(rs: Review[], f: ReviewFilter) {
  const out = rs.filter((r) => (f.stars ? r.rating === f.stars : true) && (f.verified ? r.verified : true));
  const by: Record<ReviewFilter["sort"], (a: Review, b: Review) => number> = {
    helpful: (a, b) => b.helpful_count - a.helpful_count || b.created_at.localeCompare(a.created_at),
    newest: (a, b) => b.created_at.localeCompare(a.created_at),
    oldest: (a, b) => a.created_at.localeCompare(b.created_at),
    highest: (a, b) => b.rating - a.rating,
    lowest: (a, b) => a.rating - b.rating,
  };
  return [...out].sort(by[f.sort]);
}

export function useReviews(listingId: string) {
  const { user } = useSession();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["reviews", listingId, user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("reviews").select("id, user_id, author_name, rating, body, verified, helpful_count, owner_reply, replied_at, created_at, edited_at, status").eq("listing_id", listingId).neq("status", "deleted");
      const votes = user ? (await supabase.from("review_votes").select("review_id")).data ?? [] : [];
      const canReview = user ? !!(await supabase.rpc("can_review", { _listing: listingId })).data : false;
      const { data: l } = await supabase.from("listings").select("owner_user_id, owner_can_reply").eq("id", listingId).maybeSingle();
      return { reviews: (data ?? []) as Review[], voted: new Set(votes.map((v) => v.review_id)), canReview, isOwner: !!user && l?.owner_user_id === user.id, ownerCanReply: l?.owner_can_reply ?? true };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["reviews", listingId] });
  const run = (fn: () => PromiseLike<{ error: { message: string } | null }>) => async () => { const { error } = await fn(); if (error) throw new Error(error.message); refresh(); };
  return {
    ...q, user,
    post: (rating: number, body: string, name: string) => run(() => supabase.from("reviews").insert({ listing_id: listingId, rating, body: body.slice(0, 2000), author_name: name }))(),
    edit: (id: string, rating: number, body: string) => run(() => supabase.rpc("edit_my_review", { _review: id, _rating: rating, _body: body }))(),
    remove: (id: string) => run(() => supabase.rpc("delete_my_review", { _review: id }))(),
    vote: (id: string, on: boolean) => run(() => on ? supabase.from("review_votes").insert({ review_id: id }) : supabase.from("review_votes").delete().eq("review_id", id))(),
    report: (id: string, reason: string) => run(() => supabase.from("review_reports").insert({ review_id: id, reason }))(),
    reply: (id: string, text: string) => run(() => supabase.rpc("reply_to_review", { _review: id, _reply: text }))(),
  };
}

/** Maps database rule codes to buyer-friendly bilingual messages. */
export const RULE_MSG: Record<string, [string, string]> = {
  REVIEW_NOT_ELIGIBLE: ["Only buyers who purchased this work can review it.", "التقييم متاح فقط لمن اشترى هذا العمل."],
  REVIEW_RATE_LIMIT: ["You've posted several reviews today — try again tomorrow.", "نشرت عدة تقييمات اليوم — حاول غدًا."],
  REVIEW_DUPLICATE: ["You already posted this same text.", "سبق أن نشرت النص نفسه."],
  REVIEW_SPAM: ["Please remove the links from your review.", "يرجى إزالة الروابط من تقييمك."],
  EDIT_WINDOW_CLOSED: ["Reviews can be edited for 48 hours after posting.", "يمكن تعديل التقييم خلال ٤٨ ساعة من نشره."],
  DELETE_WINDOW_CLOSED: ["Reviews can be deleted for 7 days after posting.", "يمكن حذف التقييم خلال ٧ أيام من نشره."],
  REPLY_NOT_ALLOWED: ["Replies are turned off for this seller.", "الرد غير مفعّل لهذا البائع."],
  BLOCKED: ["Your account is suspended.", "حسابك موقوف."],
  duplicate: ["You already did this.", "قمت بذلك مسبقًا."],
  "row-level security": ["Your account can't do this right now.", "لا يمكن لحسابك القيام بذلك الآن."],
};
export function ruleMessage(err: unknown, ar: boolean) {
  const m = err instanceof Error ? err.message : String(err);
  const k = Object.keys(RULE_MSG).find((x) => m.includes(x));
  return k ? RULE_MSG[k]![ar ? 1 : 0] : ar ? "تعذّر الإرسال" : "Something went wrong";
}
