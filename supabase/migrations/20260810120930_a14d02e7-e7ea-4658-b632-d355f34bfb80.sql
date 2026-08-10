CREATE POLICY "Anyone can read memory files" ON storage.objects FOR SELECT USING (bucket_id = 'memories');
CREATE POLICY "Anyone can upload memory files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'memories');
CREATE POLICY "Anyone can delete memory files" ON storage.objects FOR DELETE USING (bucket_id = 'memories');