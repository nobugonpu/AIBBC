/*
  # Create Storage Bucket and Policies

  1. Storage Bucket
    - Create `photos` bucket with public access enabled
    - This allows public read access to uploaded photos
  
  2. Storage Policies
    - Allow authenticated users to upload photos to their own folder
    - Allow authenticated users to view their own photos
    - Allow authenticated users to delete their own photos
    - Allow public read access to all photos in the bucket

  3. Security
    - Users can only upload to folders matching their user ID
    - Users can only delete their own photos
    - Anyone can read photos (public bucket)
*/

-- Create the photos storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos',
  'photos',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for photos bucket

-- Allow authenticated users to upload photos to their own folder (user_id/*)
CREATE POLICY "Users can upload own photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to view their own photos
CREATE POLICY "Users can view own photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to all photos (since bucket is public)
CREATE POLICY "Public can view all photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'photos');

-- Allow authenticated users to update their own photos
CREATE POLICY "Users can update own photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own photos
CREATE POLICY "Users can delete own photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);