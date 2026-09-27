<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Translations live in `src/lib/i18n.tsx` (`useLocale().t/pick`); data carries `*Ar` fields; `<html dir/lang>` is set by SiteShell. Why: one switch flips the whole app to Arabic RTL.
- Use logical Tailwind utilities (ms-/me-/ps-/start-/end-/text-end), never left/right. Why: layouts must mirror in RTL.
- Listing pricing comes from `variants` (original/print/license); `price` is the minimum. Why: one artwork sells in many forms.
- Marketplace data (assets, auctions/bids, exhibitions/bookings, orders, tickets, refunds, notifications) lives in Lovable Cloud; business rules are enforced by DB triggers/RPCs (validate_bid, validate_booking, admin_set_order_status, check_in_ticket, admin_decide_refund). Why: rules must hold regardless of client.
- Orders are priced server-side in `placeOrder` (src/lib/orders.functions.ts) via `priceCart`. Why: clients can't tamper with totals.
- Staff = admin or moderator role (`is_staff`); staff UI lives under `/_authenticated/admin/*`. Why: one role check for ops screens.
- Realtime bids use one shared channel via BidsLiveProvider in __root; components read the query cache. Why: one channel per card caused the after-subscribe crash.
- Saved-search emails: per-search `email_frequency` (off/instant/daily/weekly), global `notification_prefs.email_saved_searches`, digests built by pg_cron via `send_saved_search_digests`; `unsubscribe_saved_search_emails(token)` is intentionally callable signed-out. Why: one-click unsubscribe must work from any inbox; the token is an unguessable UUID.
