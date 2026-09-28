INSERT INTO public.listings (id, title, title_ar, creator_id, category, status, price) VALUES
 ('sadu-bands', 'Sadu Bands', 'أشرطة السدو', 'noor-al-sayed', 'Sadu', 'published', 1800),
 ('asir-colours', 'Colours of Asir', 'ألوان عسير', 'layla-haddad', 'Qatt', 'published', 2600),
 ('najd-vessel', 'Najd Vessel', 'جرّة نجدية', 'omar-rahman', 'Pottery', 'published', 950)
ON CONFLICT (id) DO NOTHING;