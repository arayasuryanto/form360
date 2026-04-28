-- Storage policies for form-images bucket
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public read form-images" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated upload to form-images" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated update own form-images" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated delete own form-images" ON storage.objects;
END $$;

CREATE POLICY "Public read form-images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'form-images');

CREATE POLICY "Authenticated upload to form-images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'form-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated update own form-images"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'form-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated delete own form-images"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'form-images' AND auth.uid() IS NOT NULL);
