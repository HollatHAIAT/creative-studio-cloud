ALTER POLICY "Public reads active suppliers" ON public.supplier_accounts TO authenticated;
ALTER POLICY "Public reads published products of active suppliers" ON public.supplier_products TO authenticated;
CREATE POLICY "Visitors read active suppliers" ON public.supplier_accounts FOR SELECT TO anon USING (status = 'active');
CREATE POLICY "Visitors read published products of active suppliers" ON public.supplier_products FOR SELECT TO anon
  USING (status = 'published' AND EXISTS (SELECT 1 FROM public.supplier_accounts s WHERE s.user_id = supplier_products.supplier_id AND s.status = 'active'));