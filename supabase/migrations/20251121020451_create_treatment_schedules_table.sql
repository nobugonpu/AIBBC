/*
  # 治療スケジュールテーブルの作成

  1. 新しいテーブル
    - `treatment_schedules`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `schedule_name` (text) - スケジュール名
      - `total_days_available` (integer) - 特別措置病室の使用可能日数
      - `period_days` (integer) - 計算期間（日数）
      - `lu_psma_count` (integer) - Lu-PSMA-617の投与回数
      - `lutetium_count` (integer) - ルタテラの投与回数
      - `total_days_used` (integer) - 使用日数合計
      - `schedule_data` (jsonb) - スケジュールの詳細データ
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. セキュリティ
    - RLSを有効化
    - ユーザーは自分のスケジュールのみ閲覧可能
    - ユーザーは自分のスケジュールのみ作成・更新・削除可能
*/

CREATE TABLE IF NOT EXISTS treatment_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  schedule_name text NOT NULL DEFAULT '',
  total_days_available integer NOT NULL DEFAULT 13,
  period_days integer NOT NULL DEFAULT 90,
  lu_psma_count integer NOT NULL DEFAULT 0,
  lutetium_count integer NOT NULL DEFAULT 0,
  total_days_used integer NOT NULL DEFAULT 0,
  schedule_data jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE treatment_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own schedules"
  ON treatment_schedules
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own schedules"
  ON treatment_schedules
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own schedules"
  ON treatment_schedules
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own schedules"
  ON treatment_schedules
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_treatment_schedules_user_id ON treatment_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_treatment_schedules_created_at ON treatment_schedules(created_at DESC);
