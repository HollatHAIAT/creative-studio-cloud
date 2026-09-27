CREATE POLICY "Sellers upload own artwork images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'artwork-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Sellers read own artwork images" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'artwork-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Sellers delete own artwork images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'artwork-images' AND (storage.foldername(name))[1] = auth.uid()::text);