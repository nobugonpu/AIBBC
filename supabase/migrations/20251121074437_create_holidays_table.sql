/*
  # Create holidays table

  1. New Tables
    - `holidays`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `holiday_date` (date) - 祝日
      - `holiday_name` (text) - 祝日名
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on holidays table
    - Add policies for authenticated users to manage their own holidays
*/

CREATE TABLE IF NOT EXISTS holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  holiday_date date NOT NULL,
  holiday_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own holidays"
  ON holidays FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own holidays"
  ON holidays FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own holidays"
  ON holidays FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own holidays"
  ON holidays FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_holidays_user_id ON holidays(user_id);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(holiday_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_holidays_user_date ON holidays(user_id, holiday_date);
