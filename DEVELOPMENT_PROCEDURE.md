# RI内用療法管理デスクトップアプリ 開発手順書

**対象**: bolt.new で生成した `RI-treatment` リポジトリを基に、RI 内用療法（Pluvicto / Lutathera 等）の
患者スケジュール管理・IDAC-DOSE 被ばく管理・画像レポート AI 所見を統合するデスクトップアプリを
Warp + 複数 Claude エージェントで開発する。

**基本方針**
- モジュラー設計で並列開発を可能にする
- 各エージェントに渡すコンテキストを最小化してトークン消費を抑える
- 各フェーズ完了時に必ずチェック（型チェック・テスト・起動確認）
- 医療データを扱うため、暗号化・監査ログ・オフライン動作を前提

---

## 0. 前提条件

| 項目 | 要件 |
|---|---|
| OS | Windows 10/11（院内PC想定）または macOS |
| ランタイム | Node.js 20 LTS / Rust（Tauri採用時） / Python 3.11 |
| エディタ | Warp Terminal + VSCode |
| AI | Claude API キー（AI 所見生成用） |
| 外部ツール | IDAC-DOSE（ローカルインストール） |

---

## 1. 推奨技術スタック（確定してから実装開始）

| レイヤ | 推奨 | 理由 |
|---|---|---|
| デスクトップシェル | **Tauri 2** | バイナリ小・セキュア・医療用途に最適 |
| フロント | React 18 + TypeScript + Vite | bolt.new 出力と親和性が高い |
| UI | shadcn/ui + Tailwind | bolt.new デフォルト、再利用しやすい |
| 状態管理 | Zustand（軽量）+ TanStack Query | 学習コスト低 |
| ローカル DB | SQLite + **SQLCipher** | 暗号化必須（患者個人情報） |
| ORM | Drizzle ORM | 型安全・軽量 |
| Python 連携 | Tauri sidecar（IDAC-DOSE 呼び出し・DICOM 処理・AI 前処理） | 既存 Python 資産を再利用 |
| AI | Claude API（`claude-opus-4-7` or `claude-sonnet-4-6`） | 所見生成・画像テキスト解釈 |
| テスト | Vitest + Playwright + pytest | 3 層カバー |

> Electron を選ぶ場合は Tauri 項を読み替え。ただしバイナリ容量が 10 倍になる点に注意。

---

## 2. モジュール分割（並列開発の単位）

ディレクトリ構成は以下。**各モジュールに独立した `CLAUDE.md` を置き**、エージェントには
そのモジュールだけを見せる（＝ トークン削減の最重要ポイント）。

```
RI-treatment/
├── CLAUDE.md                    # 全体方針（50 行以内に収める）
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DATA_MODEL.md
│   └── SECURITY.md
├── src/
│   ├── modules/
│   │   ├── patient/             # M1: 患者管理
│   │   ├── schedule/            # M2: スケジュール管理
│   │   ├── dosimetry/           # M3: IDAC-DOSE 連携・腎線量管理
│   │   ├── imaging/             # M4: 画像レポート取り込み
│   │   ├── ai-findings/         # M5: Claude による AI 所見
│   │   └── audit/               # M6: 監査ログ・バックアップ
│   ├── shared/
│   │   ├── types/               # 全モジュール共通の TypeScript 型
│   │   ├── db/                  # Drizzle schema・migration
│   │   ├── ui/                  # 共通コンポーネント
│   │   └── ipc/                 # Tauri コマンド定義
│   └── app/                     # ルーティング・統合
├── src-tauri/                   # Rust 側（必要最小限）
├── python/                      # IDAC-DOSE ラッパー・画像処理
├── tests/
└── package.json
```

### モジュール責務

| ID | モジュール | 責務 | 主な依存 |
|---|---|---|---|
| M1 | patient | 患者基本情報 CRUD、検索、暗号化保存 | shared/db, shared/types |
| M2 | schedule | 投与スケジュール、カレンダー、リマインダ、サイクル管理 | M1 |
| M3 | dosimetry | IDAC-DOSE 実行、腎線量計算、累積線量追跡、閾値警告 | M1, M2, python/ |
| M4 | imaging | DICOM/PDF レポート取り込み、OCR、メタデータ抽出 | M1, python/ |
| M5 | ai-findings | Claude API 呼び出し、所見生成、バージョニング、手動修正 | M4 |
| M6 | audit | 操作ログ、エクスポート、バックアップ、ユーザー認証 | 全モジュール |

### 2.1 モジュール境界ルール（厳格遵守）

**目的**: 壊れにくさと並列開発の両立。違反は Lint / CI で機械的に検出する。

1. **公開 API のみ外部利用可**
   各モジュールは `src/modules/<name>/index.ts`（= 公開入口）からのみ外部参照を許可する。
   それ以外の内部ファイル（`internal/`, `impl/` 等）は外部から import 禁止。
2. **他モジュール内部実装への直接参照を禁止**
   例: `import { foo } from "modules/patient/internal/xxx"` は NG。
   ESLint ルール `no-restricted-imports` + `eslint-plugin-boundaries` で強制。
3. **共通型・共通契約は `shared/contracts/` に集約**
   - `shared/contracts/types/` … DTO・エンティティ型
   - `shared/contracts/ipc/` … Tauri コマンド名・引数・戻り値・エラー型
   - `shared/contracts/events/` … モジュール間イベント
4. **`shared/` は純粋共通資産のみ**
   業務ロジックは置かない。UI プリミティブ、ユーティリティ、契約、DB 基盤のみ。
   「どこに置くか迷う」ものは、新規モジュールを立てるか、該当モジュール内に置く。
5. **DB アクセスは Repository 層経由に限定**
   - 各モジュールに `repository.ts` を置き、Drizzle クエリはここに閉じ込める
   - UI / サービス層は Repository のメソッドのみ呼び出す
   - 生 SQL・生 Drizzle は Repository 外で禁止
6. **モジュール間の循環依存を禁止**
   - `madge --circular src/` を CI で実行し、循環検出で fail
   - 依存方向: `app → modules/* → shared/contracts → shared/*`（shared は最下層）
7. **外部参照は公開入口ファイル経由**
   モジュール間呼び出しは必ず `modules/<name>` で import。深いパスは禁止。

**ESLint 設定例**（`shared/contracts` とモジュール `index` 経由のみ許可）:
```js
// eslint.config.js 抜粋
"no-restricted-imports": ["error", {
  patterns: [
    { group: ["modules/*/internal/*", "modules/*/impl/*", "modules/*/repository"],
      message: "モジュール内部への直接参照禁止。公開 index 経由で参照すること。" },
    { group: ["shared/!(contracts|ui|db|ipc)/**"],
      message: "shared には共通資産のみ。業務ロジックはモジュールへ。" }
  ]
}]
```

**ディレクトリ命名規約**:
```
src/modules/<name>/
  ├── index.ts            # 公開 API のみ re-export
  ├── repository.ts       # DB アクセス（このモジュールのみが触る）
  ├── service.ts          # 業務ロジック
  ├── ui/                 # このモジュール固有の画面
  └── internal/           # 外部から import 禁止
```

---

## 3. 開発フェーズ（推奨順序）

各フェーズの終わりに **必ず「チェックコマンド」を実行**して壊れていないことを確認してから次へ。

### Phase 0 — 既存リポジトリの取り込み（1 エージェント、短時間）

**目的**: bolt.new の出力を確認し、このリポジトリに統合する。

```bash
# Warp の Agent 1 に実行させる
git clone <bolt.new の RI-treatment URL> /tmp/ri-src
rsync -a --exclude .git /tmp/ri-src/ /home/user/AIBBC/
git add -A && git commit -m "chore: import bolt.new scaffold"
```

**チェック**: `npm install && npm run dev` でアプリが起動すること。

---

### Phase 1 — アーキテクチャ確定（1 エージェント、最重要）

**目的**: 以降の全エージェントが参照する「契約」を確定。ここで時間をかけることで、後段のトークンが激減する。

**成果物**（この順で作成）:
1. `CLAUDE.md`（全体、50 行以内）
2. `docs/ARCHITECTURE.md`（モジュール図・データフロー）
3. `docs/DATA_MODEL.md`（DB スキーマ・ER 図）
4. `docs/SECURITY.md`（暗号化方式・監査要件）
5. `src/shared/types/*.ts`（全モジュールの I/O 型定義）
6. `src/shared/ipc/contracts.ts`（Tauri コマンド定義のスタブ）

**チェック**: `npx tsc --noEmit` が通ること。

> **ポイント**: この Phase の出力だけが以降のエージェントに共有される。
> 実装は一切書かない。**型とドキュメントのみ**。

---

### Phase 2 — 共通基盤構築（1 エージェント）

**目的**: 全モジュールが使う共通部品を先に完成させる。

- `src/shared/db/schema.ts`（Drizzle スキーマ、暗号化キー起動時取得）
- `src/shared/db/migrations/`
- `src/shared/ui/`（Button, Dialog, Table, DateRangePicker 等）
- `src/shared/ipc/`（Tauri コマンドの実装スケルトン）
- `python/bridge.py`（Tauri sidecar の入口、サブコマンドルーティングのみ）

**チェック**:
```bash
npm run build        # Tauri 含めてビルド成功
npm run test:shared  # 共通層のユニットテスト
```

---

### Phase 3 — モジュール並列実装（Warp で N エージェント同時起動）

**目的**: M1〜M6 を並列開発。各エージェントには **そのモジュールフォルダと `shared/` のみ** を
見せる（`.claudeignore` または `--add-dir` で制御）。

#### エージェント投入のコツ（トークン節約）

Warp で複数タブを開き、各タブで以下のプロンプトテンプレを使う:

```
あなたはモジュール {M3: dosimetry} の担当です。
参照可能: src/modules/dosimetry/, src/shared/, docs/DATA_MODEL.md, python/
禁止: 他モジュールの編集

仕様: docs/ARCHITECTURE.md の §dosimetry を参照
契約: src/shared/types/dosimetry.ts, src/shared/ipc/contracts.ts を厳守
終了条件:
  1. npm run test -- modules/dosimetry がグリーン
  2. npx tsc --noEmit がグリーン
  3. CLAUDE.md にそのモジュールの使い方を 20 行以内で記載
```

#### モジュール別の要点

- **M1 patient**: 氏名・ID・体重・腎機能（eGFR）・既往。SQLCipher 暗号化必須。
- **M2 schedule**: 投与日・サイクル番号（通常 4〜6 サイクル）・来院リマインダ・中止判定ロジック。
- **M3 dosimetry**: IDAC-DOSE を Python sidecar 経由で呼び出し、SPECT/CT からの腎線量を取り込み、
  **累積腎線量 23 Gy（Lutathera 添付文書目安）** 等の閾値警告を出す。値はハードコードせず設定化。
- **M4 imaging**: DICOM（pydicom）と PDF レポート（pdfplumber）を読み込み、所見テキスト抽出。
  個人情報は DICOM タグから除去可能に。
- **M5 ai-findings**: M4 の抽出テキストを Claude API に渡し、所見草稿を生成。
  **プロンプトキャッシュ有効化**（system プロンプトを cache_control で固定）でトークン 90% 削減。
  医師の手動編集・承認フローを必須。
- **M6 audit**: 全操作を append-only ログに保存。エクスポート時は暗号化 ZIP。

**Phase 3 全体のチェック**（各エージェント終了時に必ず）:
```bash
npm run lint
npx tsc --noEmit
npm run test
npm run tauri:dev    # 起動確認（エラーログに注目）
```

---

### Phase 4 — 統合（1 エージェント）

**目的**: モジュールをルーティングで繋ぎ、画面遷移を完成。

- `src/app/router.tsx`（患者一覧 → 詳細 → スケジュール → 線量 → 画像 → AI 所見）
- ダッシュボード（今日の投与患者・警告中患者）
- グローバルエラーハンドラ
- 設定画面（API キー・IDAC-DOSE パス・閾値）

**チェック**:
- 起動 → ダミー患者作成 → スケジュール登録 → 線量入力 → 画像取り込み → AI 所見生成 まで一気通貫で動作
- Playwright E2E スモークテスト

---

### Phase 5 — 品質保証（1〜2 エージェント）

**目的**: 医療用途のリスク低減。

- [ ] 全ユニットテスト + カバレッジ 70% 以上
- [ ] Playwright E2E（ハッピーパス + 3 つの異常系）
- [ ] セキュリティレビュー（`/security-review` スラッシュコマンド活用）
- [ ] 個人情報の DB ダンプ検査（平文で出ないこと）
- [ ] オフライン起動確認（Claude API 不通時に AI 所見以外は動作）
- [ ] 監査ログの改ざん耐性確認
- [ ] 閾値警告の境界値テスト（腎線量 22.9 / 23.0 / 23.1 Gy）

---

### Phase 6 — ビルド・配布

```bash
npm run tauri build           # Windows インストーラ / macOS dmg
```

- コード署名（院内配布でも推奨）
- バージョニング（SemVer）
- リリースノートに「医療機器非該当」「研究用途」等の免責を明記

---

## 4. Warp × マルチエージェント運用ルール

### 4.1 タブ割り当て例

| タブ | 担当 | モデル | 備考 |
|---|---|---|---|
| 1 | アーキテクト（Phase 1, 4, 5 統括） | Opus 4.7 | 常駐 |
| 2 | M1 patient | Sonnet 4.6 | Phase 3 |
| 3 | M2 schedule | Sonnet 4.6 | Phase 3 |
| 4 | M3 dosimetry | Opus 4.7 | 計算ロジック重要なので上位モデル |
| 5 | M4 imaging | Sonnet 4.6 | Phase 3 |
| 6 | M5 ai-findings | Opus 4.7 | プロンプト設計重要 |
| 7 | M6 audit | Haiku 4.5 | シンプルなため下位で十分 |
| 8 | QA / E2E | Sonnet 4.6 | Phase 5 |

### 4.2 トークン節約チェックリスト

- [ ] 各エージェントには **モジュールディレクトリ + `shared/` + 該当 docs のみ** を参照許可
- [ ] 全エージェントが `CLAUDE.md`（ルート、50 行以内）と該当モジュールの `CLAUDE.md` を先読み
- [ ] **型とインタフェースを Phase 1 で固定**→ 後続エージェントは仕様書代わりに型定義を読むだけ
- [ ] Claude API を使う箇所（M5）は **プロンプトキャッシュ**（`cache_control: { type: "ephemeral" }`）を有効化
- [ ] コミットは小さく、エージェントは毎回 `git diff` で自分の差分だけ見る
- [ ] 全ログ・全ファイルを見せない。`rg`（ripgrep）で必要箇所のみ検索させる
- [ ] 完了報告は **200 字以内** に制限（プロンプトで指示）
- [ ] 長文ドキュメント生成は 1 回の Phase 1 のみ。以降は差分追記のみ

### 4.3 エージェント間の競合回避

- モジュール境界を跨ぐ変更は **必ずアーキテクト経由**
- `shared/` の変更は Phase 1 とアーキテクトのみ許可
- ブランチ戦略: `feature/m1-patient`, `feature/m2-schedule`... を各エージェント専用に
- 毎日 1 回アーキテクトが `main` にマージ

---

## 5. 合格基準と「変更後チェック」標準セット

各エージェントが作業完了を宣言する前に、以下の **全基準を満たす** こと。
1 つでも未達の場合は完了とせず、その場で修正する。

### 5.1 合格基準（Definition of Done）

| # | 項目 | 合格基準 |
|---|---|---|
| 1 | **Type check** | `tsc --noEmit` 成功、エラー 0 件 |
| 2 | **Lint** | error 0 件、warning は **既存件数以下**。新規セキュリティ警告は禁止 |
| 3 | **Unit / Integration Test** | 主要業務ロジック・異常系・モジュール連携のテストが全件通過 |
| 4 | **Coverage** | 重要モジュール 80% 以上。計算・安全性関連（M3 dosimetry 等）は 90% 以上 |
| 5 | **Build** | dev / prod build、Tauri bundle がすべて成功 |
| 6 | **Startup** | 初回起動 / 再起動 / オフライン起動 / 設定欠損時起動 が成功 |
| 7 | **Data Safety** | ログ・例外・一時ファイル・キャッシュに個人情報/医療情報を平文出力しない |
| 8 | **Failure Handling** | 外部 API 失敗 / DB 異常 / 入力異常時に安全に失敗し、ユーザーへ説明可能なエラーを表示 |

### 5.2 実行コマンド（この順で全て成功）

```bash
# 1. 型チェック
npx tsc --noEmit

# 2. Lint（新規警告は 0）
npm run lint -- --max-warnings=$(cat .lint-baseline 2>/dev/null || echo 0)

# 3. 循環依存チェック
npx madge --circular src/

# 4. ユニット + 結合テスト
npm run test

# 5. カバレッジ（しきい値で fail する設定）
npm run test:coverage

# 6. ビルド（dev + prod + Tauri bundle）
npm run build
npm run tauri build --debug

# 7. 起動スモーク（4 パターン）
npm run smoke:first-run      # 初回起動
npm run smoke:restart        # 再起動
npm run smoke:offline        # オフライン起動
npm run smoke:missing-config # 設定欠損時

# 8. データ漏洩チェック（DB / ログ / 一時ファイル）
npm run check:data-safety
# 内部で以下を実行:
#   sqlite3 data.db ".dump" | grep -iE "<PII パターン>" → ヒットなし
#   grep -r "<PII パターン>" logs/ tmp/ .cache/        → ヒットなし
```

> 失敗した場合は **その場で修正**し、緑になるまで完了宣言しない。
> CI でも同じコマンドを実行し、PR マージの必須チェックに設定する。

---

## 6. E2E・回帰シナリオ（主要業務フロー）

**目的**: ユニットテストでは検出できない画面・状態管理・DB・画像・AI・永続化の**連携不整合**を捕捉する。
以下 8 シナリオを **回帰シナリオとして固定**し、統合前および変更後に毎回実施する（Playwright で自動化）。

### 6.1 主要シナリオ（各シナリオで正常系 + 異常系）

| # | シナリオ | 正常系で確認 | 異常系で確認 |
|---|---|---|---|
| S1 | 新規患者登録 | 入力→保存→一覧反映→再起動後も存在 | 必須欠落 / 型不正 / 文字数超過 / 重複 ID |
| S2 | 既存データ読込 | 患者詳細表示・関連データ（予定・線量・画像）が一括表示 | DB 欠損 / 部分破損 / マイグレーション未適用 |
| S3 | スケジュール編集 | サイクル編集・リマインダ反映・衝突検出 | 過去日入力 / 範囲外 / 並行編集競合 |
| S4 | 線量計算 | IDAC-DOSE 実行→腎線量取得→累積反映→閾値警告 | sidecar 失敗 / 入力単位不正 / 計算タイムアウト |
| S5 | 画像表示 | DICOM/PDF 読込→メタデータ抽出→サムネイル | ファイル欠損 / 破損 / 権限不足 / 巨大ファイル |
| S6 | AI 所見生成 | 抽出テキスト→Claude 呼出→草稿表示→医師承認 | API 失敗 / 空応答 / タイムアウト / キャンセル |
| S7 | 保存後の再読込 | 全シナリオ後にアプリ再起動→データ・状態が完全復元 | 保存失敗 / 中間状態 / 破損検知 |
| S8 | エラー発生時の復旧 | キャッシュ破棄・再試行・安全な代替操作 | 連続失敗 / バックアップ復元 / 監査記録継続 |

### 6.2 合格条件

- **主要データが正しく保持される**（再起動・再読込で復元）
- **アプリが異常終了しない**（クラッシュ 0 件）
- **失敗時も再試行または安全な代替操作が可能**
- **異常終了を検出した場合は監査ログに記録され、次回起動時に通知される**

### 6.3 実行タイミング

| タイミング | 実施範囲 |
|---|---|
| 各モジュール完了時 | 関連シナリオのみ（例: M3 完了 → S4, S7） |
| Phase 4 統合時 | 全 8 シナリオ |
| リリース前 | 全 8 シナリオ × 全対象 OS |
| 依存ライブラリ更新時 | 全 8 シナリオ |
| DB スキーマ変更時 | S2, S7 + §8 の旧 DB 移行確認 |

```bash
# 実行コマンド
npm run e2e                    # 全シナリオ
npm run e2e -- --grep "S4|S7"  # 特定シナリオのみ
npm run e2e:abnormal           # 異常系のみ
```

---

## 7. Tauri 特有の確認項目

Tauri の React ↔ Rust 境界、ファイルアクセス、DB 暗号化、OS 差異による不具合を事前に潰す。

### 7.1 React–Rust インターフェース整合

- invoke する **コマンド名・引数名・型・戻り値・エラー形式**がフロントと Rust 実装で一致
- `shared/contracts/ipc/` を **単一情報源**（single source of truth）とし、Rust 側は `ts-rs` / `specta` で型生成、またはスキーマから Rust 構造体を自動生成
- 契約変更時は両側を同一 PR で更新（片側だけの変更を CI で禁止）

### 7.2 コマンド引数バリデーション

各 Rust command は **入り口で必ず検証**し、不正入力時に安全なエラーを返す:
- 必須項目欠落 / 型不正 / 範囲外値 / 不正パス / 文字数超過 / エンコーディング異常
- 検証失敗時は `Result<T, AppError>` で返し、UI 側は説明可能なメッセージを表示
- `serde` + `validator` crate でスキーマ検証を一元化

### 7.3 ファイルアクセス権限

- 読み書き対象ディレクトリを `tauri.conf.json` の `allowlist` で **必要最小限に制限**
- 患者データ領域・ログ領域・キャッシュ領域を明確に分離
- 権限不足時も異常終了せず、ユーザーに説明可能なエラーを表示（リトライ手順付き）
- パストラバーサル（`../`）は Rust 側で必ずチェック

### 7.4 ローカル DB 暗号化（詳細は §8）

- DB ファイルが **平文で読めない**ことを確認（`strings db.sqlite | grep` で PII 検出なし）
- **鍵なし / 誤鍵で開けない**ことを確認
- **ログ・一時ファイル・クラッシュダンプ・バックアップに鍵や機微情報が残らない**ことを確認
- アプリ終了時に一時復号領域をゼロクリア

### 7.5 OS 別ビルド確認

対象 OS（Windows 10/11, macOS 12+）ごとに以下を確認:
- build / bundle が成功
- 起動 / 保存 / 読込 / 画像表示 / 設定保存 / 印刷 / バックアップ が正常動作
- 署名・公証（macOS は notarization）
- 日本語パス・日本語ファイル名・全角空白を含むデータで動作

```bash
# CI マトリクス例
os: [windows-latest, macos-latest]
node: [20]
```

### 7.6 既存データ互換性

- **旧バージョン DB および設定ファイルを新バージョンで読める**
- migration が **安全に実行**され、失敗時に **バックアップまたはロールバック**可能
- 詳細手順は §8 を参照

---

## 8. DB 変更手順（高リスク作業の標準化）

DB スキーマ変更はコード変更と同等以上に高リスク。必ず以下を **全工程実施**する。

### 8.1 Migration

- スキーマ変更ごとに **schema version を更新**（`meta.schema_version` テーブルで管理）
- migration は **順序付き**で **一度だけ**実行される仕組み（Drizzle migrator 等）
- カラム追加 / 名称変更 / 型変更 / テーブル再編時は **既存データ変換を明示**（変換 SQL と検証クエリをセット）
- migration 実行 **前に必ずバックアップ**を取得
- schema version の更新は **migration 成功後**に commit（同一トランザクション内）

### 8.2 旧 DB 移行確認

- **新規 DB だけでなく、旧バージョン DB を用いた移行テストを必須化**
- 確認対象:
  - 直前バージョンの DB
  - 主要リリース時点（`v0.1.0`, `v0.5.0` 等）の DB
- テスト用 DB を `tests/fixtures/db/` に複数バージョン保存（暗号化状態も含む）
- 移行後に以下を照合:
  - 件数（全テーブル）
  - 主要項目のサンプリング検証
  - 画像参照の整合（孤立参照なし）
  - 監査情報の連続性

### 8.3 Backup / Restore

- migration 前に **暗号化状態を保ったバックアップ**を取得
- 復元手順を `docs/BACKUP_RESTORE.md` に文書化
- **定期的に復元試験**を実施（月次推奨、CI にも組込み）
- DB 本体に加え、以下も保全対象:
  - 画像ファイル / PDF レポート
  - 設定ファイル
  - 監査ログ
  - 鍵参照情報（鍵本体は別管理）

### 8.4 Key Management（鍵管理）

- SQLCipher の暗号鍵を **ソースコードへ埋め込まない**
- 鍵の **保管先・取得方法・権限・更新手順を明文化**（`docs/SECURITY.md`）
- 推奨: OS キーチェーン（Windows Credential Manager / macOS Keychain）に保存
- アプリ起動時に OS から取得し、メモリ上のみで保持（ディスク書き出し禁止）
- **鍵更新時は再暗号化後の読込確認**を必須
- **ログ・一時ファイル・クラッシュ情報へ鍵を出力しない**（静的解析ルール + ランタイム検証）

### 8.5 Rollback

- migration 失敗時は **バックアップから復元可能**
- 途中失敗で **中間状態を残さない**（トランザクション + 2-phase commit パターン）
- 復元後に **アプリ起動・主要データ読込・整合性確認** を実施
- ロールバック結果を監査ログへ記録

### 8.6 チェックリスト（DB 変更時の必須工程）

- [ ] schema version 番号を決定・記録
- [ ] migration スクリプト作成（up / down 両方）
- [ ] 旧 DB 移行テスト（直前版 + 主要リリース版）
- [ ] バックアップ取得の自動化確認
- [ ] 鍵管理経路の変更有無確認
- [ ] ロールバックテスト（意図的に途中失敗させる）
- [ ] ドキュメント更新（`docs/DATA_MODEL.md`, `BACKUP_RESTORE.md`）
- [ ] §5 全チェック + S2 / S7 シナリオ実行

---

## 9. 監査証跡（Audit Trail）要件

医療アプリ相当の説明責任を想定し、監査証跡は **単なるデバッグログではなく、重要操作を事後検証可能な形で永続記録**する。

### 9.1 記録対象

以下の操作は **必ず**監査対象とする:

- 患者情報: 作成 / 更新 / 削除
- スケジュール変更
- 線量値変更
- 画像紐付け変更
- AI 所見: 生成 / 修正 / 確定（**自動生成と人手確定を明確に区別**）
- 設定変更
- エクスポート / 印刷
- バックアップ / 復元 / migration 実行
- ログイン / ログアウト / 権限変更

### 9.2 記録項目（各イベント共通）

| 項目 | 説明 |
|---|---|
| 操作者 | ユーザー ID + 表示名 |
| 実行日時 | ISO8601、タイムゾーン付き |
| 対象種別 | `patient` / `schedule` / `dose` / `image` / `finding` / `config` 等 |
| 対象 ID | 該当レコード ID |
| 操作種別 | `create` / `update` / `delete` / `view` / `export` 等 |
| 変更対象フィールド | 更新時のみ。複数可 |
| 変更前の値 | 更新・削除時 |
| 変更後の値 | 作成・更新時 |
| 変更理由 | 必要に応じて（AI 所見修正など） |
| 実行画面 | UI 経路の特定用 |
| セッション ID | 一連操作の相関用 |

### 9.3 保存と保護

- **暗号化された永続領域に保存**（業務 DB と同一の SQLCipher でも、別 DB ファイルとして分離）
- 業務データと **論理的に分離**（テーブル別 + Repository 別）
- **追記専用**: UPDATE / DELETE を DB ユーザー権限および CHECK 制約で禁止
- **改ざん検知**: 各レコードに前レコードハッシュを含める **ハッシュチェーン**を導入
  - 起動時にチェーン整合性を検証、不整合は警告 + 管理者通知
- **閲覧権限は管理者等に限定**。一般利用者からは直接参照不可
- **バックアップ / 復元時にも監査証跡を保全対象**に含める

### 9.4 AI 補助結果の区別

AI 所見に関する監査は以下のステータスを明示記録:
- `ai_generated`: AI が自動生成（未確定、医師未レビュー）
- `ai_edited`: 医師が AI 結果を編集中
- `human_confirmed`: 医師が最終確定
- `ai_rejected`: AI 結果を破棄
- `manual_only`: 手動入力のみ（AI 未使用）

### 9.5 検証

- §5 合格基準 #7（Data Safety）に加え、以下を確認:
  - 監査ログテーブルへの UPDATE / DELETE が SQL レベルで拒否される
  - ハッシュチェーン改ざんが検知される（意図的に書き換えてテスト）
  - バックアップから復元後にチェーン整合性を維持

---

## 10. AI 機能のフェイルセーフ

AI 所見機能は **補助機能**として設計する。AI 応答失敗 / 空応答 / タイムアウト / 誤入力 / キャッシュ破損が発生しても、**本体業務フローが継続可能**であることを必須要件とする。

### 10.1 確認項目

| # | 項目 | 合格基準 |
|---|---|---|
| 1 | API 失敗時 | 患者編集 / 保存 / 画面遷移 / 再読込など本体機能が継続可能 |
| 2 | 空応答時 | 手動入力による所見作成・保存が可能 |
| 3 | タイムアウト時 | 生成中表示 / 失敗表示 / 再試行 / キャンセルが可能 |
| 4 | 入力修正後の再実行 | 二重保存や重複反映を起こさない（冪等性担保） |
| 5 | キャッシュ破損時 | アプリ全体が異常終了しない。破棄 + 再生成で復旧 |
| 6 | オフライン時 | AI 機能のみ無効化表示、他機能は通常動作 |

### 10.2 AI 状態モデル（必須）

以下 7 状態を **enum で定義**し、保存条件・UI 表示に反映:

| 状態 | 意味 | 保存可否 | UI 表示 |
|---|---|---|---|
| `not_generated` | 未生成 | 不可（手動入力なら可） | 「未作成」 |
| `generating` | 生成中 | 不可 | スピナー + キャンセルボタン |
| `success` | 成功 | 可（医師確認待ちステータスで） | 草稿バッジ |
| `empty_result` | 空結果 | 不可（手動入力推奨） | 「AI 応答なし」通知 |
| `failed` | 失敗 | 不可 | エラーメッセージ + 再試行ボタン |
| `timeout` | タイムアウト | 不可 | タイムアウト通知 + 再試行 |
| `cancelled` | キャンセル | 不可 | 「キャンセル済み」 |

### 10.3 設計原則

- **非同期実行**: AI 呼出は本体処理と独立したジョブキューで実行
- **タイムアウト**: デフォルト 60 秒、設定で変更可。超過時は `timeout` 状態
- **リトライ**: 失敗時は指数バックオフで最大 3 回、手動再試行も常時可能
- **冪等性**: 同一入力の再実行で **新規レコードを作らず**、同一 ID を更新（`idempotency_key` を入力ハッシュから算出）
- **キャッシュ**: プロンプトキャッシュ（`cache_control`）+ ローカル結果キャッシュ。破損検知時は破棄 + 再生成
- **医師承認フロー**: `success` でも保存は「草稿」。医師確定で初めて `human_confirmed` に遷移（監査記録）

### 10.4 確認コマンド

```bash
# フェイルセーフ専用テスト（MSW でモック）
npm run test:ai-failsafe

# カオステスト（ランダムに API を失敗させる）
npm run test:ai-chaos
```

---

## 11. リスクと対策

| リスク | 対策 |
|---|---|
| IDAC-DOSE のライセンス・呼び出し仕様不明 | Phase 0 で公式ドキュメント確認、ラッパ Python を早期スタブ化 |
| 医療機器プログラム該当性 | 「研究用 / 情報提供目的」と明記。PMDA ガイド参照 |
| AI 所見の誤り | 必ず医師承認フロー。未承認は「下書き」ステータス |
| 個人情報漏洩 | SQLCipher、OS キーチェーン、エクスポート時暗号化 ZIP |
| オフライン要求 | AI 所見以外は完全ローカル動作を確認 |
| Claude API トークン超過 | M5 でプロンプトキャッシュ + レスポンス長制限 |

---

## 12. 次のアクション（承認後に着手）

1. Phase 0 実行: bolt.new リポジトリの URL を共有してください（`git clone` 用）
2. Phase 1 着手: アーキテクト役の Claude で型・ドキュメントを確定
3. 以降、本手順書に従い Warp で並列開発

---

**更新履歴**
- 2026-04-22 初版
- 2026-04-22 v2: モジュール境界ルール(§2.1) / 合格基準強化(§5) / E2E 回帰(§6) / Tauri 特有確認(§7) / DB 変更手順(§8) / 監査証跡(§9) / AI フェイルセーフ(§10) を追加
