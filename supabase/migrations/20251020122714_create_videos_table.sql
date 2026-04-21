/*
  # Create Videos Table

  1. New Tables
    - `videos`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `video_url` (text, public URL of the video)
      - `storage_path` (text, path in storage bucket)
      - `description` (text, optional user description)
      - `thumbnail_url` (text, optional thumbnail URL)
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `videos` table
    - Users can only view, insert, update, and delete their own videos

  3. Important Notes
    - Videos table structure similar to photos table for consistency
    - Storage bucket for videos already exists from previous migration
*/

-- Create videos table
CREATE TABLE IF NOT EXISTS videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  video_url text NOT NULL,
  storage_path text NOT NULL,
  description text DEFAULT '',
  thumbnail_url text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for videos table
CREATE POLICY "Users can view own videos"
  ON videos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own videos"
  ON videos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own videos"
  ON videos FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own videos"
  ON videos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
