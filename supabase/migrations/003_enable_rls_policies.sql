-- =============================================================================
-- 003_enable_rls_policies.sql
-- RLS有効化・ヘルパー関数・全テーブルのポリシー定義
--
-- 実行順: 002_create_rpc_functions.sql の後に実行する
--
-- ポリシーの基本設計:
--   - 未ログイン (anon)    : 全テーブルへのアクセス不可
--   - is_active=false      : 全テーブルへのアクセス不可
--   - admin                : 全データの閲覧・登録・更新が可能
--   - employee             : 有効なデータの閲覧のみ。登録はRPC経由。直接更新不可。
--   - movements            : 直接INSERT不可 (RPC経由のみ)。UPDATE/DELETE不可。
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. ヘルパー関数
--    SECURITY DEFINER で実行し、profiles へのアクセスをカプセル化する。
--    STABLE にすることでクエリ内で何度呼ばれても一度だけ実行される。
-- ---------------------------------------------------------------------------

-- 現在ログイン中のユーザーが is_active = true かどうかを返す
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = auth.uid()
       AND is_active = true
  );
$$;

-- 現在ログイン中のユーザーが admin かつ is_active = true かどうかを返す
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = auth.uid()
       AND role = 'admin'
       AND is_active = true
  );
$$;

-- 現在ログイン中のユーザーの role を返す (is_active=false または未ログインは NULL)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles
   WHERE id = auth.uid()
     AND is_active = true;
$$;

COMMENT ON FUNCTION public.is_active_user()    IS 'ログイン中ユーザーが有効(is_active=true)かどうか。RLSポリシーの共通チェックに使用。';
COMMENT ON FUNCTION public.is_admin()           IS 'ログイン中ユーザーがadminかつ有効かどうか。RLSポリシーのadminチェックに使用。';
COMMENT ON FUNCTION public.current_user_role()  IS 'ログイン中ユーザーのroleを返す。有効でない場合はNULL。';


-- ---------------------------------------------------------------------------
-- 2. RLS の有効化
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movements       ENABLE ROW LEVEL SECURITY;

-- RLSを有効にすると、ポリシーが定義されていない操作はすべて拒否される (デフォルト拒否)。
-- anon ロールはどのポリシーにも含まれないため、自動的にすべてのアクセスを拒否される。


-- ---------------------------------------------------------------------------
-- 3. profiles ポリシー
-- ---------------------------------------------------------------------------

-- admin: 全プロフィールを閲覧可能
CREATE POLICY profiles_select_admin
  ON public.profiles FOR SELECT
  USING (public.is_admin());

-- employee (または自分自身): 自分のプロフィールのみ閲覧可能
CREATE POLICY profiles_select_own
  ON public.profiles FOR SELECT
  USING (id = auth.uid() AND public.is_active_user());

-- admin のみ: 新規プロフィールを直接登録可能
-- (通常は handle_new_user トリガーが自動作成するため、直接挿入は管理者用)
CREATE POLICY profiles_insert_admin
  ON public.profiles FOR INSERT
  WITH CHECK (public.is_admin());

-- admin のみ: プロフィールを更新可能 (role変更・is_active変更など)
CREATE POLICY profiles_update_admin
  ON public.profiles FOR UPDATE
  USING (public.is_admin());

-- DELETE ポリシーなし = 誰も直接削除できない
-- auth.users から CASCADE で削除される設計のため、直接削除ポリシーは設けない。


-- ---------------------------------------------------------------------------
-- 4. item_categories ポリシー
-- ---------------------------------------------------------------------------

-- admin: 全カテゴリを閲覧可能 (is_active=false のものも含む)
CREATE POLICY item_categories_select_admin
  ON public.item_categories FOR SELECT
  USING (public.is_admin());

-- employee: is_active=true のカテゴリのみ閲覧可能
CREATE POLICY item_categories_select_employee
  ON public.item_categories FOR SELECT
  USING (public.is_active_user() AND is_active = true);

-- admin のみ: 登録・更新可能
CREATE POLICY item_categories_insert_admin
  ON public.item_categories FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY item_categories_update_admin
  ON public.item_categories FOR UPDATE
  USING (public.is_admin());

-- DELETE ポリシーなし = 誰も直接削除できない (is_active=false で論理削除を使う)


-- ---------------------------------------------------------------------------
-- 5. locations ポリシー
-- ---------------------------------------------------------------------------

-- admin: 全場所を閲覧可能 (終了済みも含む)
CREATE POLICY locations_select_admin
  ON public.locations FOR SELECT
  USING (public.is_admin());

-- employee: is_active=true の場所のみ閲覧可能
CREATE POLICY locations_select_employee
  ON public.locations FOR SELECT
  USING (public.is_active_user() AND is_active = true);

-- admin のみ: 登録・更新可能
CREATE POLICY locations_insert_admin
  ON public.locations FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY locations_update_admin
  ON public.locations FOR UPDATE
  USING (public.is_admin());

-- DELETE ポリシーなし = 誰も直接削除できない (is_active=false で論理削除を使う)


-- ---------------------------------------------------------------------------
-- 6. items ポリシー
-- ---------------------------------------------------------------------------

-- admin: 全物品を閲覧可能 (使用停止含む)
CREATE POLICY items_select_admin
  ON public.items FOR SELECT
  USING (public.is_admin());

-- employee: is_active=true の物品のみ閲覧可能
CREATE POLICY items_select_employee
  ON public.items FOR SELECT
  USING (public.is_active_user() AND is_active = true);

-- admin のみ: 物品を直接登録可能
CREATE POLICY items_insert_admin
  ON public.items FOR INSERT
  WITH CHECK (public.is_admin());

-- admin のみ: 物品を直接更新可能
-- employee は直接更新できない。移動操作は register_movement RPC (SECURITY DEFINER) 経由のみ。
CREATE POLICY items_update_admin
  ON public.items FOR UPDATE
  USING (public.is_admin());

-- DELETE ポリシーなし = 誰も直接削除できない (is_active=false で論理削除を使う)


-- ---------------------------------------------------------------------------
-- 7. movements ポリシー
-- ---------------------------------------------------------------------------
-- 【設計方針】
-- movements への直接 INSERT はすべて禁止する。
-- INSERT は register_movement RPC (SECURITY DEFINER) 経由でのみ可能。
-- SECURITY DEFINER 関数は RLS をバイパスするため、INSERT ポリシーがなくても動作する。
--
-- これにより:
--   - バリデーションをRPC関数に一元化できる
--   - employee がRPCをバイパスして直接INSERT することを防げる

-- admin: 全履歴を閲覧可能 (CSV出力にも使用)
CREATE POLICY movements_select_admin
  ON public.movements FOR SELECT
  USING (public.is_admin());

-- employee: 自分が登録した履歴のみ閲覧可能
CREATE POLICY movements_select_own
  ON public.movements FOR SELECT
  USING (
    public.is_active_user()
    AND registered_by_user_id = auth.uid()
  );

-- INSERT ポリシーなし = 直接 INSERT は全員不可
-- register_movement RPC (SECURITY DEFINER) 経由でのみ登録可能。

-- UPDATE ポリシーなし = 誰も更新できない (履歴は不変)

-- DELETE ポリシーなし = 誰も削除できない (原則削除しない)
