/*
  # Create company names table for Japanese search

  1. New Tables
    - `company_names`
      - `id` (uuid, primary key)
      - `ticker` (text, not null) - 4-digit stock code
      - `name_ja` (text, not null) - Japanese company name
      - `name_kana` (text) - Katakana reading
      - `name_en` (text) - English name
      - `created_at` (timestamptz)
  
  2. Security
    - Enable RLS on `company_names` table
    - Add policy for public read access
  
  3. Extensions & Indexes
    - Enable pg_trgm extension for fuzzy text search
    - Create indexes for efficient search on Japanese names
*/

-- Enable pg_trgm extension first
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS company_names (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL,
  name_ja text NOT NULL,
  name_kana text,
  name_en text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE company_names ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for company names"
  ON company_names
  FOR SELECT
  TO public
  USING (true);

CREATE INDEX IF NOT EXISTS idx_company_names_ticker ON company_names(ticker);
CREATE INDEX IF NOT EXISTS idx_company_names_ja ON company_names USING gin(name_ja gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_company_names_kana ON company_names USING gin(name_kana gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_company_names_en ON company_names USING gin(name_en gin_trgm_ops);

-- Insert popular Japanese companies
INSERT INTO company_names (ticker, name_ja, name_kana, name_en) VALUES
  ('7203', 'トヨタ自動車', 'トヨタジドウシャ', 'Toyota Motor'),
  ('6758', 'ソニーグループ', 'ソニーグループ', 'Sony Group'),
  ('9984', 'ソフトバンクグループ', 'ソフトバンクグループ', 'SoftBank Group'),
  ('6861', 'キーエンス', 'キーエンス', 'Keyence'),
  ('8306', '三菱UFJフィナンシャル・グループ', 'ミツビシユーエフジェイフィナンシャルグループ', 'Mitsubishi UFJ Financial Group'),
  ('7974', '任天堂', 'ニンテンドウ', 'Nintendo'),
  ('9433', 'KDDI', 'ケイディーディーアイ', 'KDDI'),
  ('9432', '日本電信電話', 'ニッポンデンシンデンワ', 'NTT'),
  ('8058', '三菱商事', 'ミツビシショウジ', 'Mitsubishi Corporation'),
  ('7267', '本田技研工業', 'ホンダギケンコウギョウ', 'Honda Motor'),
  ('6502', '東芝', 'トウシバ', 'Toshiba'),
  ('6501', '日立製作所', 'ヒタチセイサクショ', 'Hitachi'),
  ('8001', '伊藤忠商事', 'イトウチュウショウジ', 'Itochu'),
  ('8031', '三井物産', 'ミツイブッサン', 'Mitsui & Co'),
  ('4063', '信越化学工業', 'シンエツカガクコウギョウ', 'Shin-Etsu Chemical'),
  ('4502', '武田薬品工業', 'タケダヤクヒンコウギョウ', 'Takeda Pharmaceutical'),
  ('4503', 'アステラス製薬', 'アステラスセイヤク', 'Astellas Pharma'),
  ('6902', 'デンソー', 'デンソー', 'Denso'),
  ('7201', '日産自動車', 'ニッサンジドウシャ', 'Nissan Motor'),
  ('8035', '東京エレクトロン', 'トウキョウエレクトロン', 'Tokyo Electron'),
  ('9020', '東日本旅客鉄道', 'ヒガシニホンリョカクテツドウ', 'JR East'),
  ('9022', '東海旅客鉄道', 'トウカイリョカクテツドウ', 'JR Central'),
  ('4568', '第一三共', 'ダイイチサンキョウ', 'Daiichi Sankyo'),
  ('6098', 'リクルートホールディングス', 'リクルートホールディングス', 'Recruit Holdings'),
  ('6273', 'SMC', 'エスエムシー', 'SMC'),
  ('8766', '東京海上ホールディングス', 'トウキョウカイジョウホールディングス', 'Tokio Marine Holdings'),
  ('8411', 'みずほフィナンシャルグループ', 'ミズホフィナンシャルグループ', 'Mizuho Financial Group'),
  ('8316', '三井住友フィナンシャルグループ', 'ミツイスミトモフィナンシャルグループ', 'Sumitomo Mitsui Financial Group'),
  ('4911', '資生堂', 'シセイドウ', 'Shiseido'),
  ('2914', '日本たばこ産業', 'ニホンタバコサンギョウ', 'Japan Tobacco')
ON CONFLICT DO NOTHING;