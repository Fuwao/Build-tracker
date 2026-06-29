# Supabase データベース設計書

作成日: 2026-06-24  
対象: 工具・備品 入出庫・所在管理Webアプリ  
ステータス: **設計のみ。SQL・SDK・ログイン・RLSはまだ未実装。**

---

## 1. テーブル一覧

| テーブル名 | 対応するlocalStorage | 役割 |
|---|---|---|
| `item_categories` | `item-tracker-categories-v1` | 物品の分類マスタ |
| `locations` | `item-tracker-locations-v1` | 置場・現場・修理先などの場所マスタ |
| `items` | `item-tracker-items-v1` | 物品マスタ(現在地・状態を含む) |
| `movements` | `item-tracker-movements-v1` | 入庫・出庫・移動の全履歴 |
| `profiles` | (なし・新規) | ユーザーアカウント情報(Supabase Authと連携) |

**合計: 5テーブル**

追加テーブルは今回提案しない(初期版のシンプルさを優先)。

---

## 2. テーブル定義

### 2-1. `profiles`

Supabase Auth の `auth.users` と 1:1 で紐付くプロフィールテーブル。
`auth.users` はSupabaseが内部管理するため、アプリ固有の情報はここに持つ。

```
profiles
├── id              uuid          PRIMARY KEY  -- auth.users.id と同値
├── email           text          NOT NULL     -- auth.users.email のコピー(表示用)
├── display_name    text          NOT NULL     -- 操作者として履歴に記録される表示名
├── role            text          NOT NULL     -- 'admin' または 'employee'
├── is_active       boolean       NOT NULL DEFAULT true
├── created_at      timestamptz   NOT NULL DEFAULT now()
└── updated_at      timestamptz   NOT NULL DEFAULT now()
```

**制約:**
- `role` は `CHECK (role IN ('admin', 'employee'))`
- `id` は `REFERENCES auth.users(id) ON DELETE CASCADE`
- `display_name` は空文字列禁止 `CHECK (length(trim(display_name)) > 0)`

**備考:**
- `id` は UUID。Supabase Auth が生成するUUIDをそのまま使う。
- `email` は Auth 側にも存在するが、RLSポリシーやアプリ側での表示のために profiles 側にもコピーして持つ。
- `is_active = false` のユーザーはログインしてもデータ操作を拒否する(RLSで制御)。

---

### 2-2. `item_categories`

物品の分類マスタ。現在の `Category` インターフェースとほぼ対応。

```
item_categories
├── id          uuid          PRIMARY KEY DEFAULT gen_random_uuid()
├── name        text          NOT NULL UNIQUE
├── is_active   boolean       NOT NULL DEFAULT true
├── created_at  timestamptz   NOT NULL DEFAULT now()
└── updated_at  timestamptz   NOT NULL DEFAULT now()
```

**制約:**
- `name` は UNIQUE かつ空文字列禁止 `CHECK (length(trim(name)) > 0)`

**localStorage との対応:**

| localStorage `Category` | Supabase `item_categories` | 変更 |
|---|---|---|
| `id: string` (独自形式 `cat_power_tool` など) | `id: uuid` | **変更あり** — 移行時に UUID へ振り直し |
| `name: string` | `name: text` | 変更なし |
| `isActive: boolean` | `is_active: boolean` | camelCase → snake_case |
| `createdAt: string` | `created_at: timestamptz` | ISO文字列 → timestamptz |
| `updatedAt: string` | `updated_at: timestamptz` | ISO文字列 → timestamptz |

---

### 2-3. `locations`

置場・現場・修理先などの場所マスタ。

```
locations
├── id              uuid          PRIMARY KEY DEFAULT gen_random_uuid()
├── location_name   text          NOT NULL
├── location_type   text          NOT NULL
├── start_date      date          -- 開始日(YYYY-MM-DD)
├── end_date        date          -- 終了日(NULL=継続中)
├── notes           text          NOT NULL DEFAULT ''
├── is_active       boolean       NOT NULL DEFAULT true
├── created_at      timestamptz   NOT NULL DEFAULT now()
└── updated_at      timestamptz   NOT NULL DEFAULT now()
```

**制約:**
- `location_type` は `CHECK (location_type IN ('storage', 'site', 'repair', 'other'))`
- `location_name` は空文字列禁止
- `end_date IS NULL OR end_date >= start_date` で終了日 ≧ 開始日を保証

**重要な設計変更点:**

現在のlocalStorage版では `startDate` が `string` 型で、シードデータでは ISO 日時文字列(`2026-06-24T00:00:00.000Z`)が入っているが、フォームからの入力は `YYYY-MM-DD` 形式と不整合がある。  
→ Supabase移行時に `date` 型(日付のみ)に統一する。

**localStorage との対応:**

| localStorage `Location` | Supabase `locations` | 変更 |
|---|---|---|
| `id: string` (`loc_storage_main` など) | `id: uuid` | **変更あり** — 移行時に UUID へ振り直し |
| `locationName: string` | `location_name: text` | camelCase → snake_case |
| `locationType: LocationType` | `location_type: text` | 同値。CHECK制約追加 |
| `startDate: string` (不整合あり) | `start_date: date` | **統一** — ISO日時 → 日付のみ |
| `endDate: string \| null` | `end_date: date \| null` | 同様に日付のみ |
| `notes: string` | `notes: text` | 変更なし |
| `isActive: boolean` | `is_active: boolean` | camelCase → snake_case |
| `createdAt: string` | `created_at: timestamptz` | 変更なし(型の精緻化) |
| `updatedAt: string` | `updated_at: timestamptz` | 変更なし(型の精緻化) |

---

### 2-4. `items`

物品マスタ。現在地と状態を直接持つ(非正規化は意図的 — パフォーマンスと単純さのため)。

```
items
├── id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid()
├── management_number     text          NOT NULL UNIQUE
├── item_name             text          NOT NULL
├── category_id           uuid          NOT NULL REFERENCES item_categories(id)
├── manufacturer          text          NOT NULL DEFAULT ''
├── model_number          text          NOT NULL DEFAULT ''
├── serial_number         text          NOT NULL DEFAULT ''
├── current_location_id   uuid          NOT NULL REFERENCES locations(id)
├── current_status        text          NOT NULL DEFAULT 'storage'
├── last_moved_at         timestamptz   -- NULL=まだ移動していない
├── last_registered_by    uuid          -- 最後に操作したユーザーのID(profiles.id)
├── last_registered_name  text          NOT NULL DEFAULT '' -- 最後の操作者名スナップショット
├── notes                 text          NOT NULL DEFAULT ''
├── is_active             boolean       NOT NULL DEFAULT true
├── created_at            timestamptz   NOT NULL DEFAULT now()
└── updated_at            timestamptz   NOT NULL DEFAULT now()
```

**制約:**
- `management_number` は UNIQUE + 空文字列禁止
- `current_status` は `CHECK (current_status IN ('storage', 'site', 'repair', 'other'))`
- `last_registered_by` は `REFERENCES profiles(id) ON DELETE SET NULL`
  (ユーザーが削除されても物品履歴は残す)

**設計上の注意:**
- `current_status` は `current_location_id` の場所種別と必ず同期する。RPC関数内で自動的に更新する。
- `last_registered_by` / `last_registered_name` は `movements` の最新レコードとの重複になるが、物品一覧での「最終操作者」表示のためにここにも持つ。

**localStorage との対応:**

| localStorage `Item` | Supabase `items` | 変更 |
|---|---|---|
| `id: string` (独自形式) | `id: uuid` | **変更あり** |
| `managementNumber: string` | `management_number: text` | camelCase → snake_case |
| `itemName: string` | `item_name: text` | camelCase → snake_case |
| `categoryId: string` | `category_id: uuid` | 型変更(uuid化) |
| `manufacturer: string` | `manufacturer: text` | 変更なし |
| `modelNumber: string` | `model_number: text` | camelCase → snake_case |
| `serialNumber: string` | `serial_number: text` | camelCase → snake_case |
| `currentLocationId: string` | `current_location_id: uuid` | 型変更 |
| `currentStatus: ItemStatus` | `current_status: text` | CHECK制約追加 |
| `lastMovedAt: string \| null` | `last_moved_at: timestamptz \| null` | 変更なし(型の精緻化) |
| `lastPersonName: string` | `last_registered_name: text` | **名称変更** + 意味の明確化 |
| (なし) | `last_registered_by: uuid \| null` | **新規追加** — ログイン化で使用 |
| `notes: string` | `notes: text` | 変更なし |
| `isActive: boolean` | `is_active: boolean` | camelCase → snake_case |
| `createdAt: string` | `created_at: timestamptz` | 変更なし |
| `updatedAt: string` | `updated_at: timestamptz` | 変更なし |

---

### 2-5. `movements`

入庫・出庫・現場間移動の全履歴。**原則削除しない。**

```
movements
├── id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid()
├── item_id               uuid          NOT NULL REFERENCES items(id)
├── movement_type         text          NOT NULL
├── from_location_id      uuid          NOT NULL REFERENCES locations(id)
├── to_location_id        uuid          NOT NULL REFERENCES locations(id)
├── moved_at              timestamptz   NOT NULL
├── registered_by_user_id uuid          REFERENCES profiles(id) ON DELETE SET NULL
├── registered_by_name    text          NOT NULL DEFAULT '' -- 登録当時の表示名スナップショット
├── notes                 text          NOT NULL DEFAULT ''
├── created_at            timestamptz   NOT NULL DEFAULT now()
└── (updated_at なし)     -- 履歴は作成後変更しない
```

**制約:**
- `movement_type` は `CHECK (movement_type IN ('outbound', 'inbound', 'transfer'))`
- `from_location_id <> to_location_id` を推奨(同じ場所への移動は無意味)
- `registered_by_user_id` は `ON DELETE SET NULL` — ユーザー削除後も履歴は残す
- `moved_at` はアプリ側で設定する「操作日時」(created_at とは別)

**localStorage との対応:**

| localStorage `Movement` | Supabase `movements` | 変更 |
|---|---|---|
| `id: string` (独自形式) | `id: uuid` | **変更あり** |
| `itemId: string` | `item_id: uuid` | camelCase → snake_case + uuid化 |
| `movementType: MovementType` | `movement_type: text` | CHECK制約追加 |
| `fromLocationId: string` | `from_location_id: uuid` | camelCase → snake_case + uuid化 |
| `toLocationId: string` | `to_location_id: uuid` | camelCase → snake_case + uuid化 |
| `movedAt: string` | `moved_at: timestamptz` | 変更なし(型の精緻化) |
| `personName: string` | `registered_by_name: text` | **名称変更** — フリー入力→スナップショット |
| (なし) | `registered_by_user_id: uuid \| null` | **新規追加** — ログイン化で使用 |
| `notes: string` | `notes: text` | 変更なし |
| `createdAt: string` | `created_at: timestamptz` | 変更なし |
| (なし) | `updated_at なし` | **削除** — 履歴は不変 |

---

## 3. インデックス案

パフォーマンスに影響が出やすいクエリに絞って設定する。

```
-- items
CREATE INDEX idx_items_management_number  ON items (management_number);
CREATE INDEX idx_items_current_location   ON items (current_location_id);
CREATE INDEX idx_items_current_status     ON items (current_status);
CREATE INDEX idx_items_category           ON items (category_id);
CREATE INDEX idx_items_is_active          ON items (is_active);

-- movements
CREATE INDEX idx_movements_item_id        ON movements (item_id);
CREATE INDEX idx_movements_moved_at       ON movements (moved_at DESC);
CREATE INDEX idx_movements_registered_by  ON movements (registered_by_user_id);
CREATE INDEX idx_movements_from_location  ON movements (from_location_id);
CREATE INDEX idx_movements_to_location    ON movements (to_location_id);

-- locations
CREATE INDEX idx_locations_type_active    ON locations (location_type, is_active);

-- profiles
CREATE INDEX idx_profiles_role            ON profiles (role);
CREATE INDEX idx_profiles_is_active       ON profiles (is_active);
```

---

## 4. ENUM / CHECK 制約案

SupabaseでENUM型を使うことも可能だが、**CHECK制約で管理する方が後から値を追加しやすい**。

```sql
-- location_type
CHECK (location_type IN ('storage', 'site', 'repair', 'other'))

-- current_status (locations.location_type と同じ値セット)
CHECK (current_status IN ('storage', 'site', 'repair', 'other'))

-- movement_type
CHECK (movement_type IN ('outbound', 'inbound', 'transfer'))

-- role
CHECK (role IN ('admin', 'employee'))
```

将来 `unknown` を `location_type` に追加したい場合(仕様書には「所在不明」という概念があるが、現在は `other` で代用している)は、CHECK制約なら `ALTER TABLE ... DROP CONSTRAINT ... / ADD CONSTRAINT ...` で対応可能。ENUMは型定義の変更が必要なため、CHECK制約の方が柔軟。

---

## 5. RPC 関数案: `register_movement`

入庫・出庫・移動の登録を、**単一トランザクション**で安全に行う PostgreSQL 関数。

現在の localStorage 版では `movements` への追加と `items` の現在地更新が別々の書き込みになっており、2つ目の書き込みが失敗すると不整合が生じる可能性がある。Supabase 版ではこの関数で解決する。

### 入力パラメータ

```
register_movement(
  p_item_id               uuid,
  p_movement_type         text,      -- 'outbound' | 'inbound' | 'transfer'
  p_to_location_id        uuid,
  p_moved_at              timestamptz,
  p_registered_by_user_id uuid,      -- auth.uid()
  p_registered_by_name    text,      -- profiles.display_name のスナップショット
  p_notes                 text
)
RETURNS jsonb  -- 更新後の item + 新規 movement を返す
```

### 処理の流れ(擬似コード)

```
BEGIN
  1. items から p_item_id のレコードを SELECT FOR UPDATE(悲観的ロック)
  2. is_active チェック — false なら RAISE EXCEPTION
  3. current_location_id から from_location_id を取得
  4. locations から p_to_location_id の location_type を取得
  5. movements に INSERT (from_location_id = items.current_location_id)
  6. items を UPDATE:
       current_location_id = p_to_location_id
       current_status      = locations.location_type
       last_moved_at       = p_moved_at
       last_registered_by  = p_registered_by_user_id
       last_registered_name = p_registered_by_name
       updated_at          = now()
  7. 更新後の item と新しい movement を RETURN jsonb_build_object(...)
COMMIT
```

### 呼び出し側(TypeScript)のイメージ

```typescript
const { data, error } = await supabase.rpc('register_movement', {
  p_item_id:               item.id,
  p_movement_type:         'outbound',
  p_to_location_id:        toLocationId,
  p_moved_at:              movedAt,
  p_registered_by_user_id: session.user.id,
  p_registered_by_name:    profile.display_name,
  p_notes:                 notes,
});
```

---

## 6. RLS 方針

**まだ実装しない。方針の記録のみ。**

### 基本原則

- すべてのテーブルで RLS を有効化する。
- 認証なし(未ログイン)はすべてのテーブルに対して全操作を拒否。
- `is_active = false` のプロフィールはログインできても操作を拒否する。

### テーブルごとのポリシー方針

#### `profiles`

| 操作 | admin | employee |
|---|---|---|
| SELECT | 全員分 | 自分のみ |
| INSERT | 可(アカウント管理) | 不可 |
| UPDATE | 全員分 | 自分の `display_name` のみ |
| DELETE | 論理削除(`is_active=false`)のみ推奨 | 不可 |

#### `item_categories`

| 操作 | admin | employee |
|---|---|---|
| SELECT | 全件 | `is_active = true` のみ |
| INSERT/UPDATE/DELETE | 可 | 不可 |

#### `locations`

| 操作 | admin | employee |
|---|---|---|
| SELECT | 全件 | `is_active = true` のみ |
| INSERT/UPDATE | 可 | 不可 |
| DELETE | 不推奨(論理削除を使う) | 不可 |

#### `items`

| 操作 | admin | employee |
|---|---|---|
| SELECT | 全件 | `is_active = true` のみ |
| INSERT | 可 | 不可 |
| UPDATE | 可 | `register_movement` 経由のみ可(直接UPDATE不可) |
| DELETE | 論理削除のみ推奨 | 不可 |

**注意**: `items` の直接 UPDATE を employee に禁止することで、`current_status` や `current_location_id` の不正書き換えを防ぐ。employee の移動操作は必ず `register_movement` RPC 経由で行う。

#### `movements`

| 操作 | admin | employee |
|---|---|---|
| SELECT | 全件 | 自分が登録した分のみ (`registered_by_user_id = auth.uid()`) |
| INSERT | `register_movement` 経由 | `register_movement` 経由 |
| UPDATE | 原則不可(履歴は不変) | 不可 |
| DELETE | 不可 | 不可 |

**注意点:**
- `movements` の INSERT は直接ではなく `register_movement` RPC 経由のみとすることが理想。RLS で直接 INSERT を禁止し、RPC の `SECURITY DEFINER` 属性を使って RPC 内でのみ INSERT 可能にする設計も検討できる。
- employee が「自分が登録した物品の完了確認」をする場合、登録直後は `registered_by_user_id = auth.uid()` のフィルタで対象 movement を取得できる。

### `is_active` チェックの実装パターン

すべてのポリシーに以下を加える共通ヘルパー関数を作ることを推奨:

```sql
-- 現在ログイン中のユーザーが is_active かどうかを返す
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean AS $$
  SELECT is_active FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER;
```

各テーブルのポリシーで `AND public.is_active_user()` を条件に加える。

---

## 7. localStorageデータからの移行方針

### 方針: 段階的移行(localStorageとSupabaseの並走はしない)

localStorage の既存データを Supabase に移行するかどうかは用途次第。

**推奨: 移行しない(Supabase 初回起動時にSQLシードデータで初期化)**

理由:
1. localStorage のデータはテスト・開発用であり本番データではない。
2. ID 形式が全く異なる(独自文字列 `item_abc123` vs UUID)。
3. `startDate` の不整合(ISO日時と日付の混在)を移行時に修正する必要がある。

**本番移行が必要な場合の手順:**

```
1. localStorage の 4 キーのデータを JSON ファイルにエクスポート
2. 変換スクリプト(node.js)で以下を実行:
   a. 旧IDと新UUIDのマッピングテーブルを作成
   b. camelCase → snake_case に変換
   c. startDate / endDate を YYYY-MM-DD に正規化
   d. person_name → registered_by_name に名称変更
   e. registered_by_user_id は NULL(移行時はログイン情報なし)で埋める
3. Supabase の SQL Editor で INSERT 実行
4. 動作確認後、localStorage のデータを削除
```

---

## 8. 実装順(次フェーズ以降の推奨順)

| # | フェーズ | 内容 | 前提 |
|---|---|---|---|
| 1 | **SQL定義** | 5テーブルの CREATE TABLE / インデックス / CHECK制約を SQL ファイルとして作成 | この設計書 |
| 2 | **Supabase環境構築** | プロジェクト作成・テーブル適用・シードデータ投入・RLS無効のまま動作確認 | SQL定義 |
| 3 | **supabaseRepository.ts 実装** | `DataRepository` を実装。`register_movement` RPC で登録処理。`src/repository/index.ts` の1行切り替えのみ | Supabase環境 |
| 4 | **ログイン** | Supabase Auth 追加。ログイン画面。`App.tsx` に認証ガード追加 | supabaseRepository |
| 5 | **profiles 連携** | AuthContext 作成。ログイン中ユーザー情報をアプリ全体に供給 | ログイン |
| 6 | **権限制御** | ロール別ルート制御・ボタン制御・MovementForm の担当者名欄削除 | profiles連携 |
| 7 | **RLS 設定** | 全テーブルに RLS ポリシーを設定。実機で動作確認 | 権限制御 |
| 8 | **実機確認・完了** | iOS Safari・Android Chrome での動作確認。オフライン時の挙動確認 | RLS設定 |

---

## 9. リスクと注意点

### 9-1. ID 形式の変更

現在の localStorage 版は `item_abc123xyz` のような独自文字列 ID。  
Supabase 移行後は UUID に変わる。

影響範囲:
- URL パラメータ(`/items/:itemId`)の形式は変わる(URLの見た目が変わるが機能的問題なし)
- QRコード内容は管理番号(`ITEM:TOOL-001`)を使っているため**影響なし** ← 重要

### 9-2. `startDate` の不整合

シードデータでは `startDate` に ISO 日時文字列を入れているが、フォームの `<input type="date">` は `YYYY-MM-DD` を期待している。  
Supabase の `date` 型に移行するタイミングで、アプリ側の `dateInputToIso()` 関数の扱いも合わせて確認が必要。

### 9-3. `current_status` と `location_type` の同期

現在のアプリは `registerMovement` 内で `location.locationType` を `item.currentStatus` に自動反映している。Supabase 版も RPC 内で必ず同期すること。  
この同期が外れると「物品は現場にあるのに状態が置場」という不整合が発生する。

### 9-4. `movements` の削除防止

RLS で DELETE を禁止しても、Supabase 管理画面からは削除可能。  
将来的に `PostgreSQL トリガー` で DELETE を RAISE EXCEPTION するか、テーブルオーナーを制限することを検討。

### 9-5. `is_active = false` のユーザーの扱い

Supabase Auth でユーザーを「無効化」する公式機能は現時点では限定的。  
`profiles.is_active = false` にした後、JWT が失効するまでの間(デフォルト1時間)は認証上は有効なままになる。  
→ RLS で `is_active_user()` を全ポリシーに加えることで、データ操作レベルでの即時ブロックが可能。

### 9-6. `register_movement` の `SECURITY DEFINER` 設定

RPC 関数を `SECURITY DEFINER` で作成すると、関数内の処理は関数オーナー(postgres)の権限で実行される。  
これを使うことで `movements` への直接 INSERT を employee に許可せずに RPC 経由のみにできるが、関数内のバリデーション実装が甘いとセキュリティホールになる。  
設計と実装には注意が必要。

### 9-7. タイムゾーン

Supabase(PostgreSQL)の `timestamptz` は UTC で保存される。  
現在の localStorage 版も ISO 文字列(UTC)で保存しているため基本的に問題ないが、  
`moved_at` は「操作した日付」としてユーザーが入力する値(JST の日付)なので、  
アプリ側で JST → UTC 変換を意識して実装する必要がある。

---

## 10. 未決定事項

以下は設計段階では確定していないため、SQL 化前に決める必要がある。

| # | 項目 | 現在の状況 | 決める必要があること |
|---|---|---|---|
| 1 | `location_type` の `unknown` 追加 | 現在 `other` で代用 | 「所在不明」を `other` で続けるか `unknown` を別途追加するか |
| 2 | `profiles` の初期 admin アカウント | 未設計 | Supabase 管理画面から手動作成するか、SQL シードで作るか |
| 3 | `movements` の直接 INSERT 禁止 | 未確定 | `SECURITY DEFINER` RPC 経由のみにするか、直接 INSERT も許容するか |
| 4 | employee の履歴閲覧範囲 | 「自分が登録したもの」と記載 | 「その日の自分の登録」か「対象物品のすべての履歴」かも検討余地あり |
| 5 | Supabase プロジェクトのリージョン | 未選定 | `ap-northeast-1`(東京)を推奨 |
| 6 | 既存 localStorage データの移行 | 不要(テストデータのため) | 本番データが存在する場合は移行スクリプト要検討 |
| 7 | ソフトデリート vs ハードデリート | `is_active` で論理削除の方針 | `deleted_at` カラムを追加するかどうか |

---

## 11. localStorage との型対応まとめ

### 変更が必要な項目(localStorage 側 → Supabase 側)

| 種別 | 項目 | 対応方法 |
|---|---|---|
| **全テーブル** | ID 形式(`item_abc123` など独自形式) | UUID に変更。QR内容は管理番号なので影響なし |
| **全テーブル** | camelCase フィールド名 | snake_case に変更(Supabase 標準に合わせる) |
| **全テーブル** | `string` の日時フィールド | `timestamptz` に精緻化 |
| **locations** | `startDate: string`(日時/日付が混在) | `date` 型に統一。seedData.ts も修正が必要 |
| **items** | `lastPersonName: string` | `last_registered_name` に改名 + `last_registered_by(uuid)` を新設 |
| **movements** | `personName: string` | `registered_by_name` に改名 + `registered_by_user_id(uuid)` を新設 |
| **movements** | `updatedAt` なし | 設計通り。`movements` は更新しない |
| **新規** | `profiles` テーブル | localStorage には対応なし。新規作成 |

### 変更が不要な項目

- `location_type` の値(`storage` / `site` / `repair` / `other`)
- `movement_type` の値(`outbound` / `inbound` / `transfer`)
- `current_status` の値(同上)
- QRコードの内容(`ITEM:<management_number>`)
- CSV の列構成
- ルーティング(`/items/:id` など)
- `is_active` の概念(場所・物品・ユーザーすべてで使用)
