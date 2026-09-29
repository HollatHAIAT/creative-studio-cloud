CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '' CHECK (char_length(display_name) <= 80),
  phone text NOT NULL DEFAULT '' CHECK (char_length(phone) <= 30),
  avatar_url text NOT NULL DEFAULT '' CHECK (char_length(avatar_url) <= 500),
  bio text NOT NULL DEFAULT '' CHECK (char_length(bio) <= 1500),
  bio_ar text NOT NULL DEFAULT '' CHECK (char_length(bio_ar) <= 1500),
  city text NOT NULL DEFAULT '' CHECK (char_length(city) <= 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.shipping_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '' CHECK (char_length(label) <= 40),
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 120),
  phone text NOT NULL DEFAULT '' CHECK (char_length(phone) <= 30),
  line1 text NOT NULL CHECK (char_length(line1) BETWEEN 1 AND 200),
  line2 text NOT NULL DEFAULT '' CHECK (char_length(line2) <= 200),
  city text NOT NULL CHECK (char_length(city) BETWEEN 1 AND 80),
  region text NOT NULL DEFAULT '' CHECK (char_length(region) <= 80),
  postal_code text NOT NULL DEFAULT '' CHECK (char_length(postal_code) <= 20),
  country text NOT NULL DEFAULT 'Saudi Arabia' CHECK (char_length(country) <= 60),
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_addresses TO authenticated;
GRANT ALL ON public.shipping_addresses TO service_role;
ALTER TABLE public.shipping_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own addresses" ON public.shipping_addresses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.seller_payout_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  account_holder text NOT NULL CHECK (char_length(account_holder) BETWEEN 1 AND 120),
  bank_name text NOT NULL CHECK (char_length(bank_name) BETWEEN 1 AND 120),
  iban text NOT NULL CHECK (iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$'),
  swift text NOT NULL DEFAULT '' CHECK (swift = '' OR swift ~ '^[A-Z0-9]{8}([A-Z0-9]{3})?$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_payout_accounts TO authenticated;
GRANT ALL ON public.seller_payout_accounts TO service_role;
ALTER TABLE public.seller_payout_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own payout account" ON public.seller_payout_accounts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins read payout accounts" ON public.seller_payout_accounts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER addresses_touch BEFORE UPDATE ON public.shipping_addresses FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER payout_touch BEFORE UPDATE ON public.seller_payout_accounts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Only one default address per user.
CREATE OR REPLACE FUNCTION public.one_default_address() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_default THEN UPDATE public.shipping_addresses SET is_default = false WHERE user_id = NEW.user_id AND id <> NEW.id AND is_default; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER addresses_one_default AFTER INSERT OR UPDATE OF is_default ON public.shipping_addresses FOR EACH ROW WHEN (NEW.is_default) EXECUTE FUNCTION public.one_default_address();

-- Avatars: public read, each user writes only inside their own folder.
CREATE POLICY "Avatar public read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Avatar own upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Avatar own update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Avatar own delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);