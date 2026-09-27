DROP POLICY IF EXISTS "Anyone reads published listings" ON public.listings;
CREATE POLICY "Public reads published listings" ON public.listings FOR SELECT TO anon USING (status = 'published');
CREATE POLICY "Members read published, own or staff listings" ON public.listings FOR SELECT TO authenticated USING (status = 'published' OR owner_user_id = auth.uid() OR public.is_staff(auth.uid()));