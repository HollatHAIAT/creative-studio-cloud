ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS price numeric NOT NULL DEFAULT 0;
UPDATE public.listings SET price = v.p FROM (VALUES ('ochre-tide',60),('rose-dunes',40),('the-line',150),('teal-quiet',50),('empty-quarter',30),('alif',70)) v(id,p) WHERE listings.id = v.id;

CREATE TABLE public.saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL DEFAULT '',
  keywords text NOT NULL DEFAULT '',
  categories text[] NOT NULL DEFAULT '{}',
  min_price numeric,
  max_price numeric,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_searches TO authenticated;
GRANT ALL ON public.saved_searches TO service_role;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own saved searches" ON public.saved_searches FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.validate_saved_search() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.keywords := left(trim(NEW.keywords), 200);
  NEW.name := left(trim(NEW.name), 80);
  IF NEW.min_price IS NOT NULL AND NEW.max_price IS NOT NULL AND NEW.min_price > NEW.max_price THEN RAISE EXCEPTION 'PRICE_RANGE'; END IF;
  IF TG_OP = 'INSERT' AND (SELECT count(*) FROM saved_searches WHERE user_id = NEW.user_id) >= 20 THEN RAISE EXCEPTION 'SEARCH_LIMIT'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER saved_search_validate BEFORE INSERT OR UPDATE ON public.saved_searches FOR EACH ROW EXECUTE FUNCTION public.validate_saved_search();

-- Notify matching saved searches when a listing becomes live.
CREATE OR REPLACE FUNCTION public.notify_saved_searches() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> 'published' OR (TG_OP = 'UPDATE' AND OLD.status = 'published') THEN RETURN NEW; END IF;
  INSERT INTO notifications (user_id, kind, title, title_ar, body, body_ar, link)
  SELECT s.user_id, 'saved_search',
    'New match for your saved search', 'عمل جديد يطابق بحثك المحفوظ',
    NEW.title || coalesce(' — "' || nullif(s.name,'') || '"', ''),
    NEW.title_ar || coalesce(' — «' || nullif(s.name,'') || '»', ''),
    '/artwork/' || NEW.id
  FROM saved_searches s
  WHERE s.active
    AND s.user_id IS DISTINCT FROM NEW.owner_user_id
    AND (cardinality(s.categories) = 0 OR NEW.category = ANY(s.categories))
    AND (s.min_price IS NULL OR NEW.price >= s.min_price)
    AND (s.max_price IS NULL OR NEW.price <= s.max_price)
    AND (s.keywords = '' OR NOT EXISTS (
      SELECT 1 FROM unnest(regexp_split_to_array(lower(s.keywords), '\s+')) w
      WHERE w <> '' AND position(w IN lower(NEW.title || ' ' || NEW.title_ar || ' ' || NEW.category)) = 0));
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_saved_searches() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER listings_notify_saved_searches AFTER INSERT OR UPDATE OF status ON public.listings FOR EACH ROW EXECUTE FUNCTION public.notify_saved_searches();