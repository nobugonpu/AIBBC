/*
  # Update Photos Bucket to Support Video Files

  1. Changes
    - Update the `photos` storage bucket to accept video MIME types
    - Add support for MP4, WebM, and MOV (QuickTime) video formats
    - Increase file size limit to 100MB to accommodate video files

  2. Supported MIME Types
    - Images: image/jpeg, image/jpg, image/png, image/gif, image/webp
    - Videos: video/mp4, video/webm, video/quicktime

  3. Notes
    - The bucket remains public for easy access
    - Storage policies remain unchanged (users can only upload/delete their own files)
*/

-- Update the photos bucket to support video MIME types and increase size limit
UPDATE storage.buckets
SET 
  allowed_mime_types = ARRAY[
    'image/jpeg', 
    'image/jpg', 
    'image/png', 
    'image/gif', 
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ],
  file_size_limit = 104857600  -- 100MB limit for video files
WHERE id = 'photos';
