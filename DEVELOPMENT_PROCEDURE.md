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

## 5. 必ず実行する「変更後チェック」標準セット

各エージェントが作業完了を宣言する前に、以下をこの順で実行して **全て成功** することを確認:

```bash
# 1. 型チェック
npx tsc --noEmit

# 2. Lint
npm run lint

# 3. ユニットテスト（該当モジュールのみ）
npm run test -- src/modules/<module>

# 4. ビルド（壊れていないか）
npm run build

# 5. 起動確認（Phase 2 以降）
npm run tauri:dev
# → 起動後 10 秒、コンソールにエラーがないことを目視

# 6. 医療データ漏洩チェック（Phase 3 完了以降）
sqlite3 data.db ".dump" | grep -iE "(患者|yamada|test_patient)" && echo "NG" || echo "OK"
```

失敗した場合は **その場で修正**し、緑になるまで完了宣言しない。

---

## 6. リスクと対策

| リスク | 対策 |
|---|---|
| IDAC-DOSE のライセンス・呼び出し仕様不明 | Phase 0 で公式ドキュメント確認、ラッパ Python を早期スタブ化 |
| 医療機器プログラム該当性 | 「研究用 / 情報提供目的」と明記。PMDA ガイド参照 |
| AI 所見の誤り | 必ず医師承認フロー。未承認は「下書き」ステータス |
| 個人情報漏洩 | SQLCipher、OS キーチェーン、エクスポート時暗号化 ZIP |
| オフライン要求 | AI 所見以外は完全ローカル動作を確認 |
| Claude API トークン超過 | M5 でプロンプトキャッシュ + レスポンス長制限 |

---

## 7. 次のアクション（承認後に着手）

1. Phase 0 実行: bolt.new リポジトリの URL を共有してください（`git clone` 用）
2. Phase 1 着手: アーキテクト役の Claude で型・ドキュメントを確定
3. 以降、本手順書に従い Warp で並列開発

---

**更新履歴**
- 2026-04-22 初版
