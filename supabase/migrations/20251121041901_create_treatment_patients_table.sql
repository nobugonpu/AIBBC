/*
  # Create treatment patients table

  1. New Tables
    - `treatment_patients`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `patient_name` (text) - 患者名
      - `treatment_type` (text) - 'lu-psma' or 'lutetium'
      - `start_date` (date) - 治療開始日
      - `cycles_planned` (integer) - 予定サイクル数
      - `cycles_completed` (integer) - 完了サイクル数
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `treatment_cycles`
      - `id` (uuid, primary key)
      - `patient_id` (uuid, foreign key to treatment_patients)
      - `cycle_number` (integer) - サイクル番号
      - `scheduled_date` (date) - 予定日
      - `admission_date` (date) - 入院日
      - `discharge_date` (date) - 退院日
      - `status` (text) - 'scheduled', 'completed', 'cancelled'
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own data
*/

CREATE TABLE IF NOT EXISTS treatment_patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  patient_name text NOT NULL,
  treatment_type text NOT NULL CHECK (treatment_type IN ('lu-psma', 'lutetium')),
  start_date date NOT NULL,
  cycles_planned integer NOT NULL CHECK (cycles_planned > 0),
  cycles_completed integer DEFAULT 0 CHECK (cycles_completed >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS treatment_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES treatment_patients(id) ON DELETE CASCADE NOT NULL,
  cycle_number integer NOT NULL CHECK (cycle_number > 0),
  scheduled_date date NOT NULL,
  admission_date date NOT NULL,
  discharge_date date NOT NULL,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE treatment_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own patients"
  ON treatment_patients FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own patients"
  ON treatment_patients FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own patients"
  ON treatment_patients FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own patients"
  ON treatment_patients FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view cycles of own patients"
  ON treatment_cycles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM treatment_patients
      WHERE treatment_patients.id = treatment_cycles.patient_id
      AND treatment_patients.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert cycles for own patients"
  ON treatment_cycles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM treatment_patients
      WHERE treatment_patients.id = treatment_cycles.patient_id
      AND treatment_patients.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update cycles of own patients"
  ON treatment_cycles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM treatment_patients
      WHERE treatment_patients.id = treatment_cycles.patient_id
      AND treatment_patients.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM treatment_patients
      WHERE treatment_patients.id = treatment_cycles.patient_id
      AND treatment_patients.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete cycles of own patients"
  ON treatment_cycles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM treatment_patients
      WHERE treatment_patients.id = treatment_cycles.patient_id
      AND treatment_patients.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_treatment_patients_user_id ON treatment_patients(user_id);
CREATE INDEX IF NOT EXISTS idx_treatment_patients_start_date ON treatment_patients(start_date);
CREATE INDEX IF NOT EXISTS idx_treatment_cycles_patient_id ON treatment_cycles(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatment_cycles_scheduled_date ON treatment_cycles(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_treatment_cycles_admission_discharge ON treatment_cycles(admission_date, discharge_date);
