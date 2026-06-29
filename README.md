# 工具・備品 入出庫・所在管理Webアプリ

工具・備品の出庫・入庫・現場間移動を記録し、現在地と履歴を管理するためのWebアプリです。
React + Vite + TypeScript + React Router で構成されています。

---

## ✅ localStorage版 動作確認済み(2026-06-24)

現在このブランチは **localStorage版の完成形** です。

- スマートフォン実機での動作を確認済み
- Supabase・ログイン・権限機能はまだ含まれていません
- この状態をバックアップとして保持してから次フェーズへ進みます

確認済みの動作:
- ホーム / 物品検索 / QRコード読み取り
- 出庫・入庫・現場間移動の登録
- 現在地一覧(CSV出力含む)
- 履歴一覧(CSV出力含む)
- 物品管理(登録・編集・使用停止)
- 場所・現場管理(登録・編集・終了)
- QRコード発行・印刷
- テストデータ初期化
- 全画面でローディング状態・エラー状態の表示
- 登録ボタンの二重送信防止
- iPhone / iPad / PC でのレスポンシブ表示

---

## QRコード運用

### 概要

物品ごとに QR コードを発行し、スマホで読み取ることで素早く出庫・入庫・現場間移動を登録できます。

### QR コードに入れる URL 仕様

QR コードには `window.location.origin` を使ったアプリの URL を埋め込みます。

```
https://<アプリの本番URL>/items/<物品UUID>
```

例: `https://myapp.netlify.app/items/00000000-0000-4000-8002-000000000001`

> ⚠️ **重要: 本番URLで発行したQRラベルを現場で使用してください**
>
> ローカル環境(`http://localhost:5173` や `http://192.168.x.x:5173`)で発行した QR コードには
> ローカル URL が埋め込まれます。現場のスマホから読み取っても動作しません。
> **必ず本番 URL にアクセスした状態でQRラベルを発行・印刷してください。**

### QR発行 (admin のみ)

1. admin でログインして「QRコード発行」ページを開く
2. 管理番号・物品名で物品を検索
3. 対象物品を選択すると QR コードが表示される
4. QR コードに含まれる URL を確認
5. 「印刷する」ボタンでブラウザ印刷ダイアログを開く
6. 印刷されたラベルには物品名・管理番号・QR コードが含まれる

QR 発行ページは employee には非表示。URL 直打ちでもアクセス拒否されます。

### QR読み取り (employee / admin 共通)

1. スマホでアプリにログイン
2. ホーム画面の「QRコードで登録」ボタンをタップ
3. カメラで物品の QR コードを読み取る
4. 対象物品の詳細画面に自動移動
5. 物品の状態に応じて出庫・入庫・移動を登録

### スマホカメラに HTTPS が必要な理由

ブラウザのカメラ API (`getUserMedia`) は **HTTPS 環境または localhost** でのみ動作します。

| 環境 | カメラ使用 |
|---|---|
| `https://myapp.netlify.app` | ✅ 使用可能 |
| `http://localhost:5173` | ✅ 使用可能 |
| `http://192.168.x.x:5173` | ❌ 使用不可 |

ローカル開発中にスマホ実機でカメラが使えない場合は、「手入力で検索する」を使って動作確認してください。

### QR ラベルに表示される内容

- 物品名(大きく表示)
- 管理番号
- QR コード(物品詳細 URL)

### 現場での基本運用手順

```
1. adminが物品ごとのQRコードを発行する
2. QRコードを印刷して物品に貼る
3. 従業員がスマホでアプリにログインする
4. QRコードをカメラで読み取る(または手入力で検索)
5. 対象物品の現在地・状態を確認する
6. 出庫・入庫・現場間移動を登録する
7. 登録履歴がSupabaseにリアルタイムで保存される
8. 管理者が現在地一覧・履歴ページで全体状況を確認する
```

---

現在の保存先は **Supabase** です。
`localStorageRepository.ts` は旧ローカル版として参照・比較用に残しています。

### データの流れ

```
画面 → useAppData() → repository (supabaseRepository) → Supabase テーブル
```

### 入出庫・移動の登録

直接 `items` / `movements` テーブルを更新するのではなく、**`register_movement` RPC** を呼び出します。

```ts
supabase.rpc('register_movement', {
  p_item_id:        itemId,
  p_movement_type:  'outbound' | 'inbound' | 'transfer',
  p_to_location_id: toLocationId,
  p_moved_at:       movedAt,
  p_notes:          notes,
})
```

RPC の内部で以下を1トランザクションで実行します。

- `movements` テーブルに履歴を追加
- `items.current_location_id` / `current_status` / `last_moved_at` を更新
- `auth.uid()` から登録者 ID・名前を自動記録(フロントから登録者情報を送る必要なし)
- employee の操作制限チェック

### テーブルとカラムの命名

| TypeScript (camelCase) | Supabase DB (snake_case) |
|---|---|
| `itemName` | `item_name` |
| `managementNumber` | `management_number` |
| `currentLocationId` | `current_location_id` |
| `currentStatus` | `current_status` |
| `lastRegisteredByName` | `last_registered_name` |
| `lastRegisteredByUserId` | `last_registered_by` |

### `current_status` の値

DB と TypeScript で値が異なります。`supabaseRepository.ts` 内で透過的に処理します。

| DB 値 | 意味 | TS 値(表示) |
|---|---|---|
| `storage` | 置場にある | `storage` |
| `onsite` | 現場にある | `onsite` → "現場にある" |
| `repair` | 修理中 | `repair` |
| `unknown` | 所在不明 | `unknown` → "所在不明" |
| `inactive` | 使用停止 | `inactive` → "使用停止" |

### localStorage 版へ戻す方法

`src/repository/index.ts` の1行を変更するだけです。

```ts
// Supabase 版 (現在)
export { supabaseRepository as repository } from './supabaseRepository';

// localStorage 版 (旧)
// export { repository } from './localStorageRepository';
```

### Supabase 側での確認 SQL

**移動履歴の確認:**
```sql
select
  m.id,
  i.item_name,
  m.movement_type,
  from_l.location_name as from_location,
  to_l.location_name as to_location,
  m.registered_by_name,
  m.moved_at,
  m.created_at
from public.movements m
left join public.items i on i.id = m.item_id
left join public.locations from_l on from_l.id = m.from_location_id
left join public.locations to_l on to_l.id = m.to_location_id
order by m.created_at desc;
```

**物品の現在地確認:**
```sql
select
  i.id,
  i.item_name,
  i.management_number,
  i.current_status,
  l.location_name as current_location,
  i.last_registered_name,
  i.last_moved_at
from public.items i
left join public.locations l on l.id = i.current_location_id
order by i.updated_at desc;
```

---

出庫・入庫・現場間移動の登録時に、担当者名を手入力させず、ログイン中ユーザーの情報を自動で記録します。

### 動作

- 登録画面に氏名入力欄はありません
- ログイン中の `profiles.display_name` が自動的に登録者として保存されます
- `display_name` が空の場合は `email` または `名前未設定` をフォールバックとして使います

### 履歴への保存内容

新規登録から、以下の2フィールドが Movement レコードに追加されます。

| フィールド | 内容 |
|---|---|
| `registeredByUserId` | Supabase Auth のユーザー UUID |
| `registeredByName` | 登録当時の `display_name` スナップショット |

旧フィールド (`personName`) も後方互換のために引き続き保存されます。

### 既存データとの互換性

ログイン機能追加前の履歴には `registeredByName` がありません。表示時は以下の優先順でフォールバックします。

```
registeredByName → personName → "不明"
```

`Item.lastPersonName` も同様に `lastRegisteredByName → lastPersonName` の順で表示します。

### employee の「自分の最近の登録」

`movement.registeredByUserId === profile.id` で絞り込みます。ログイン機能追加前に登録した履歴は `registeredByUserId` を持たないため表示されません。これは仕様です。

### 現時点でのデータ保存先

**この時点でも保存先は localStorage です。** Supabase への保存切り替えは次フェーズで行います。

### 次フェーズの予定

`supabaseRepository.ts` を実装し、`src/repository/index.ts` の1行を変更するだけで Supabase に切り替えます。`registerMovement` は Supabase の RPC 関数を呼び出す形になります。

---

ログイン中の `profiles.role` に応じて、利用できる画面と操作が変わります。

### admin が使える機能

全画面・全操作が利用可能です。

- ホーム、物品検索、QRコード、物品確認
- 出庫・入庫・現場間移動
- **現在地一覧・全履歴・CSV出力**
- **物品登録・編集・使用停止**
- **場所・現場管理**
- **設定・Supabase接続確認**

### employee が使える機能

現場作業に必要な操作のみ。

- ホーム (employee 専用ホーム画面)
- QRコードで登録 / 手入力で登録
- 対象物品の確認
- 出庫・入庫・現場間移動
- 登録完了確認
- 最近の登録(仮表示)
- ログアウト

### employee が使えない機能

以下の画面は URL を直接入力しても `PermissionDeniedPage`(アクセス制限画面)が表示されます。

- 現在地一覧・全履歴・CSV出力
- 物品登録・編集
- 場所・現場管理
- 設定・Supabase確認

### employee の操作制限

物品の現在状態によって、表示される操作が変わります。

| 状態 | 表示される操作 |
|---|---|
| 置場にある | 出庫する のみ |
| 現場にある | 置場へ戻す・別の現場へ移動 |
| 修理中 | 操作不可(メッセージ表示) |
| 所在不明 | 操作不可(メッセージ表示) |
| 使用停止 | 操作不可 |

### employee テストユーザーの作成

1. Supabase Dashboard → Authentication → Users → **Add user** で employee 用メールアドレスとパスワードを登録
2. `handle_new_user` トリガーにより `profiles` レコードが自動作成されます(デフォルト `role='employee'`)
3. `profiles.display_name` と `profiles.role` が `employee` になっていることを確認
4. アプリでそのメールアドレスとパスワードでログイン → employee ホーム画面が表示されることを確認

### 現時点での保存先

**この時点でもデータの保存先は localStorage です。** ログイン済みの admin / employee どちらでも、出庫・入庫・移動の保存先は localStorage のままです。

### 次フェーズの予定

1. 氏名入力欄の削除・登録者氏名の自動記録
2. Supabase への保存切り替え(`supabaseRepository.ts` の実装)
3. 登録者 ID を移動履歴に保存し、employee の「自分の最近の登録」を正確に絞り込む

---

Supabase Authentication を使ったメール/パスワードログインを実装済みです。

### 仕様

- 未ログイン状態では全ページへのアクセスがログイン画面へリダイレクトされます
- ログイン済みで `/login` へアクセスするとホームへリダイレクトされます
- **アカウント作成は Supabase Dashboard → Authentication → Users → Add user で行います**。このアプリには自由登録フォームはありません。

### profiles テーブルの設定

ログイン後、`profiles` テーブルからユーザー情報を取得します。以下が必要です。

| カラム | 内容 |
|---|---|
| `id` | Supabase Auth のユーザー UUID (auth.users.id と同値) |
| `display_name` | アプリ内に表示される名前 |
| `role` | `admin` または `employee` |
| `is_active` | `true` のユーザーのみログイン可能 |

`handle_new_user` トリガーにより、Auth でユーザーを作成すると自動的に `profiles` レコードが生成されます(デフォルト `role='employee'`)。

admin に昇格するには `SUPABASE_SCHEMA_PLAN.md` の admin 登録テンプレート SQL を実行してください。

### ローカルでのログイン確認手順

1. `.env.local` に Supabase URL と anon key を設定する
2. `npm run dev` で開発サーバーを起動
3. ブラウザで `http://localhost:5173` を開く → ログイン画面が表示される
4. Supabase Dashboard で作成した admin アカウントでログイン
5. ホーム画面が表示され、ログイン中ユーザー名と role が表示される

### ログアウト確認手順

1. ホーム画面のユーザーバー (または PC のヘッダーナビ) の「ログアウト」ボタンをクリック
2. ログイン画面へ戻ることを確認

### 現時点でのデータ保存先

**この時点ではログイン済み後もデータ保存先は引き続き localStorage です。** Supabase へのデータ保存切り替えは次フェーズで行います。

### 既知の制限(次フェーズで修正予定)

現在の RLS ポリシー (`profiles_select_own`) に `is_active_user()` が含まれているため、`is_active=false` のユーザーが自分の profile を取得できません。このため、「プロフィールなし」と「アカウント無効化」を区別できないケースがあります。`profiles_select_own` ポリシーから `is_active_user()` を除去することで解消できます。

### 次フェーズの予定

admin / employee の画面制御を追加し、権限に応じた表示制限を実装します。

---

このアプリは将来 Supabase でデータを共有する予定です。
現時点では localStorage 版と Supabase 版が並走しており、既存機能はすべて localStorage 版で動作します。

### 環境変数の設定

プロジェクトルートに `.env.local` を新規作成して以下を記入してください。

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

`.env.example` を参考にしてください。`.env.local` は `.gitignore` の `*.local` パターンに含まれるため Git には追加されません。

#### 値の取得場所

| 環境変数 | 取得場所 |
|---|---|
| `VITE_SUPABASE_URL` | Supabase ダッシュボード → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase ダッシュボード → Project Settings → API → Project API Keys → anon / public |

設定後は開発サーバーを再起動してください。

```bash
npm run dev
```

### 接続確認ページ

開発用の接続確認ページを用意しています。

```
http://localhost:5173/supabase-check
```

環境変数の設定状況と、各テーブルへのアクセス確認ができます。

#### RLS(Row Level Security)について

Supabase 側では RLS が有効になっています。**未ログイン状態ではデータが取得できません(0件)**。これは意図した動作です。ログイン機能を実装してから再度確認してください。

---

```bash
npm install
npm run dev      # 開発サーバー起動
npm run build    # 本番ビルド(tsc型チェック+vite build)
```

初回起動時にテストデータが自動投入されます。
設定画面からいつでもテストデータへリセットできます。

---

## 主な構成

```
src/
├── hooks/
│   └── useAppData.ts          # 全4リソースを並列取得する共通フック
├── repository/
│   ├── index.ts               # バレルファイル(Supabase化時はここを変更)
│   ├── types.ts               # DataRepository インターフェース(全メソッドPromise型)
│   ├── localStorageRepository.ts  # localStorage実装
│   └── selectors.ts           # 純粋関数の結合・検索ヘルパー
├── types/index.ts             # Item / Location / Movement などの型定義
├── pages/                     # 14画面
├── components/                # 共通UIパーツ
├── data/seedData.ts           # 初期テストデータ
└── utils/                     # id / date / csv ユーティリティ
```

### データの保存先

localStorageに以下のキーでJSON配列として保存(すべてバージョン付き):

- `item-tracker-items-v1`
- `item-tracker-locations-v1`
- `item-tracker-categories-v1`
- `item-tracker-movements-v1`

### 重要な設計方針

- 全画面・コンポーネントは `src/repository/index.ts` 経由でのみデータにアクセスします。localStorage APIを直接呼んでいる箇所はリポジトリ層の外に存在しません。
- `DataRepository` インターフェースは全メソッドが `Promise<T>` を返します。localStorageは内部的には同期ですが、将来のSupabase差し替えに備えてインターフェースは非同期で統一しています。
- `registerMovement()` が出庫・入庫・移動の唯一の登録エントリポイントです(履歴追加+現在地更新を必ずセットで行う)。
- `selectors.ts` の関数はすべて純粋関数です。取得済み配列を引数として受け取り、リポジトリを直接参照しません。

---

## 今後の拡張計画

以下を段階的に追加する予定です(このブランチには含まれていません):

1. **SQL定義(設計完了)**: [`SUPABASE_SCHEMA_PLAN.md`](./SUPABASE_SCHEMA_PLAN.md) にテーブル設計・RPC関数案・RLS方針を記載済み
2. **第2段階B**: SupabaseテーブルのSQL作成 → `supabaseRepository.ts` 実装
3. **第3段階**: ログイン(Supabase Auth)
4. **第4段階**: admin / employee 権限制御
5. **第5段階**: ログイン中ユーザーの氏名自動記録 + 担当者名入力欄削除

移行計画の詳細は [`SUPABASE_MIGRATION_PLAN.md`](./SUPABASE_MIGRATION_PLAN.md) を参照してください。
