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

- Security-definer lookups about a person or draft (has_role, is_blocked, draft_owner, active_reviewer, platform_validation_issues) answer only for the caller themself or staff (caller_is_staff). Why: signed-in users could otherwise probe other users' roles, suspensions and reviewer invitations. The remaining linter warnings on security-definer functions are intentional: each function checks the caller inside.
- Teams/galleries: organizations + organization_members (owner>manager>editor>reviewer>viewer, checked via my_org_role which only answers for the caller); shared drafts via listing_drafts.org_id; custom workflows in org_review_workflows advanced only through decide_workflow_step. Why: one role ladder for all shared-artwork rules, enforced in the DB.
- Every /admin/* page renders inside AdminShell (sidebar back-office, no public header/footer), switched automatically by SiteShell on the path. Why: the admin portal is separate from the public site without editing each page.
- Site content (texts via t(), artists, categories, exhibitions, banners) is edited in cms_entries and merged over the built-in data by applyCms in src/lib/cms.ts (CmsSync in __root); overrides apply only after hydration. Why: admins manage content without replacing the static base, and SSR stays consistent.
- Admin audit trail: admin_audit_events is append-only and sha256 hash-chained (audit_chain_fill); written only by triggers/audit_write; read and acted on only through audit_gate-checked RPCs that log every access. Why: tamper evidence and staff-only access must hold even for admins.
- Archiving is derived at query time (audit_retention days + active audit_holds), never by moving/deleting rows. Why: keeps events immutable and the hash chain intact.
- Incidents = admin_alerts grouped by kind+subject; exports stored server-side with watermark/expiry and downloaded only via admin_export_download; two pg_cron jobs (hourly escalation/expiry alerts, weekly integrity+summary). Why: every export and download is auditable and blockable.
- Admin roles are granted only by an existing admin via admin_set_role; no email-based auto-claim. Why: email claims allowed privilege escalation.
