-- =============================================================================
-- 004_seed_initial_data.sql
-- 初期テストデータの投入
--
-- 実行順: 003_enable_rls_policies.sql の後に実行する
-- 冪等性: ON CONFLICT DO NOTHING を使用。何度実行しても安全。
--
-- 【重要】
-- profiles (アカウント) は auth.users が先に作成されている必要がある。
-- auth.users への直接 INSERT はここでは行わない。
-- 管理者アカウントは Supabase ダッシュボードで作成後、
-- このファイル末尾の「admin登録テンプレート」を使用して profiles を更新する。
--
-- このファイルは service_role キーがある環境 (Supabase SQL Editor) で実行すること。
-- RLS が有効なため、アプリ側から直接実行することはできない。
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 固定 UUID 定義 (コメントとして記録)
--
-- カテゴリ: 00000000-0000-4000-8000-0000000000XX
-- 場所:     00000000-0000-4000-8001-0000000000XX
-- 物品:     00000000-0000-4000-8002-0000000000XX
--
-- これらは明らかにシードデータとわかるUUIDパターン。
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. item_categories
--    name に UNIQUE 制約があるため ON CONFLICT (name) DO NOTHING で冪等に動作する。
-- ---------------------------------------------------------------------------
INSERT INTO public.item_categories (id, name, is_active, created_at, updated_at) VALUES
  ('00000000-0000-4000-8000-000000000001', '電動工具', true, now(), now()),
  ('00000000-0000-4000-8000-000000000002', '手工具',   true, now(), now()),
  ('00000000-0000-4000-8000-000000000003', '測定機器', true, now(), now()),
  ('00000000-0000-4000-8000-000000000004', '重機',     true, now(), now()),
  ('00000000-0000-4000-8000-000000000005', '車両',     true, now(), now()),
  ('00000000-0000-4000-8000-000000000006', '備品',     true, now(), now()),
  ('00000000-0000-4000-8000-000000000007', 'その他',   true, now(), now())
ON CONFLICT (name) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 2. locations
--    固定 UUID を使用し ON CONFLICT (id) DO NOTHING で冪等に動作する。
--
--    start_date: 日付のみ (YYYY-MM-DD)。
--    localStorage 版では ISO 日時文字列だったが、Supabase では date 型に統一。
-- ---------------------------------------------------------------------------
INSERT INTO public.locations (id, location_name, location_type, start_date, end_date, notes, is_active, created_at, updated_at) VALUES
  -- 置場
  ('00000000-0000-4000-8001-000000000001', '本社置場',    'storage', CURRENT_DATE, NULL, '', true, now(), now()),
  ('00000000-0000-4000-8001-000000000002', '資材置場',    'storage', CURRENT_DATE, NULL, '', true, now(), now()),
  -- 現場
  ('00000000-0000-4000-8001-000000000003', 'テスト現場A', 'site',    CURRENT_DATE, NULL, '', true, now(), now()),
  ('00000000-0000-4000-8001-000000000004', 'テスト現場B', 'site',    CURRENT_DATE, NULL, '', true, now(), now()),
  ('00000000-0000-4000-8001-000000000005', 'テスト現場C', 'site',    CURRENT_DATE, NULL, '', true, now(), now()),
  -- 修理先
  ('00000000-0000-4000-8001-000000000006', '修理中',      'repair',  CURRENT_DATE, NULL, '', true, now(), now()),
  -- 所在不明 (localStorage版では 'other' だったが、Supabase版では 'unknown' に変更)
  ('00000000-0000-4000-8001-000000000007', '所在不明',    'unknown', CURRENT_DATE, NULL, '', true, now(), now())
ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 3. items
--    全物品を本社置場 (storage) に配置した状態でシードする。
--    current_status は location_type に対応して 'storage' に統一。
--    last_registered_by / last_registered_name は未登録状態 (NULL / '')。
--
--    management_number に UNIQUE 制約があるため
--    ON CONFLICT (management_number) DO NOTHING で冪等に動作する。
-- ---------------------------------------------------------------------------
INSERT INTO public.items (
  id,
  management_number,
  item_name,
  category_id,
  manufacturer,
  model_number,
  serial_number,
  current_location_id,
  current_status,
  last_moved_at,
  last_registered_by,
  last_registered_name,
  notes,
  is_active,
  created_at,
  updated_at
) VALUES
  (
    '00000000-0000-4000-8002-000000000001',
    'TOOL-001',
    '電動ハンマー',
    '00000000-0000-4000-8000-000000000001', -- 電動工具
    'マキタ',
    'HM1213C',
    'SN-0001',
    '00000000-0000-4000-8001-000000000001', -- 本社置場
    'storage',
    NULL, NULL, '',
    '',
    true, now(), now()
  ),
  (
    '00000000-0000-4000-8002-000000000002',
    'TOOL-002',
    'インパクトドライバー',
    '00000000-0000-4000-8000-000000000001', -- 電動工具
    'マキタ',
    'TD172D',
    'SN-0002',
    '00000000-0000-4000-8001-000000000001', -- 本社置場
    'storage',
    NULL, NULL, '',
    '',
    true, now(), now()
  ),
  (
    '00000000-0000-4000-8002-000000000003',
    'TOOL-003',
    '丸ノコ',
    '00000000-0000-4000-8000-000000000001', -- 電動工具
    'HiKOKI',
    'C6MEY',
    'SN-0003',
    '00000000-0000-4000-8001-000000000002', -- 資材置場
    'storage',
    NULL, NULL, '',
    '',
    true, now(), now()
  ),
  (
    '00000000-0000-4000-8002-000000000004',
    'TOOL-004',
    'レーザー墨出し器',
    '00000000-0000-4000-8000-000000000003', -- 測定機器
    'タジマ',
    'ZIPGREEN',
    'SN-0004',
    '00000000-0000-4000-8001-000000000001', -- 本社置場 (Supabase初期は置場に統一)
    'storage',
    NULL, NULL, '',
    '',
    true, now(), now()
  ),
  (
    '00000000-0000-4000-8002-000000000005',
    'MACHINE-001',
    '油圧ショベル',
    '00000000-0000-4000-8000-000000000004', -- 重機
    'コマツ',
    'PC30',
    'SN-0005',
    '00000000-0000-4000-8001-000000000001', -- 本社置場
    'storage',
    NULL, NULL, '',
    '',
    true, now(), now()
  ),
  (
    '00000000-0000-4000-8002-000000000006',
    'VEHICLE-001',
    '2tダンプ',
    '00000000-0000-4000-8000-000000000005', -- 車両
    'いすゞ',
    'エルフ',
    'SN-0006',
    '00000000-0000-4000-8001-000000000001', -- 本社置場
    'storage',
    NULL, NULL, '',
    '',
    true, now(), now()
  )
ON CONFLICT (management_number) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 4. profiles 初期 admin 登録テンプレート
--
-- 【手順】
-- 1. Supabase ダッシュボード → Authentication → Users → "Add user" で
--    管理者アカウント (例: admin@example.com) を作成する。
-- 2. 作成されたユーザーの UUID をコピーする。
-- 3. handle_new_user() トリガーが自動的に profiles レコード (role='employee') を作成する。
-- 4. 以下のSQLの UUID と email・display_name を書き換えて実行し、
--    role を 'admin' に変更する。
--
-- ⚠ auth.users への直接 INSERT はここでは行わない。
--   必ず Supabase Authentication 経由でユーザーを作成すること。
-- ---------------------------------------------------------------------------

/*
-- ============================================================
-- admin アカウント登録テンプレート
-- (実際のUUIDとメールアドレスに書き換えてから実行してください)
-- ============================================================

-- オプション A: handle_new_user トリガーが作成した employee プロフィールを admin に昇格する
UPDATE public.profiles
SET
  role         = 'admin',
  display_name = '管理者',  -- 表示名を変更する場合はここを修正
  updated_at   = now()
WHERE id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'  -- ← Supabase Auth で作成したユーザーのUUIDに置き換える
  AND email = 'admin@example.com';               -- ← 確認用。実際のメールアドレスに置き換える

-- 実行後、対象レコードが1行更新されたことを確認:
SELECT id, email, display_name, role, is_active FROM public.profiles;


-- オプション B: トリガーより前に手動でプロフィールを作成する場合 (通常は不要)
-- INSERT INTO public.profiles (id, email, display_name, role, is_active)
-- VALUES (
--   'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',  -- ← UUIDに置き換え
--   'admin@example.com',                      -- ← メールアドレスに置き換え
--   '管理者',
--   'admin',
--   true
-- )
-- ON CONFLICT (id) DO UPDATE SET
--   role         = EXCLUDED.role,
--   display_name = EXCLUDED.display_name,
--   updated_at   = now();
*/
