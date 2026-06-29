-- =============================================================================
-- 002_create_rpc_functions.sql
-- RPC関数・トリガー関数
--
-- 実行順: 001_create_tables.sql の後に実行する
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. auth.users 登録時にprofilesを自動作成するトリガー
--
-- Supabase Authentication でユーザーが新規登録されると、
-- このトリガーが自動的に public.profiles レコードを作成する。
-- デフォルトロールは 'employee'。
-- 最初の admin は、このトリガーで作成された後に
-- Supabase ダッシュボードまたは004のSQLテンプレートでroleを更新する。
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    -- ユーザー登録時に display_name をメタデータで渡せる場合はそれを使う。
    -- 例: supabase.auth.signUp({ options: { data: { display_name: '山田' } } })
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'employee',  -- デフォルトは employee。adminへの変更は手動で行う。
    true
  )
  ON CONFLICT (id) DO NOTHING;  -- 冪等性のため。再実行しても安全。
  RETURN NEW;
END;
$$;

-- auth.users への INSERT 後にトリガーを実行する
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS
  'Supabase Auth でユーザーが作成されたとき、自動的に profiles レコードを生成する。'
  'デフォルトロールは employee。admin への昇格は手動または004のSQLテンプレートで行う。';


-- ---------------------------------------------------------------------------
-- 2. register_movement
--    入庫・出庫・現場間移動を登録するメインRPC関数。
--
--    SECURITY DEFINER で実行するため、この関数内の処理はRLSをバイパスする。
--    これにより:
--      - employee は items を直接 UPDATE できないが、この関数経由では可能
--      - movements を直接 INSERT できないが、この関数経由では可能
--
--    【重要】SECURITY DEFINER 関数のバリデーションは厳密に行うこと。
--    この関数内のチェックが唯一の権限制御になる。
--
--    引数:
--      p_item_id        : 操作対象の物品 ID
--      p_movement_type  : 'outbound' | 'inbound' | 'transfer'
--      p_to_location_id : 移動先の場所 ID
--      p_moved_at       : 操作日時 (NULL の場合は now() を使用)
--      p_notes          : 備考 (任意)
--
--    戻り値: jsonb
--      { movement: {...}, item: {...} }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_movement(
  p_item_id         uuid,
  p_movement_type   text,
  p_to_location_id  uuid,
  p_moved_at        timestamptz DEFAULT NULL,
  p_notes           text        DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       uuid;
  v_profile       public.profiles%ROWTYPE;
  v_item          public.items%ROWTYPE;
  v_to_location   public.locations%ROWTYPE;
  v_new_status    text;
  v_moved_at      timestamptz;
  v_movement_id   uuid;
BEGIN

  -- ------------------------------------------------------------------
  -- ① ログインチェック
  -- ------------------------------------------------------------------
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- ------------------------------------------------------------------
  -- ② プロフィール取得 + is_active チェック
  -- ------------------------------------------------------------------
  SELECT * INTO v_profile
    FROM public.profiles
   WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'プロフィールが見つかりません。管理者に連絡してください'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT v_profile.is_active THEN
    RAISE EXCEPTION 'このアカウントは無効化されています。管理者に連絡してください'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- ------------------------------------------------------------------
  -- ③ movement_type の検証
  -- ------------------------------------------------------------------
  IF p_movement_type NOT IN ('outbound', 'inbound', 'transfer') THEN
    RAISE EXCEPTION '無効な操作種別です: %. outbound / inbound / transfer のいずれかを指定してください', p_movement_type
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ------------------------------------------------------------------
  -- ④ 対象物品の取得 (FOR UPDATE で行ロックを取得し、同時実行を防止)
  -- ------------------------------------------------------------------
  SELECT * INTO v_item
    FROM public.items
   WHERE id = p_item_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '対象の物品が見つかりません (id=%)', p_item_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- ------------------------------------------------------------------
  -- ⑤ employee の場合: 修理中・所在不明・使用停止物品の操作を禁止
  -- ------------------------------------------------------------------
  IF v_profile.role = 'employee' THEN

    IF NOT v_item.is_active THEN
      RAISE EXCEPTION '使用停止中の物品 (管理番号: %) は操作できません', v_item.management_number
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF v_item.current_status IN ('repair', 'unknown', 'inactive') THEN
      RAISE EXCEPTION '現在の状態 (%) の物品は管理者のみ操作できます: 管理番号 %',
        v_item.current_status, v_item.management_number
        USING ERRCODE = 'insufficient_privilege';
    END IF;

  END IF;

  -- ------------------------------------------------------------------
  -- ⑥ 移動先の場所を取得 + is_active チェック
  -- ------------------------------------------------------------------
  SELECT * INTO v_to_location
    FROM public.locations
   WHERE id = p_to_location_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '移動先の場所が見つかりません (id=%)', p_to_location_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT v_to_location.is_active THEN
    RAISE EXCEPTION '移動先 「%」 は現在使用停止中です', v_to_location.location_name
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ------------------------------------------------------------------
  -- ⑦ 同じ場所への移動チェック
  -- ------------------------------------------------------------------
  IF v_item.current_location_id = p_to_location_id THEN
    RAISE EXCEPTION '現在地と移動先が同じです (場所名: %)', v_to_location.location_name
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ------------------------------------------------------------------
  -- ⑧ transfer の場合:
  --    employee → 移動先は稼働中の現場 (location_type='site') のみ許可
  --    admin    → 移動先は有効な場所であれば何でも可 (修理先への移動等)
  -- ------------------------------------------------------------------
  IF p_movement_type = 'transfer' AND v_profile.role = 'employee' THEN
    IF v_to_location.location_type != 'site' THEN
      RAISE EXCEPTION '現場間移動の移動先は稼働中の現場のみ選択できます。選択された場所種別: %',
        v_to_location.location_type
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  -- ------------------------------------------------------------------
  -- ⑨ location_type → current_status マッピング
  --    Supabase版の current_status は localStorage版と異なる:
  --      location_type 'site'    → current_status 'onsite' (localStorage版は 'site')
  --      location_type 'unknown' → current_status 'unknown' (localStorage版は 'other')
  --      location_type 'other'   → current_status 'unknown' (汎用扱い)
  -- ------------------------------------------------------------------
  v_new_status := CASE v_to_location.location_type
    WHEN 'storage' THEN 'storage'
    WHEN 'site'    THEN 'onsite'
    WHEN 'repair'  THEN 'repair'
    WHEN 'unknown' THEN 'unknown'
    WHEN 'other'   THEN 'unknown'
    ELSE                'unknown'
  END;

  -- moved_at のデフォルト
  v_moved_at := COALESCE(p_moved_at, now());

  -- ------------------------------------------------------------------
  -- ⑩ movements に履歴を追加 (SECURITY DEFINER なのでRLSをバイパス)
  -- ------------------------------------------------------------------
  v_movement_id := gen_random_uuid();

  INSERT INTO public.movements (
    id,
    item_id,
    movement_type,
    from_location_id,
    to_location_id,
    moved_at,
    registered_by_user_id,
    registered_by_name,
    notes,
    created_at
  ) VALUES (
    v_movement_id,
    p_item_id,
    p_movement_type,
    v_item.current_location_id,   -- 移動前の現在地 = 移動元
    p_to_location_id,
    v_moved_at,
    v_user_id,
    v_profile.display_name,       -- 登録当時の表示名スナップショット
    COALESCE(p_notes, ''),
    now()
  );

  -- ------------------------------------------------------------------
  -- ⑪ items の現在地・状態・最終移動日時・最終操作者を更新
  --    (SECURITY DEFINER なのでRLSをバイパス)
  -- ------------------------------------------------------------------
  UPDATE public.items SET
    current_location_id   = p_to_location_id,
    current_status        = v_new_status,
    last_moved_at         = v_moved_at,
    last_registered_by    = v_user_id,
    last_registered_name  = v_profile.display_name,
    updated_at            = now()
  WHERE id = p_item_id;

  -- ------------------------------------------------------------------
  -- ⑫ 結果を返す (更新後の item + 新しい movement)
  -- ------------------------------------------------------------------
  RETURN jsonb_build_object(
    'movement', (SELECT row_to_json(m) FROM public.movements m WHERE m.id = v_movement_id),
    'item',     (SELECT row_to_json(i) FROM public.items     i WHERE i.id = p_item_id)
  );

END;
$$;

-- authenticated ロールが呼び出せるようにする (anon は不可)
GRANT EXECUTE ON FUNCTION public.register_movement(uuid, text, uuid, timestamptz, text)
  TO authenticated;
REVOKE EXECUTE ON FUNCTION public.register_movement(uuid, text, uuid, timestamptz, text)
  FROM anon;

COMMENT ON FUNCTION public.register_movement(uuid, text, uuid, timestamptz, text) IS
  '入庫・出庫・現場間移動を1トランザクションで安全に登録するRPC関数。'
  'SECURITY DEFINER で実行するため、movements/items のRLSをバイパスして更新する。'
  'バリデーションはこの関数内で完結させること。';
