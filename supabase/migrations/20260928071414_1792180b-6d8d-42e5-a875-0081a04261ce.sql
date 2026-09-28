ALTER TABLE public.auctions
  ADD COLUMN IF NOT EXISTS owner_user_id uuid,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS winner_user_id uuid,
  ADD COLUMN IF NOT EXISTS winning_bid_id uuid,
  ADD COLUMN IF NOT EXISTS winning_amount numeric,
  ADD COLUMN IF NOT EXISTS pay_by timestamptz,
  ADD COLUMN IF NOT EXISTS order_id uuid,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;
UPDATE public.auctions SET status = CASE WHEN now() >= ends_at THEN 'ended' WHEN now() >= starts_at THEN 'live' ELSE 'scheduled' END;

CREATE TABLE public.auction_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id text NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'invited',
  invited_by uuid NOT NULL,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (auction_id, email)
);
GRANT SELECT ON public.auction_invites TO authenticated;
GRANT ALL ON public.auction_invites TO service_role;
ALTER TABLE public.auction_invites ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.auction_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id text NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  actor uuid,
  kind text NOT NULL,
  amount numeric,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.auction_events TO authenticated;
GRANT ALL ON public.auction_events TO service_role;
ALTER TABLE public.auction_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.auction_events (auction_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.can_manage_auction(_auction text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.auctions WHERE id = _auction AND owner_user_id = auth.uid())
$$;

CREATE POLICY "Managers and invitees view invites" ON public.auction_invites FOR SELECT TO authenticated
  USING (public.can_manage_auction(auction_id) OR lower(email) = lower(auth.jwt() ->> 'email'));
CREATE POLICY "Managers, winners and bidders view auction log" ON public.auction_events FOR SELECT TO authenticated
  USING (public.can_manage_auction(auction_id) OR actor = auth.uid());

CREATE OR REPLACE FUNCTION public.log_auction(_auction text, _kind text, _amount numeric, _details jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.auction_events (auction_id, actor, kind, amount, details) VALUES (_auction, auth.uid(), _kind, _amount, coalesce(_details, '{}'::jsonb))
$$;
REVOKE EXECUTE ON FUNCTION public.log_auction(text, text, numeric, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.validate_bid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.auctions; top numeric;
BEGIN
  SELECT * INTO a FROM public.auctions WHERE id = NEW.auction_id FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'AUCTION_NOT_FOUND'; END IF;
  IF a.status IN ('cancelled','ended','awaiting_payment','sold','unsold') THEN RAISE EXCEPTION 'AUCTION_ENDED'; END IF;
  IF now() < a.starts_at THEN RAISE EXCEPTION 'AUCTION_NOT_STARTED'; END IF;
  IF now() >= a.ends_at THEN RAISE EXCEPTION 'AUCTION_ENDED'; END IF;
  IF a.owner_user_id IS NOT NULL AND a.owner_user_id = NEW.user_id THEN RAISE EXCEPTION 'OWNER_CANNOT_BID'; END IF;
  IF public.is_blocked(NEW.user_id) THEN RAISE EXCEPTION 'ACCOUNT_SUSPENDED'; END IF;
  IF a.visibility = 'invite' AND NOT EXISTS (
    SELECT 1 FROM public.auction_invites WHERE auction_id = a.id AND status <> 'declined' AND lower(email) = lower(auth.jwt() ->> 'email')
  ) THEN RAISE EXCEPTION 'INVITE_REQUIRED'; END IF;
  SELECT max(amount) INTO top FROM public.bids WHERE auction_id = NEW.auction_id;
  IF top IS NULL AND NEW.amount < a.start_bid THEN RAISE EXCEPTION 'BID_TOO_LOW:%', a.start_bid; END IF;
  IF top IS NOT NULL AND NEW.amount < top + a.increment THEN RAISE EXCEPTION 'BID_TOO_LOW:%', top + a.increment; END IF;
  IF NEW.amount > COALESCE(top, a.start_bid) * 10 THEN RAISE EXCEPTION 'BID_TOO_HIGH'; END IF;
  NEW.created_at := now();
  IF a.status = 'scheduled' THEN UPDATE public.auctions SET status = 'live' WHERE id = a.id; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.log_bid() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.auction_events (auction_id, actor, kind, amount, details)
  VALUES (NEW.auction_id, NEW.user_id, 'bid', NEW.amount, jsonb_build_object('bidder', NEW.bidder_name, 'bid_id', NEW.id));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS log_bid ON public.bids;
CREATE TRIGGER log_bid AFTER INSERT ON public.bids FOR EACH ROW EXECUTE FUNCTION public.log_bid();

CREATE OR REPLACE FUNCTION public.create_auction(_listing text, _start numeric, _reserve numeric, _increment numeric, _starts timestamptz, _ends timestamptz, _visibility text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.listings; new_id text;
BEGIN
  SELECT * INTO l FROM public.listings WHERE id = _listing;
  IF l.id IS NULL THEN RAISE EXCEPTION 'LISTING_NOT_FOUND'; END IF;
  IF NOT (public.is_staff(auth.uid()) OR l.owner_user_id = auth.uid()) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  IF _visibility NOT IN ('open','invite') THEN RAISE EXCEPTION 'BAD_VISIBILITY'; END IF;
  IF _start <= 0 OR _increment <= 0 OR _reserve < 0 THEN RAISE EXCEPTION 'BAD_AMOUNTS'; END IF;
  IF _ends <= _starts OR _ends <= now() THEN RAISE EXCEPTION 'BAD_DATES'; END IF;
  IF EXISTS (SELECT 1 FROM public.auctions WHERE listing_id = _listing AND status IN ('scheduled','live','ended','awaiting_payment')) THEN RAISE EXCEPTION 'AUCTION_ALREADY_OPEN'; END IF;
  new_id := _listing || '-auc-' || substr(md5(random()::text), 1, 6);
  INSERT INTO public.auctions (id, listing_id, start_bid, reserve, increment, starts_at, ends_at, owner_user_id, visibility, status)
  VALUES (new_id, _listing, _start, _reserve, _increment, _starts, _ends, coalesce(l.owner_user_id, auth.uid()), _visibility, CASE WHEN _starts <= now() THEN 'live' ELSE 'scheduled' END);
  PERFORM public.log_auction(new_id, 'created', _start, jsonb_build_object('reserve', _reserve, 'increment', _increment, 'visibility', _visibility, 'starts_at', _starts, 'ends_at', _ends));
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.update_auction(_auction text, _reserve numeric, _increment numeric, _ends timestamptz, _visibility text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.auctions;
BEGIN
  IF NOT public.can_manage_auction(_auction) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  SELECT * INTO a FROM public.auctions WHERE id = _auction FOR UPDATE;
  IF a.status NOT IN ('scheduled','live') THEN RAISE EXCEPTION 'AUCTION_CLOSED'; END IF;
  IF _visibility NOT IN ('open','invite') OR _increment <= 0 OR _reserve < 0 OR _ends <= now() THEN RAISE EXCEPTION 'BAD_INPUT'; END IF;
  UPDATE public.auctions SET reserve = _reserve, increment = _increment, ends_at = _ends, visibility = _visibility WHERE id = _auction;
  PERFORM public.log_auction(_auction, 'updated', NULL, jsonb_build_object('reserve', _reserve, 'increment', _increment, 'ends_at', _ends, 'visibility', _visibility));
END $$;

CREATE OR REPLACE FUNCTION public.cancel_auction(_auction text, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.auctions; u uuid;
BEGIN
  IF NOT public.can_manage_auction(_auction) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  SELECT * INTO a FROM public.auctions WHERE id = _auction FOR UPDATE;
  IF a.status IN ('sold','cancelled') THEN RAISE EXCEPTION 'AUCTION_CLOSED'; END IF;
  IF a.order_id IS NOT NULL THEN UPDATE public.orders SET status = 'cancelled' WHERE id = a.order_id AND status IN ('awaiting_payment','payment_failed'); END IF;
  UPDATE public.auctions SET status = 'cancelled', closed_at = now() WHERE id = _auction;
  PERFORM public.log_auction(_auction, 'cancelled', NULL, jsonb_build_object('reason', coalesce(_reason,'')));
  FOR u IN SELECT DISTINCT user_id FROM public.bids WHERE auction_id = _auction AND user_id IS NOT NULL LOOP
    PERFORM public.push_notification(u, 'bids', 'Auction cancelled', 'أُلغي المزاد', coalesce(_reason,''), coalesce(_reason,''), '/auctions/' || _auction);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.invite_to_auction(_auction text, _email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e text := lower(btrim(_email)); uid uuid;
BEGIN
  IF NOT public.can_manage_auction(_auction) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  IF e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(e) > 255 THEN RAISE EXCEPTION 'BAD_EMAIL'; END IF;
  INSERT INTO public.auction_invites (auction_id, email, invited_by) VALUES (_auction, e, auth.uid())
  ON CONFLICT (auction_id, email) DO UPDATE SET status = 'invited', responded_at = NULL;
  PERFORM public.log_auction(_auction, 'invited', NULL, jsonb_build_object('email', e));
  SELECT id INTO uid FROM auth.users WHERE lower(email) = e;
  IF uid IS NOT NULL THEN
    PERFORM public.push_notification(uid, 'bids', 'You are invited to an auction', 'دُعيت إلى مزاد', 'Open your invitations to accept.', 'افتح دعواتك للقبول.', '/my-auctions');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.revoke_auction_invite(_invite uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.auction_invites;
BEGIN
  SELECT * INTO i FROM public.auction_invites WHERE id = _invite;
  IF i.id IS NULL OR NOT public.can_manage_auction(i.auction_id) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  DELETE FROM public.auction_invites WHERE id = _invite;
  PERFORM public.log_auction(i.auction_id, 'invite_revoked', NULL, jsonb_build_object('email', i.email));
END $$;

CREATE OR REPLACE FUNCTION public.respond_auction_invite(_invite uuid, _accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.auction_invites;
BEGIN
  SELECT * INTO i FROM public.auction_invites WHERE id = _invite FOR UPDATE;
  IF i.id IS NULL OR lower(i.email) <> lower(auth.jwt() ->> 'email') THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  UPDATE public.auction_invites SET status = CASE WHEN _accept THEN 'accepted' ELSE 'declined' END, responded_at = now() WHERE id = _invite;
  PERFORM public.log_auction(i.auction_id, CASE WHEN _accept THEN 'invite_accepted' ELSE 'invite_declined' END, NULL, jsonb_build_object('email', i.email));
END $$;

-- Offers the lot to the highest eligible bidder not yet tried; creates their order.
CREATE OR REPLACE FUNCTION public.award_auction(_auction text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.auctions; b public.bids; l public.listings; oid uuid; sub numeric; vat numeric; ship numeric := 25;
BEGIN
  SELECT * INTO a FROM public.auctions WHERE id = _auction FOR UPDATE;
  SELECT * INTO b FROM public.bids x WHERE x.auction_id = _auction AND x.user_id IS NOT NULL AND x.amount >= a.reserve
    AND NOT EXISTS (SELECT 1 FROM public.auction_events e WHERE e.auction_id = _auction AND e.kind IN ('winner','passed') AND (e.details ->> 'user_id')::uuid = x.user_id)
    ORDER BY x.amount DESC, x.created_at ASC LIMIT 1;
  IF b.id IS NULL THEN
    UPDATE public.auctions SET status = 'unsold', winner_user_id = NULL, winning_bid_id = NULL, winning_amount = NULL, pay_by = NULL, order_id = NULL, closed_at = coalesce(closed_at, now()) WHERE id = _auction;
    INSERT INTO public.auction_events (auction_id, kind, details) VALUES (_auction, 'unsold', jsonb_build_object('reserve', a.reserve));
    IF a.owner_user_id IS NOT NULL THEN PERFORM public.push_notification(a.owner_user_id, 'bids', 'Auction closed unsold', 'انتهى المزاد دون بيع', 'No eligible bid met the reserve.', 'لم يبلغ أي عرض السعر الأدنى.', '/my-auctions'); END IF;
    RETURN;
  END IF;
  SELECT * INTO l FROM public.listings WHERE id = a.listing_id;
  sub := b.amount; vat := round((sub + ship) * 0.15, 2);
  INSERT INTO public.orders (user_id, items, subtotal, vat, shipping, total, contact, payment_method, status)
  VALUES (b.user_id, jsonb_build_array(jsonb_build_object('kind','auction','title', coalesce(l.title, a.listing_id),'titleAr', coalesce(l.title_ar, a.listing_id),'detail','Winning bid','unit', sub,'qty',1,'amount', sub,'listingId', a.listing_id,'auctionId', a.id)),
    sub, vat, ship, sub + ship + vat, jsonb_build_object('name', b.bidder_name), 'bank', 'awaiting_payment')
  RETURNING id INTO oid;
  UPDATE public.auctions SET status = 'awaiting_payment', winner_user_id = b.user_id, winning_bid_id = b.id, winning_amount = b.amount, pay_by = now() + interval '48 hours', order_id = oid, closed_at = coalesce(closed_at, now()) WHERE id = _auction;
  INSERT INTO public.auction_events (auction_id, actor, kind, amount, details) VALUES (_auction, b.user_id, 'winner', b.amount, jsonb_build_object('user_id', b.user_id, 'bidder', b.bidder_name, 'order_id', oid));
  PERFORM public.push_notification(b.user_id, 'bids', 'You won the auction — pay within 48 hours', 'فزت بالمزاد — ادفع خلال 48 ساعة', coalesce(l.title,''), coalesce(l.title_ar,''), '/orders/' || oid);
  IF a.owner_user_id IS NOT NULL THEN PERFORM public.push_notification(a.owner_user_id, 'bids', 'Your auction has a winner', 'لمزادك فائز', b.bidder_name, b.bidder_name, '/my-auctions'); END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.award_auction(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.close_auction(_auction text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.auctions;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_manage_auction(_auction) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  SELECT * INTO a FROM public.auctions WHERE id = _auction FOR UPDATE;
  IF a.status NOT IN ('scheduled','live','ended') THEN RAISE EXCEPTION 'AUCTION_CLOSED'; END IF;
  IF now() < a.ends_at THEN
    IF auth.uid() IS NULL THEN RETURN; END IF;
    UPDATE public.auctions SET ends_at = now() WHERE id = _auction; -- manager closes early
  END IF;
  INSERT INTO public.auction_events (auction_id, actor, kind, details) VALUES (_auction, auth.uid(), 'closed', '{}'::jsonb);
  PERFORM public.award_auction(_auction);
END $$;

CREATE OR REPLACE FUNCTION public.pass_auction_to_next(_auction text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.auctions;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_manage_auction(_auction) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  SELECT * INTO a FROM public.auctions WHERE id = _auction FOR UPDATE;
  IF a.status <> 'awaiting_payment' THEN RAISE EXCEPTION 'NOT_AWAITING_PAYMENT'; END IF;
  UPDATE public.orders SET status = 'cancelled' WHERE id = a.order_id AND status IN ('awaiting_payment','payment_failed');
  INSERT INTO public.auction_events (auction_id, actor, kind, amount, details) VALUES (_auction, auth.uid(), 'passed', a.winning_amount, jsonb_build_object('user_id', a.winner_user_id, 'order_id', a.order_id, 'reason', CASE WHEN now() > a.pay_by THEN 'payment_deadline' ELSE 'manual' END));
  IF a.winner_user_id IS NOT NULL THEN PERFORM public.push_notification(a.winner_user_id, 'bids', 'Auction offer expired', 'انتهت مهلة عرض المزاد', 'Payment was not received in time.', 'لم يُستلم الدفع في الوقت المحدد.', '/auctions/' || _auction); END IF;
  PERFORM public.award_auction(_auction);
END $$;

-- Order paid → auction sold.
CREATE OR REPLACE FUNCTION public.auction_order_paid() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.auctions;
BEGIN
  IF NEW.status IN ('paid','processing','shipped','delivered','completed') AND OLD.status IS DISTINCT FROM NEW.status THEN
    FOR a IN SELECT * FROM public.auctions WHERE order_id = NEW.id AND status = 'awaiting_payment' LOOP
      UPDATE public.auctions SET status = 'sold' WHERE id = a.id;
      INSERT INTO public.auction_events (auction_id, actor, kind, amount, details) VALUES (a.id, NEW.user_id, 'sold', a.winning_amount, jsonb_build_object('order_id', NEW.id));
      UPDATE public.listings SET status = 'sold' WHERE id = a.listing_id;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS auction_order_paid ON public.orders;
CREATE TRIGGER auction_order_paid AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.auction_order_paid();

CREATE OR REPLACE FUNCTION public.process_due_auctions() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n integer := 0;
BEGIN
  UPDATE public.auctions SET status = 'live' WHERE status = 'scheduled' AND now() >= starts_at AND now() < ends_at;
  FOR r IN SELECT id FROM public.auctions WHERE status IN ('scheduled','live','ended') AND now() >= ends_at LOOP
    PERFORM public.close_auction(r.id); n := n + 1;
  END LOOP;
  FOR r IN SELECT id FROM public.auctions WHERE status = 'awaiting_payment' AND now() > pay_by LOOP
    PERFORM public.pass_auction_to_next(r.id); n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.process_due_auctions() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_auction(text, numeric, numeric, numeric, timestamptz, timestamptz, text), public.update_auction(text, numeric, numeric, timestamptz, text), public.cancel_auction(text, text), public.invite_to_auction(text, text), public.revoke_auction_invite(uuid), public.respond_auction_invite(uuid, boolean), public.close_auction(text), public.pass_auction_to_next(text), public.can_manage_auction(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_auction(text, numeric, numeric, numeric, timestamptz, timestamptz, text), public.update_auction(text, numeric, numeric, timestamptz, text), public.cancel_auction(text, text), public.invite_to_auction(text, text), public.revoke_auction_invite(uuid), public.respond_auction_invite(uuid, boolean), public.close_auction(text), public.pass_auction_to_next(text), public.can_manage_auction(text) FROM PUBLIC, anon;

-- Anyone viewing a due auction settles it immediately; hourly job is only a backstop.
CREATE OR REPLACE FUNCTION public.settle_auction_if_due(_auction text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.auctions;
BEGIN
  SELECT * INTO a FROM public.auctions WHERE id = _auction;
  IF a.id IS NULL THEN RETURN NULL; END IF;
  IF a.status IN ('scheduled','live','ended') AND now() >= a.ends_at THEN
    INSERT INTO public.auction_events (auction_id, kind, details) VALUES (_auction, 'closed', '{}'::jsonb);
    PERFORM public.award_auction(_auction);
  ELSIF a.status = 'awaiting_payment' AND now() > a.pay_by THEN
    UPDATE public.orders SET status = 'cancelled' WHERE id = a.order_id AND status IN ('awaiting_payment','payment_failed');
    INSERT INTO public.auction_events (auction_id, kind, amount, details) VALUES (_auction, 'passed', a.winning_amount, jsonb_build_object('user_id', a.winner_user_id, 'order_id', a.order_id, 'reason', 'payment_deadline'));
    PERFORM public.award_auction(_auction);
  ELSIF a.status = 'scheduled' AND now() >= a.starts_at THEN
    UPDATE public.auctions SET status = 'live' WHERE id = _auction;
  END IF;
  RETURN (SELECT status FROM public.auctions WHERE id = _auction);
END $$;
REVOKE EXECUTE ON FUNCTION public.settle_auction_if_due(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_auction_if_due(text) TO anon, authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_events;
SELECT cron.schedule('process-due-auctions', '0 * * * *', $$SELECT public.process_due_auctions()$$);