CREATE OR REPLACE FUNCTION public.send_reviewer_deadline_reminders() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int := 0; dl text;
BEGIN
  FOR r IN
    SELECT lr.*, d.title, d.title_ar, u.id AS uid
    FROM public.listing_reviewers lr
    JOIN public.listing_drafts d ON d.id = lr.draft_id
    LEFT JOIN auth.users u ON lower(u.email) = lower(lr.email)
    WHERE lr.expires_at IS NOT NULL AND lr.expires_at > now() AND lr.expires_at <= now() + interval '48 hours'
      AND lr.status <> 'declined' AND lr.starts_at <= now()
      AND NOT EXISTS (SELECT 1 FROM public.email_outbox e WHERE e.ref_id = lr.id AND e.kind = 'review_reminder')
  LOOP
    dl := to_char(r.expires_at AT TIME ZONE 'Asia/Riyadh', 'YYYY-MM-DD HH24:MI') || ' (Riyadh)';
    INSERT INTO public.email_outbox (user_id, to_email, ref_id, kind, subject, subject_ar, body, body_ar, link)
    VALUES (r.uid, lower(r.email), r.id, 'review_reminder',
      'Reminder: your review of "' || coalesce(nullif(r.title,''), 'an artwork') || '" closes ' || dl,
      'تذكير: تنتهي مراجعتك لـ«' || coalesce(nullif(r.title_ar,''), 'عمل فني') || '» في ' || dl,
      'Your review access for "' || coalesce(nullif(r.title,''), 'this artwork') || '" ends on ' || dl || '. Open the listing to leave your comments before then: /review-invites#' || r.draft_id,
      'تنتهي صلاحية مراجعتك لـ«' || coalesce(nullif(r.title_ar,''), 'هذا العمل') || '» في ' || dl || '. افتح الإعلان لترك ملاحظاتك قبل ذلك: /review-invites#' || r.draft_id,
      '/review-invites#' || r.draft_id);
    IF r.uid IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, kind, title, title_ar, body, body_ar, link)
      VALUES (r.uid, 'listing', 'Your review access ends soon', 'تنتهي صلاحية مراجعتك قريبًا',
        coalesce(r.title,'') || ' · ' || dl, coalesce(r.title_ar,'') || ' · ' || dl, '/review-invites#' || r.draft_id);
    END IF;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.send_reviewer_deadline_reminders() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('reviewer-deadline-reminders', '15 * * * *', $$SELECT public.send_reviewer_deadline_reminders()$$);