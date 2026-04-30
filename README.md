# スマイル勤怠 MVP

中小企業向け勤怠管理アプリ「スマイル勤怠」のMVPです。

## 技術構成

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma
- NextAuth

## 主な機能

- ログイン
- 社員ホーム
- 出勤・退勤・休憩開始・休憩終了打刻
- GPS緯度経度保存
- 打刻履歴
- 管理者ダッシュボード
- 月次勤怠集計
- CSV出力
- 会社別マルチテナント
- 社員／管理者権限

## セットアップ

```bash
npm install
cp .env.example .env
```

`.env` の `DATABASE_URL` をPostgreSQLに合わせて変更してください。

```bash
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

## 初期ログイン

### 管理者
- メール: admin@smile-kintai.local
- パスワード: password123

### 社員
- メール: employee@smile-kintai.local
- パスワード: password123

## 起動URL

http://localhost:3000

## 注意

MVPのため、給与計算・法令対応・監査ログ・IP制限・顔認証は未実装です。
本番化する場合は、社労士・労務担当者・エンジニアで要件確認してください。


## UI改善版 B

- 社員画面：スマホアプリ風UI
- 管理者画面：PCダッシュボード風UI
- 月次勤怠集計：集計カード、社員別一覧、CSV出力


## 追加機能版

### 追加された機能
- 社員追加・編集 `/admin/employees`
- シフト登録 `/admin/shifts`
- 打刻修正申請（社員） `/corrections`
- 打刻修正申請承認（管理者） `/admin/corrections`
- GPS地図表示 `/admin/gps`

### 追加DBモデル
- AttendanceCorrectionRequest
- CorrectionStatus

既存DBに適用する場合は以下を実行してください。

```bash
npx prisma migrate dev --name add-admin-features
```


## 月間シフト表版

`/admin/shifts` を月間シフト表形式に変更しました。

- 月単位の表示
- 社員別・日付別のシフト入力
- A/B/C/D/E/休 の勤務パターン
- セルクリックで入力
- 右クリックで削除
- 一括保存


## 各種マスタ管理 第1段階

追加URL:

- `/admin/masters` 各種マスタ管理メニュー
- `/admin/masters/company` 会社マスタ
- `/admin/masters/departments` 部署マスタ
- `/admin/masters/employment-types` 雇用区分マスタ
- `/admin/masters/roles` 権限マスタ

DB反映:

```bash
npx prisma db push
npx prisma generate
npm run dev
```


## 管理者ダッシュボード完成版

- 管理メニューをカード型ボタンで整列
- 各種マスタ管理ボタンを追加
- ヒーローエリア、KPI、ショートカットを追加
- PC管理画面向けに見た目を改善


## エラーゼロ完全版

不足しやすかった以下ファイルを同梱しています。

- `components/AdminSidebar.tsx`
- `components/CompanyMasterForm.tsx`
- `components/MasterForm.tsx`
- 各種マスタAPI
- 各種マスタDB定義

差し替え後の推奨コマンド:

```bash
Ctrl + C
npm install
npx prisma db push
npx prisma generate
npm run dev
```
