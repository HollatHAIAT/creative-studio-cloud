DROP POLICY "Anyone reads published content" ON public.cms_entries;
CREATE POLICY "Anyone reads published content" ON public.cms_entries FOR SELECT TO anon, authenticated USING (published);
CREATE POLICY "Admins read all content" ON public.cms_entries FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));