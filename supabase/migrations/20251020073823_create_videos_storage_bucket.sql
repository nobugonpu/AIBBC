/*
  # Create Videos Storage Bucket and Policies

  1. Storage Bucket
    - Create `videos` bucket with public access enabled
    - Set 100MB file size limit for video files
    - Allow common video mime types (mp4, webm, mov, avi)
  
  2. Storage Policies
    - Allow authenticated users to upload videos to their own folder
    - Allow authenticated users to view their own videos
    - Allow authenticated users to delete their own videos
    - Allow public read access to all videos in the bucket

  3. Security
    - Users can only upload to folders matching their user ID
    - Users can only delete their own videos
    - Anyone can read videos (public bucket)
*/

-- Create the videos storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'videos',
  'videos',
  true,
  104857600, -- 100MB limit
  ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/avi']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for videos bucket

-- Allow authenticated users to upload videos to their own folder (user_id/*)
CREATE POLICY "Users can upload own videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'videos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to view their own videos
CREATE POLICY "Users can view own videos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'videos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to all videos (since bucket is public)
CREATE POLICY "Public can view all videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'videos');

-- Allow authenticated users to update their own videos
CREATE POLICY "Users can update own videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'videos' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'videos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own videos
CREATE POLICY "Users can delete own videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'videos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
