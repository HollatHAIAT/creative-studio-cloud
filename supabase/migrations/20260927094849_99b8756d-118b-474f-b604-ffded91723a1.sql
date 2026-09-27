
-- Listings (catalog ids referenced by cart, favorites, offers, reviews)
CREATE TABLE public.listings (
  id text PRIMARY KEY,
  title text NOT NULL, title_ar text NOT NULL DEFAULT '',
  creator_id text NOT NULL, category text NOT NULL,
  owner_user_id uuid,
  status text NOT NULL DEFAULT 'published',
  owner_can_reply boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.listings TO anon, authenticated;
GRANT ALL ON public.listings TO service_role;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads published listings" ON public.listings FOR SELECT USING (status = 'published' OR owner_user_id = auth.uid() OR public.is_staff(auth.uid()));
INSERT INTO public.listings (id, title, title_ar, creator_id, category) VALUES
 ('ochre-tide','Ochre Tide','مدّ المغرة','layla-haddad','Painting'),
 ('rose-dunes','Rose Dunes','كثبان وردية','omar-rahman','Photography'),
 ('the-line','The Line','الخط','noor-al-sayed','Calligraphy'),
 ('teal-quiet','Teal Quiet','سكون فيروزي','layla-haddad','Painting'),
 ('empty-quarter','Empty Quarter','الربع الخالي','omar-rahman','Print'),
 ('alif','Alif','ألف','noor-al-sayed','Calligraphy');

-- Authorized agents (representatives) with owner approval + license validity
CREATE TABLE public.listing_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id text NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  agent_user_id uuid,
  agent_name text NOT NULL, agent_name_ar text NOT NULL DEFAULT '',
  agency text NOT NULL DEFAULT '', agency_ar text NOT NULL DEFAULT '',
  license_no text NOT NULL,
  valid_from date NOT NULL DEFAULT current_date,
  valid_until date NOT NULL,
  scope text[] NOT NULL DEFAULT ARRAY['original','print','license'],
  owner_approved_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.listing_agents TO anon, authenticated;
GRANT ALL ON public.listing_agents TO service_role;
ALTER TABLE public.listing_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads agent authorizations" ON public.listing_agents FOR SELECT USING (true);
CREATE POLICY "Staff manage agents" ON public.listing_agents FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
GRANT INSERT, UPDATE, DELETE ON public.listing_agents TO authenticated;
INSERT INTO public.listing_agents (listing_id, agent_name, agent_name_ar, agency, agency_ar, license_no, valid_until, owner_approved_at) VALUES
 ('rose-dunes','Noura Al-Qahtani','نورة القحطاني','Diriyah Art Representation','الدرعية لتمثيل الفنانين','AUTH-ROSE-D-2026','2027-06-30', now()),
 ('alif','Noura Al-Qahtani','نورة القحطاني','Diriyah Art Representation','الدرعية لتمثيل الفنانين','AUTH-ALIF-2026','2027-06-30', now());

/** True when an agent authorization is currently usable for a sale kind. */
CREATE OR REPLACE FUNCTION public.agent_authorization_valid(_listing text, _kind text) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.listing_agents;
BEGIN
  SELECT * INTO a FROM public.listing_agents WHERE listing_id = _listing AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1;
  IF a.id IS NULL THEN RETURN 'OWNER'; END IF;
  IF a.owner_approved_at IS NULL THEN RETURN 'AGENT_NOT_APPROVED'; END IF;
  IF current_date < a.valid_from OR current_date > a.valid_until THEN RETURN 'AGENT_LICENSE_EXPIRED'; END IF;
  IF NOT (_kind = ANY (a.scope)) THEN RETURN 'AGENT_SCOPE'; END IF;
  RETURN 'AGENT_OK';
END $$;
GRANT EXECUTE ON FUNCTION public.agent_authorization_valid(text, text) TO anon, authenticated;

-- Cart
CREATE TABLE public.cart_items (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  key text NOT NULL,
  item jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT ALL ON public.cart_items TO service_role;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own cart" ON public.cart_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Favorites
CREATE TABLE public.favorites (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  listing_id text NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own favorites" ON public.favorites FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Blocks (declared before content tables so policies can use is_blocked)
CREATE TABLE public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reason text NOT NULL DEFAULT '',
  blocked_until timestamptz,
  lifted_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See own or staff" ON public.user_blocks FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.is_blocked(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_blocks WHERE user_id = _uid AND lifted_at IS NULL AND (blocked_until IS NULL OR blocked_until > now()))
$$;
GRANT EXECUTE ON FUNCTION public.is_blocked(uuid) TO authenticated;

-- Offers
CREATE TABLE public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id text NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  amount numeric NOT NULL CHECK (amount > 0),
  message text NOT NULL DEFAULT '' CHECK (length(message) <= 1000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','withdrawn')),
  response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.offers TO authenticated;
GRANT ALL ON public.offers TO service_role;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyer, owner or staff read offers" ON public.offers FOR SELECT TO authenticated USING (
  auth.uid() = user_id OR public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.owner_user_id = auth.uid()));
CREATE POLICY "Buyer creates offers" ON public.offers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'pending' AND NOT public.is_blocked(auth.uid()));
CREATE POLICY "Owner or staff respond" ON public.offers FOR UPDATE TO authenticated USING (
  public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.owner_user_id = auth.uid()));

-- Inquiries
CREATE TABLE public.inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id text NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  message text NOT NULL CHECK (length(message) BETWEEN 2 AND 2000),
  reply text,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.inquiries TO authenticated;
GRANT ALL ON public.inquiries TO service_role;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Asker, owner or staff read" ON public.inquiries FOR SELECT TO authenticated USING (
  auth.uid() = user_id OR public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.owner_user_id = auth.uid()));
CREATE POLICY "Asker creates" ON public.inquiries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND reply IS NULL AND NOT public.is_blocked(auth.uid()));
CREATE POLICY "Owner or staff reply" ON public.inquiries FOR UPDATE TO authenticated USING (
  public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.owner_user_id = auth.uid()));

-- Reviews
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id text NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  author_name text NOT NULL DEFAULT '',
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL DEFAULT '' CHECK (length(body) <= 2000),
  status text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','removed')),
  removed_reason text,
  owner_reply text,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, user_id)
);
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads visible reviews" ON public.reviews FOR SELECT USING (status = 'visible' OR auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "Users write own review" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'visible' AND owner_reply IS NULL AND NOT public.is_blocked(auth.uid()));
CREATE POLICY "Users delete own review" ON public.reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.review_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  reason text NOT NULL CHECK (length(reason) BETWEEN 2 AND 500),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, user_id)
);
GRANT SELECT, INSERT ON public.review_reports TO authenticated;
GRANT ALL ON public.review_reports TO service_role;
ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reporter or staff read" ON public.review_reports FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "Users report" ON public.review_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND NOT public.is_blocked(auth.uid()));

-- RPCs
CREATE OR REPLACE FUNCTION public.reply_to_review(_review uuid, _reply text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.reviews; l public.listings;
BEGIN
  SELECT * INTO r FROM public.reviews WHERE id = _review;
  IF r.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  SELECT * INTO l FROM public.listings WHERE id = r.listing_id;
  IF NOT (public.is_staff(auth.uid()) OR (l.owner_user_id = auth.uid() AND l.owner_can_reply)
     OR EXISTS (SELECT 1 FROM public.listing_agents a WHERE a.listing_id = l.id AND a.agent_user_id = auth.uid() AND l.owner_can_reply
                AND a.revoked_at IS NULL AND a.owner_approved_at IS NOT NULL AND current_date BETWEEN a.valid_from AND a.valid_until)) THEN
    RAISE EXCEPTION 'REPLY_NOT_ALLOWED'; END IF;
  IF public.is_blocked(auth.uid()) THEN RAISE EXCEPTION 'BLOCKED'; END IF;
  UPDATE public.reviews SET owner_reply = left(_reply, 2000), replied_at = now() WHERE id = _review;
  PERFORM public.push_notification(r.user_id, 'review', 'The seller replied to your review', 'ردّ البائع على تقييمك', left(_reply, 140), left(_reply, 140), '/artwork/' || r.listing_id);
END $$;
GRANT EXECUTE ON FUNCTION public.reply_to_review(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_moderate_review(_review uuid, _remove boolean, _reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.reviews;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO r FROM public.reviews WHERE id = _review;
  UPDATE public.reviews SET status = CASE WHEN _remove THEN 'removed' ELSE 'visible' END, removed_reason = CASE WHEN _remove THEN _reason END WHERE id = _review;
  UPDATE public.review_reports SET resolved_at = now() WHERE review_id = _review AND resolved_at IS NULL;
  IF _remove THEN PERFORM public.push_notification(r.user_id, 'review', 'Your review was removed', 'أُزيل تقييمك', coalesce(_reason,''), coalesce(_reason,''), '/artwork/' || r.listing_id); END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_moderate_review(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_reply_permission(_listing text, _allowed boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  UPDATE public.listings SET owner_can_reply = _allowed WHERE id = _listing;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_set_reply_permission(text, boolean) TO authenticated;

-- Notify owner + staff of new reviews, offers, inquiries, reports
CREATE OR REPLACE FUNCTION public.notify_listing_activity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lid text; owner uuid; t text; tar text; s record;
BEGIN
  IF TG_TABLE_NAME = 'review_reports' THEN SELECT listing_id INTO lid FROM public.reviews WHERE id = NEW.review_id;
  ELSE lid := NEW.listing_id; END IF;
  SELECT owner_user_id INTO owner FROM public.listings WHERE id = lid;
  t := CASE TG_TABLE_NAME WHEN 'reviews' THEN 'New review' WHEN 'offers' THEN 'New offer' WHEN 'inquiries' THEN 'New question' ELSE 'Review reported' END;
  tar := CASE TG_TABLE_NAME WHEN 'reviews' THEN 'تقييم جديد' WHEN 'offers' THEN 'عرض جديد' WHEN 'inquiries' THEN 'سؤال جديد' ELSE 'بلاغ عن تقييم' END;
  IF owner IS NOT NULL AND TG_TABLE_NAME <> 'review_reports' THEN PERFORM public.push_notification(owner, 'listing', t, tar, lid, lid, '/artwork/' || lid); END IF;
  FOR s IN SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin','moderator') LOOP
    PERFORM public.push_notification(s.user_id, 'listing', t, tar, lid, lid, CASE WHEN TG_TABLE_NAME IN ('reviews','review_reports') THEN '/admin/reviews' ELSE '/artwork/' || lid END);
  END LOOP;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_listing_activity() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER t_notify_review AFTER INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.notify_listing_activity();
CREATE TRIGGER t_notify_offer AFTER INSERT ON public.offers FOR EACH ROW EXECUTE FUNCTION public.notify_listing_activity();
CREATE TRIGGER t_notify_inquiry AFTER INSERT ON public.inquiries FOR EACH ROW EXECUTE FUNCTION public.notify_listing_activity();
CREATE TRIGGER t_notify_report AFTER INSERT ON public.review_reports FOR EACH ROW EXECUTE FUNCTION public.notify_listing_activity();

-- Offer responses notify the buyer
CREATE OR REPLACE FUNCTION public.notify_offer_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> OLD.status THEN
    PERFORM public.push_notification(NEW.user_id, 'listing', 'Your offer was ' || NEW.status, CASE NEW.status WHEN 'accepted' THEN 'قُبل عرضك' WHEN 'declined' THEN 'رُفض عرضك' ELSE 'تحدّث عرضك' END, coalesce(NEW.response,''), coalesce(NEW.response,''), '/artwork/' || NEW.listing_id);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_offer_update() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER t_offer_update BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION public.notify_offer_update();

-- Block notices
CREATE OR REPLACE FUNCTION public.notify_block() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.push_notification(NEW.user_id, 'account', 'Your account was suspended', 'تم إيقاف حسابك',
      coalesce(NEW.reason,'') || CASE WHEN NEW.blocked_until IS NULL THEN ' · permanent' ELSE ' · until ' || to_char(NEW.blocked_until, 'YYYY-MM-DD HH24:MI') END,
      coalesce(NEW.reason,'') || CASE WHEN NEW.blocked_until IS NULL THEN ' · دائم' ELSE ' · حتى ' || to_char(NEW.blocked_until, 'YYYY-MM-DD HH24:MI') END, '/settings');
  ELSIF NEW.lifted_at IS NOT NULL AND OLD.lifted_at IS NULL THEN
    PERFORM public.push_notification(NEW.user_id, 'account', 'Welcome back — your account is active again', 'مرحبًا بعودتك — أُعيد تفعيل حسابك', '', '', '/');
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_block() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER t_notify_block AFTER INSERT OR UPDATE ON public.user_blocks FOR EACH ROW EXECUTE FUNCTION public.notify_block();

/** Called by a user after sign-in: closes expired blocks so they get the "welcome back" notice. */
CREATE OR REPLACE FUNCTION public.close_expired_blocks() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.user_blocks SET lifted_at = now() WHERE user_id = auth.uid() AND lifted_at IS NULL AND blocked_until IS NOT NULL AND blocked_until <= now();
$$;
GRANT EXECUTE ON FUNCTION public.close_expired_blocks() TO authenticated;

-- Payment confirmation by staff (e.g. bank transfer) until a provider is connected
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  method text NOT NULL,
  provider_ref text,
  confirmed_by uuid,
  confirmed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyer or staff read payments" ON public.payments FOR SELECT TO authenticated USING (
  public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.admin_confirm_payment(_order uuid, _ref text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = _order FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF o.status <> 'awaiting_payment' THEN RAISE EXCEPTION 'NOT_AWAITING_PAYMENT'; END IF;
  INSERT INTO public.payments (order_id, amount, method, provider_ref, confirmed_by) VALUES (o.id, o.total, o.payment_method, _ref, auth.uid());
  PERFORM public.admin_set_order_status(o.id, 'paid', 'Payment confirmed' || CASE WHEN _ref IS NOT NULL AND _ref <> '' THEN ' · ' || _ref ELSE '' END);
END $$;
GRANT EXECUTE ON FUNCTION public.admin_confirm_payment(uuid, text) TO authenticated;
