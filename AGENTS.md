# AGENTS.md

このファイルは OpenAI Codex をはじめとする AI コーディングエージェント向けのプロジェクト設定です。
このリポジトリで作業する際は、まず本ファイルの内容に従ってください。

## プロジェクト概要

RI 内用療法（Pluvicto / Lutathera / Lu-177 等）の患者スケジュール管理・被ばく管理・
画像レポート AI 所見を統合するデスクトップアプリです。医療個人情報を扱うため、
**暗号化・監査ログ・オフライン動作**を前提に設計されています。

- Web フロント（Vite + React + TypeScript）
- デスクトップシェル（Tauri 2 / Rust）— ローカル DB は SQLite + SQLCipher で暗号化
- API サーバー（Express / TypeScript）— OpenAI を用いた画像所見生成
- Supabase（クラウド運用時のストレージ・DB・RLS ポリシー）

詳細な設計・開発方針は `DEVELOPMENT_PROCEDURE.md` を参照してください。

## セットアップ

```bash
npm install
cp .env.example .env   # 必要に応じて編集（通常運用では環境変数は不要）
```

Node.js 20 LTS を使用します。Tauri を扱う場合は Rust ツールチェインも必要です。

## よく使うコマンド

| 目的 | コマンド |
|---|---|
| クライアント開発サーバー | `npm run dev` |
| サーバー + クライアント同時起動 | `npm run dev:all` |
| API サーバーのみ | `npm run dev:server` |
| Tauri 開発モード | `npm run tauri:dev` |
| Tauri ビルド | `npm run tauri:build` |
| 本番ビルド（フロント） | `npm run build` |
| サーバービルド | `npm run build:server` |
| Lint | `npm run lint` |
| 型チェック | `npm run typecheck` |

**変更をコミットする前に、必ず `npm run lint` と `npm run typecheck` を実行し、両方が通ることを確認してください。**

## ディレクトリ構成

```
src/                     フロントエンド（React）
  components/            画面・UIコンポーネント（app / treatment / patient 別に整理）
  hooks/                 カスタムフック
  contexts/              React Context（認証など）
  utils/                 日付・印刷・動画フレーム抽出などのヘルパー
  shared/contracts/      型・契約定義（patient / scheduler）
server/                  Express API サーバー
  routes/                エンドポイント（analyzeImage / generatePrompt）
  lib/                   OpenAI クライアントなど
  middleware/            認証ミドルウェア
src-tauri/               Tauri（Rust）— commands / crypto / db 等
supabase/migrations/     Supabase の SQL マイグレーション
docs/                    要件定義・提案書・取扱説明書などの成果物
tools/                   単体 HTML ツール（Lu-177 退出予測ツール等）
```

## コーディング規約

- **モジュラー設計**を徹底する。ページ・再利用可能コンポーネント・レイアウト・サービス・
  フック・ユーティリティ・定数/設定を活用し、コードを分割して保守しやすく保つ。
- **1 ファイルは 400 行未満**を目安にする。超える場合は分割する。
- 型・契約は `src/shared/contracts` に集約し、参照する（本体を重複させない）。
- UI アイコンは `lucide-react` を使用する。UI テーマ・アイコン用の追加パッケージは、
  明示的な依頼がない限りインストールしない。
- スタイルは Tailwind CSS を使用する。

## 重要な制約（必ず守ること）

- **API のモデル名（OpenAI / その他）を、明示的な許可なく変更・修正しないこと。**
  指定されたモデル名のみを使用する。不明な場合は勝手に判断せず質問する。
  （知識ベースが古く、不正確なモデル名を挿入するとアプリが破損し、意図しない API 課金が発生する恐れがある）
- **API キーは必ず `.env` に保存する**（Supabase Edge Function 経由の場合は Edge Function シークレットに保存）。
  キーやシークレットをコードやコミットに含めないこと。
- 医療個人情報を扱う。暗号化・監査ログ・オフライン動作の前提を崩す変更をしない。
- データベース（Supabase）に関わる変更では、必要な RLS その他のポリシー・認証/認可・
  テーブル/バケット定義をあわせて整備する。
- `DEVELOPMENT_PROCEDURE.md` の「文書管理ルール（恒久運用原則）」は変更・削除しないこと。

## Git 運用

- コミットメッセージは日本語で、変更内容が分かるよう簡潔に記述する（既存の履歴に倣う）。
- 依頼がない限りプルリクエストは作成しない。
