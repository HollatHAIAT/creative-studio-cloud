REVOKE ALL ON public.supplier_accounts FROM anon;
GRANT SELECT (user_id, name, name_ar, city, city_ar, about, about_ar, status, created_at) ON public.supplier_accounts TO anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.supplier_products FROM anon;