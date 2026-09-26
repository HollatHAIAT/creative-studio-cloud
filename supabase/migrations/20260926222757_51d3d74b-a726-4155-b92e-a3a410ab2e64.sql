-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Digital assets (Saudi banks collection etc.)
CREATE TABLE public.digital_assets (
  id text PRIMARY KEY,
  collection text NOT NULL DEFAULT 'saudi-banks',
  name text NOT NULL,
  name_ar text NOT NULL,
  code text NOT NULL,
  color text NOT NULL DEFAULT '#444444',
  founded int,
  license text NOT NULL DEFAULT 'Free — editorial and personal use. Commercial use requires trademark owner permission.',
  license_ar text NOT NULL DEFAULT 'مجاني للاستخدام التحريري والشخصي. يتطلب الاستخدام التجاري إذن مالك العلامة.',
  is_official boolean NOT NULL DEFAULT false,
  sort int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.digital_assets TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.digital_assets TO authenticated;
GRANT ALL ON public.digital_assets TO service_role;
ALTER TABLE public.digital_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view assets" ON public.digital_assets FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage assets" ON public.digital_assets FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.asset_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id text NOT NULL REFERENCES public.digital_assets(id) ON DELETE CASCADE,
  format text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  content_type text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, format)
);
GRANT SELECT ON public.asset_files TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.asset_files TO authenticated;
GRANT ALL ON public.asset_files TO service_role;
ALTER TABLE public.asset_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view asset files" ON public.asset_files FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage asset files" ON public.asset_files FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auctions and bids
CREATE TABLE public.auctions (
  id text PRIMARY KEY,
  listing_id text NOT NULL,
  start_bid numeric NOT NULL,
  reserve numeric NOT NULL,
  increment numeric NOT NULL DEFAULT 50,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Reserve price stays hidden: public roles can read every column except "reserve".
GRANT SELECT (id, listing_id, start_bid, increment, starts_at, ends_at, created_at) ON public.auctions TO anon, authenticated;
GRANT ALL ON public.auctions TO service_role;
ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view auctions" ON public.auctions FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id text NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  user_id uuid,
  bidder_name text NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bids TO anon, authenticated;
GRANT INSERT ON public.bids TO authenticated;
GRANT ALL ON public.bids TO service_role;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view bid history" ON public.bids FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Signed-in users bid as themselves" ON public.bids FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.validate_bid() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.auctions; top numeric;
BEGIN
  -- Row lock serialises concurrent bids on the same auction.
  SELECT * INTO a FROM public.auctions WHERE id = NEW.auction_id FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'AUCTION_NOT_FOUND'; END IF;
  IF now() < a.starts_at THEN RAISE EXCEPTION 'AUCTION_NOT_STARTED'; END IF;
  IF now() >= a.ends_at THEN RAISE EXCEPTION 'AUCTION_ENDED'; END IF;
  SELECT max(amount) INTO top FROM public.bids WHERE auction_id = NEW.auction_id;
  IF top IS NULL AND NEW.amount < a.start_bid THEN RAISE EXCEPTION 'BID_TOO_LOW:%', a.start_bid; END IF;
  IF top IS NOT NULL AND NEW.amount < top + a.increment THEN RAISE EXCEPTION 'BID_TOO_LOW:%', top + a.increment; END IF;
  IF NEW.amount > COALESCE(top, a.start_bid) * 10 THEN RAISE EXCEPTION 'BID_TOO_HIGH'; END IF;
  NEW.created_at := now();
  RETURN NEW;
END $$;

-- Tells visitors whether the reserve is met without revealing it.
CREATE OR REPLACE FUNCTION public.auction_reserve_met(_auction_id text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT max(b.amount) FROM public.bids b WHERE b.auction_id = _auction_id) >= (SELECT reserve FROM public.auctions WHERE id = _auction_id), false)
$$;
GRANT EXECUTE ON FUNCTION public.auction_reserve_met(text) TO anon, authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.bids;

-- Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  title_ar text NOT NULL,
  body text NOT NULL DEFAULT '',
  body_ar text NOT NULL DEFAULT '',
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users mark own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

CREATE OR REPLACE FUNCTION public.notify_outbid() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prev record;
BEGIN
  SELECT user_id, amount INTO prev FROM public.bids WHERE auction_id = NEW.auction_id AND id <> NEW.id ORDER BY amount DESC LIMIT 1;
  IF prev.user_id IS NOT NULL AND prev.user_id IS DISTINCT FROM NEW.user_id THEN
    INSERT INTO public.notifications (user_id, kind, title, title_ar, body, body_ar, link)
    VALUES (prev.user_id, 'outbid', 'You have been outbid', 'تمت المزايدة عليك',
      'New top bid: $' || NEW.amount, 'أعلى مزايدة جديدة: $' || NEW.amount, '/auctions/' || NEW.auction_id);
  END IF;
  RETURN NEW;
END $$;

-- Exhibitions and bookings
CREATE TABLE public.exhibitions (
  id text PRIMARY KEY,
  capacity int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.exhibitions TO anon, authenticated;
GRANT ALL ON public.exhibitions TO service_role;
ALTER TABLE public.exhibitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view exhibitions" ON public.exhibitions FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE DEFAULT ('CS-' || upper(substr(md5(random()::text), 1, 6))),
  user_id uuid NOT NULL,
  exhibition_id text NOT NULL REFERENCES public.exhibitions(id) ON DELETE CASCADE,
  visit_date date NOT NULL,
  slot text NOT NULL,
  tickets jsonb NOT NULL DEFAULT '{}'::jsonb,
  quantity int NOT NULL CHECK (quantity > 0 AND quantity <= 20),
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending_payment',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own bookings" ON public.bookings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own bookings" ON public.bookings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users cancel own bookings" ON public.bookings FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.validate_booking() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cap int; used int;
BEGIN
  IF NEW.visit_date < current_date THEN RAISE EXCEPTION 'Date has passed'; END IF;
  SELECT capacity INTO cap FROM public.exhibitions WHERE id = NEW.exhibition_id;
  SELECT COALESCE(sum(quantity), 0) INTO used FROM public.bookings WHERE exhibition_id = NEW.exhibition_id AND visit_date = NEW.visit_date AND slot = NEW.slot;
  IF used + NEW.quantity > cap THEN RAISE EXCEPTION 'This time slot is full'; END IF;
  NEW.status := 'pending_payment';
  RETURN NEW;
END $$;
CREATE TRIGGER bookings_validate BEFORE INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.validate_booking();
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;

CREATE OR REPLACE FUNCTION public.notify_booking() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, kind, title, title_ar, body, body_ar, link)
    VALUES (NEW.user_id, 'ticket', 'Ticket status: ' || replace(NEW.status, '_', ' '), 'حالة التذكرة: ' || CASE NEW.status WHEN 'pending_payment' THEN 'بانتظار الدفع' WHEN 'confirmed' THEN 'مؤكدة' WHEN 'cancelled' THEN 'ملغاة' ELSE NEW.status END,
      NEW.reference || ' · ' || NEW.visit_date || ' ' || NEW.slot, NEW.reference || ' · ' || NEW.visit_date || ' ' || NEW.slot, '/orders');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bookings_notify AFTER INSERT OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.notify_booking();

-- Public slot availability without exposing who booked.
CREATE OR REPLACE FUNCTION public.slot_bookings(_exhibition_id text, _date date)
RETURNS TABLE(slot text, booked int) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT slot, sum(quantity)::int FROM public.bookings WHERE exhibition_id = _exhibition_id AND visit_date = _date GROUP BY slot
$$;
GRANT EXECUTE ON FUNCTION public.slot_bookings(text, date) TO anon, authenticated;

-- Orders (checkout journey; payment provider connected later)
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE DEFAULT ('ORD-' || upper(substr(md5(random()::text), 1, 8))),
  user_id uuid NOT NULL,
  items jsonb NOT NULL,
  subtotal numeric NOT NULL,
  vat numeric NOT NULL DEFAULT 0,
  shipping numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  contact jsonb NOT NULL DEFAULT '{}'::jsonb,
  shipping_address jsonb,
  payment_method text NOT NULL,
  status text NOT NULL DEFAULT 'awaiting_payment',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'awaiting_payment');
ALTER TABLE public.bookings ADD COLUMN order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

CREATE OR REPLACE FUNCTION public.notify_order() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, kind, title, title_ar, body, body_ar, link)
  VALUES (NEW.user_id, 'order', 'Order received: ' || NEW.reference, 'تم استلام الطلب: ' || NEW.reference,
    'Total $' || NEW.total || ' · awaiting payment', 'الإجمالي $' || NEW.total || ' · بانتظار الدفع', '/orders/' || NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER orders_notify AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.notify_order();

-- Seed data
INSERT INTO public.digital_assets (id, name, name_ar, code, color, founded, sort) VALUES
 ('snb','Saudi National Bank','البنك الأهلي السعودي','SNB','#0f6b4f',1953,1),
 ('alrajhi','Al Rajhi Bank','مصرف الراجحي','ARB','#1b3f8f',1957,2),
 ('riyad','Riyad Bank','بنك الرياض','RB','#5a2d82',1957,3),
 ('sab','Saudi Awwal Bank','البنك السعودي الأول','SAB','#b3122e',1926,4),
 ('bsf','Banque Saudi Fransi','البنك السعودي الفرنسي','BSF','#13294b',1977,5),
 ('anb','Arab National Bank','البنك العربي الوطني','ANB','#0a7a3b',1979,6),
 ('albilad','Bank Albilad','بنك البلاد','BLD','#c96a12',2004,7),
 ('aljazira','Bank AlJazira','بنك الجزيرة','BJZ','#0b5a8a',1975,8),
 ('saib','Saudi Investment Bank','البنك السعودي للاستثمار','SAIB','#2c6e8f',1976,9),
 ('alinma','Alinma Bank','مصرف الإنماء','ALN','#7a4b1e',2006,10);

INSERT INTO public.auctions (id, listing_id, start_bid, reserve, increment, starts_at, ends_at) VALUES
 ('ochre-tide-auction','ochre-tide',3000,5500,100, now() - interval '2 days', now() + interval '6 days'),
 ('the-line-auction','the-line',1500,2500,50, now() - interval '1 day', now() + interval '3 days'),
 ('alif-auction','alif',900,1400,50, now() + interval '2 days', now() + interval '9 days'),
 ('teal-quiet-auction','teal-quiet',1800,3500,100, now() - interval '10 days', now() - interval '1 day');

INSERT INTO public.bids (auction_id, bidder_name, amount, created_at) VALUES
 ('ochre-tide-auction','Collector 1142',3000, now() - interval '40 hours'),
 ('ochre-tide-auction','Sara K.',3800, now() - interval '30 hours'),
 ('ochre-tide-auction','Collector 1142',4400, now() - interval '12 hours'),
 ('ochre-tide-auction','Gallery Nour',5200, now() - interval '3 hours'),
 ('the-line-auction','Faisal A.',1500, now() - interval '20 hours'),
 ('the-line-auction','Collector 88',2100, now() - interval '9 hours'),
 ('the-line-auction','Faisal A.',2950, now() - interval '1 hour'),
 ('teal-quiet-auction','Collector 7',1800, now() - interval '80 hours'),
 ('teal-quiet-auction','Hana M.',2600, now() - interval '30 hours');

INSERT INTO public.exhibitions (id, capacity) VALUES ('light-of-the-east',40),('digital-desert',500),('script-and-soul',25);

-- Validation triggers go on after seeding so historic seed bids are accepted.
CREATE TRIGGER bids_validate BEFORE INSERT ON public.bids FOR EACH ROW EXECUTE FUNCTION public.validate_bid();
CREATE TRIGGER bids_notify AFTER INSERT ON public.bids FOR EACH ROW EXECUTE FUNCTION public.notify_outbid();