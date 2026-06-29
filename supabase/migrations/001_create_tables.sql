-- =============================================================================
-- 001_create_tables.sql
-- テーブル定義・制約・インデックス・updated_atトリガー
--
-- 実行順: このファイルを最初に実行する
-- 依存: auth.users (Supabase Authが自動管理)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. 拡張機能
-- ---------------------------------------------------------------------------
-- gen_random_uuid() は PostgreSQL 13+ で標準搭載。
-- Supabase はデフォルトで利用可能だが、念のため有効化しておく。
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ---------------------------------------------------------------------------
-- 1. updated_at を自動更新するトリガー関数
--    profiles / item_categories / locations / items に適用する。
--    movements は作成後に変更しない設計のため適用しない。
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------------------
-- 2. profiles
--    Supabase Auth の auth.users と 1:1 で紐付くアプリ固有プロフィール。
--    auth.users のユーザーが削除されると CASCADE でこのレコードも削除される。
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id            uuid          NOT NULL,
  email         text          NOT NULL,
  display_name  text          NOT NULL,
  role          text          NOT NULL DEFAULT 'employee',
  is_active     boolean       NOT NULL DEFAULT true,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id)
    REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'employee')),
  CONSTRAINT profiles_display_name_nonempty CHECK (length(trim(display_name)) > 0),
  CONSTRAINT profiles_email_nonempty        CHECK (length(trim(email)) > 0)
);

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE  public.profiles                IS 'アプリ固有のユーザーアカウント情報。auth.usersと1:1対応。';
COMMENT ON COLUMN public.profiles.id             IS 'auth.users.id と同値 (uuid)';
COMMENT ON COLUMN public.profiles.display_name   IS '操作者として履歴に記録される表示名。変更可能だが過去履歴は変わらない。';
COMMENT ON COLUMN public.profiles.role           IS 'admin または employee';
COMMENT ON COLUMN public.profiles.is_active      IS 'false にするとログイン後もデータ操作を拒否する (RLSで制御)';


-- ---------------------------------------------------------------------------
-- 3. item_categories
--    物品の分類マスタ。
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.item_categories (
  id          uuid          NOT NULL DEFAULT gen_random_uuid(),
  name        text          NOT NULL,
  is_active   boolean       NOT NULL DEFAULT true,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT item_categories_pkey        PRIMARY KEY (id),
  CONSTRAINT item_categories_name_unique UNIQUE (name),
  CONSTRAINT item_categories_name_nonempty CHECK (length(trim(name)) > 0)
);

CREATE TRIGGER set_item_categories_updated_at
  BEFORE UPDATE ON public.item_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.item_categories IS '物品の分類マスタ。電動工具・重機・車両など。';


-- ---------------------------------------------------------------------------
-- 4. locations
--    置場・現場・修理先などの場所マスタ。
--
--    location_type の値:
--      storage  : 置場
--      site     : 現場
--      repair   : 修理先
--      unknown  : 所在不明 (独立した値として扱う)
--      other    : その他
--
--    【注意】localStorage 版の LocationType は 'other' を所在不明として使っていたが、
--    Supabase 版では 'unknown' が独立した値になる。
--    TypeScript 型定義の更新が必要 (supabaseRepository 実装時に対応)。
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.locations (
  id              uuid          NOT NULL DEFAULT gen_random_uuid(),
  location_name   text          NOT NULL,
  location_type   text          NOT NULL,
  start_date      date,
  end_date        date,
  notes           text          NOT NULL DEFAULT '',
  is_active       boolean       NOT NULL DEFAULT true,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT locations_pkey PRIMARY KEY (id),
  CONSTRAINT locations_type_check CHECK (
    location_type IN ('storage', 'site', 'repair', 'unknown', 'other')
  ),
  CONSTRAINT locations_name_nonempty CHECK (length(trim(location_name)) > 0),
  CONSTRAINT locations_date_order CHECK (
    end_date IS NULL OR start_date IS NULL OR end_date >= start_date
  )
);

CREATE TRIGGER set_locations_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_locations_type_active
  ON public.locations (location_type, is_active);

COMMENT ON TABLE  public.locations              IS '置場・現場・修理先などの場所マスタ。';
COMMENT ON COLUMN public.locations.location_type IS 'storage=置場 site=現場 repair=修理先 unknown=所在不明 other=その他';
COMMENT ON COLUMN public.locations.start_date    IS '日付のみ (YYYY-MM-DD)。localStorage版のstartDateはISO日時との不整合があったが、ここではdateに統一。';
COMMENT ON COLUMN public.locations.is_active     IS 'false=終了済み。入出庫の移動先選択肢には表示しないが、過去履歴には残す。';


-- ---------------------------------------------------------------------------
-- 5. items
--    物品マスタ。現在地と状態を直接持つ (パフォーマンス優先の非正規化)。
--
--    current_status の値:
--      storage   : 置場にある  (location_type='storage' に対応)
--      onsite    : 現場にある  (location_type='site'    に対応)
--      repair    : 修理中      (location_type='repair'  に対応)
--      unknown   : 所在不明    (location_type='unknown' または 'other' に対応)
--      inactive  : 使用停止    (is_active=false のときに設定)
--
--    【重要な設計差異】
--    localStorage 版の ItemStatus は 'storage' | 'site' | 'repair' | 'other' だが、
--    Supabase 版では 'site' → 'onsite'、'other' → 'unknown' に変わる。
--    また 'inactive' が新規追加される。
--    supabaseRepository.ts 実装時に TypeScript 型の更新が必要。
--
--    【制約】is_active=false の場合は current_status='inactive' を強制。
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.items (
  id                    uuid          NOT NULL DEFAULT gen_random_uuid(),
  management_number     text          NOT NULL,
  item_name             text          NOT NULL,
  category_id           uuid          NOT NULL,
  manufacturer          text          NOT NULL DEFAULT '',
  model_number          text          NOT NULL DEFAULT '',
  serial_number         text          NOT NULL DEFAULT '',
  current_location_id   uuid          NOT NULL,
  current_status        text          NOT NULL DEFAULT 'storage',
  last_moved_at         timestamptz,
  last_registered_by    uuid,
  last_registered_name  text          NOT NULL DEFAULT '',
  notes                 text          NOT NULL DEFAULT '',
  is_active             boolean       NOT NULL DEFAULT true,
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT items_pkey PRIMARY KEY (id),
  CONSTRAINT items_management_number_unique UNIQUE (management_number),
  CONSTRAINT items_category_id_fkey FOREIGN KEY (category_id)
    REFERENCES public.item_categories (id),
  CONSTRAINT items_current_location_id_fkey FOREIGN KEY (current_location_id)
    REFERENCES public.locations (id),
  CONSTRAINT items_last_registered_by_fkey FOREIGN KEY (last_registered_by)
    REFERENCES public.profiles (id) ON DELETE SET NULL,
  CONSTRAINT items_status_check CHECK (
    current_status IN ('storage', 'onsite', 'repair', 'unknown', 'inactive')
  ),
  CONSTRAINT items_management_number_nonempty CHECK (length(trim(management_number)) > 0),
  CONSTRAINT items_name_nonempty              CHECK (length(trim(item_name)) > 0),
  -- is_active=false のときは current_status='inactive' を強制する
  CONSTRAINT items_inactive_status_check CHECK (
    is_active = true OR current_status = 'inactive'
  )
);

CREATE TRIGGER set_items_updated_at
  BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_items_management_number
  ON public.items (management_number);
CREATE INDEX IF NOT EXISTS idx_items_current_location
  ON public.items (current_location_id);
CREATE INDEX IF NOT EXISTS idx_items_current_status
  ON public.items (current_status);
CREATE INDEX IF NOT EXISTS idx_items_category
  ON public.items (category_id);
CREATE INDEX IF NOT EXISTS idx_items_is_active
  ON public.items (is_active);

COMMENT ON TABLE  public.items                     IS '物品マスタ。現在地と状態を非正規化して直接持つ。';
COMMENT ON COLUMN public.items.current_status       IS 'register_movement RPCが自動更新。storage/onsite/repair/unknown/inactive。';
COMMENT ON COLUMN public.items.last_registered_by   IS '最後に操作したユーザーのprofiles.id。ユーザー削除時はNULLに設定 (ON DELETE SET NULL)。';
COMMENT ON COLUMN public.items.last_registered_name IS '登録当時の表示名スナップショット。display_name変更後も過去の記録は保持。';


-- ---------------------------------------------------------------------------
-- 6. movements
--    入庫・出庫・現場間移動の全履歴。
--    作成後は変更・削除しない (updated_at カラムなし)。
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.movements (
  id                      uuid          NOT NULL DEFAULT gen_random_uuid(),
  item_id                 uuid          NOT NULL,
  movement_type           text          NOT NULL,
  from_location_id        uuid          NOT NULL,
  to_location_id          uuid          NOT NULL,
  moved_at                timestamptz   NOT NULL,
  registered_by_user_id   uuid,
  registered_by_name      text          NOT NULL DEFAULT '',
  notes                   text          NOT NULL DEFAULT '',
  created_at              timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT movements_pkey PRIMARY KEY (id),
  CONSTRAINT movements_item_id_fkey FOREIGN KEY (item_id)
    REFERENCES public.items (id),
  CONSTRAINT movements_from_location_id_fkey FOREIGN KEY (from_location_id)
    REFERENCES public.locations (id),
  CONSTRAINT movements_to_location_id_fkey FOREIGN KEY (to_location_id)
    REFERENCES public.locations (id),
  CONSTRAINT movements_registered_by_fkey FOREIGN KEY (registered_by_user_id)
    REFERENCES public.profiles (id) ON DELETE SET NULL,
  CONSTRAINT movements_type_check CHECK (
    movement_type IN ('outbound', 'inbound', 'transfer')
  ),
  -- 同じ場所への移動は記録しない
  CONSTRAINT movements_different_locations CHECK (from_location_id <> to_location_id)
);

CREATE INDEX IF NOT EXISTS idx_movements_item_id
  ON public.movements (item_id);
CREATE INDEX IF NOT EXISTS idx_movements_moved_at
  ON public.movements (moved_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_registered_by
  ON public.movements (registered_by_user_id);
CREATE INDEX IF NOT EXISTS idx_movements_from_location
  ON public.movements (from_location_id);
CREATE INDEX IF NOT EXISTS idx_movements_to_location
  ON public.movements (to_location_id);

COMMENT ON TABLE  public.movements                       IS '入庫・出庫・現場間移動の全履歴。原則削除しない。updated_atなし(不変)。';
COMMENT ON COLUMN public.movements.registered_by_name    IS '登録当時の表示名スナップショット。display_name変更後も過去の記録は保持。';
COMMENT ON COLUMN public.movements.registered_by_user_id IS 'ユーザー削除時はNULLに設定 (ON DELETE SET NULL)。履歴レコード自体は残す。';
