// =============================================================================
// src/repository/supabaseRepository.ts
// DataRepository の Supabase 実装
//
// DBはsnake_case、TypeScript側はcamelCase。
// 変換は mapXxx 関数で集中管理する。
//
// 入出庫・移動の登録は register_movement RPC のみ使用する。
// RPC は SECURITY DEFINER で auth.uid() から登録者を自動取得する
// (フロントから registeredByUserId/Name を送る必要はない)。
// =============================================================================
import type {
  Category,
  Item,
  ItemStatus,
  Location,
  LocationType,
  Movement,
  MovementInput,
  MovementType,
} from '../types';
import type { DataRepository } from './types';
import { supabase } from '../lib/supabase';

// ============================================================
// DB 行の型 (Supabase から返ってくる snake_case)
// ============================================================
interface DbCategory {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DbLocation {
  id: string;
  location_name: string;
  location_type: string;
  start_date: string | null;
  end_date: string | null;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DbItem {
  id: string;
  management_number: string;
  item_name: string;
  category_id: string;
  manufacturer: string;
  model_number: string;
  serial_number: string;
  current_location_id: string;
  current_status: string;
  last_moved_at: string | null;
  last_registered_by: string | null;
  last_registered_name: string;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DbMovement {
  id: string;
  item_id: string;
  movement_type: string;
  from_location_id: string;
  to_location_id: string;
  moved_at: string;
  registered_by_user_id: string | null;
  registered_by_name: string;
  notes: string;
  created_at: string;
}

// Supabase JOIN クエリで取得した場合の拡張型
// items / from_location / to_location は JOIN で結合されたネストオブジェクト
interface DbMovementWithJoins extends DbMovement {
  item?: { id: string; item_name: string; management_number: string } | null;
  from_location?: { id: string; location_name: string } | null;
  to_location?: { id: string; location_name: string } | null;
}

// ============================================================
// snake_case → camelCase マッピング関数
// ============================================================
function mapCategory(row: DbCategory): Category {
  return {
    id: row.id,
    name: row.name,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLocation(row: DbLocation): Location {
  return {
    id: row.id,
    locationName: row.location_name,
    locationType: row.location_type as LocationType,
    startDate: row.start_date ?? '',
    endDate: row.end_date ?? null,
    notes: row.notes ?? '',
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItem(row: DbItem): Item {
  return {
    id: row.id,
    managementNumber: row.management_number,
    itemName: row.item_name,
    categoryId: row.category_id,
    manufacturer: row.manufacturer ?? '',
    modelNumber: row.model_number ?? '',
    serialNumber: row.serial_number ?? '',
    currentLocationId: row.current_location_id,
    currentStatus: row.current_status as ItemStatus,
    lastMovedAt: row.last_moved_at ?? null,
    lastPersonName: row.last_registered_name ?? '',  // 後方互換
    lastRegisteredByName: row.last_registered_name ?? undefined,
    lastRegisteredByUserId: row.last_registered_by ?? undefined,
    notes: row.notes ?? '',
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMovement(row: DbMovement | DbMovementWithJoins): Movement {
  const withJoins = row as DbMovementWithJoins;
  return {
    id: row.id,
    itemId: row.item_id,
    movementType: row.movement_type as MovementType,
    fromLocationId: row.from_location_id,
    toLocationId: row.to_location_id,
    movedAt: row.moved_at,
    personName: row.registered_by_name ?? '',        // 後方互換
    registeredByName: row.registered_by_name ?? undefined,
    registeredByUserId: row.registered_by_user_id ?? undefined,
    notes: row.notes ?? '',
    createdAt: row.created_at,
    // JOIN で取得できた場合は _xxx フィールドに格納(selectors.ts で優先利用)
    _itemName:          withJoins.item?.item_name          ?? undefined,
    _managementNumber:  withJoins.item?.management_number  ?? undefined,
    _fromLocationName:  withJoins.from_location?.location_name ?? undefined,
    _toLocationName:    withJoins.to_location?.location_name   ?? undefined,
  };
}

/** location_type → current_status のマッピング (DB上の値で返す) */
function locTypeToStatus(locationType: string): string {
  switch (locationType) {
    case 'storage': return 'storage';
    case 'site':    return 'onsite';
    case 'repair':  return 'repair';
    case 'unknown': return 'unknown';
    default:        return 'unknown';
  }
}

/** Supabase クライアントが設定されているかチェック */
function requireSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase クライアントが初期化されていません。' +
      '.env.local に VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください。'
    );
  }
  return supabase;
}

// ============================================================
// SupabaseRepository クラス
// ============================================================
class SupabaseRepository implements DataRepository {

  // ---------- categories ----------
  async getCategories(): Promise<Category[]> {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from('item_categories')
      .select('*')
      .order('name');
    if (error) throw new Error(`分類の取得に失敗しました: ${error.message}`);
    return (data as DbCategory[]).map(mapCategory);
  }

  // ---------- locations ----------
  async getLocations(): Promise<Location[]> {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from('locations')
      .select('*')
      .order('location_name');
    if (error) throw new Error(`場所の取得に失敗しました: ${error.message}`);
    return (data as DbLocation[]).map(mapLocation);
  }

  async getLocationById(id: string): Promise<Location | undefined> {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from('locations')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`場所の取得に失敗しました: ${error.message}`);
    return data ? mapLocation(data as DbLocation) : undefined;
  }

  async createLocation(
    input: Omit<Location, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Location> {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from('locations')
      .insert({
        location_name: input.locationName,
        location_type: input.locationType,
        start_date: input.startDate || null,
        end_date: input.endDate || null,
        notes: input.notes ?? '',
        is_active: input.isActive,
      })
      .select()
      .single();
    if (error) throw new Error(`場所の登録に失敗しました: ${error.message}`);
    return mapLocation(data as DbLocation);
  }

  async updateLocation(
    id: string,
    input: Partial<Omit<Location, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Location> {
    const sb = requireSupabase();
    const updateData: Record<string, unknown> = {};
    if (input.locationName !== undefined) updateData.location_name  = input.locationName;
    if (input.locationType  !== undefined) updateData.location_type  = input.locationType;
    if (input.startDate     !== undefined) updateData.start_date     = input.startDate || null;
    if (input.endDate       !== undefined) updateData.end_date       = input.endDate ?? null;
    if (input.notes         !== undefined) updateData.notes          = input.notes;
    if (input.isActive      !== undefined) updateData.is_active      = input.isActive;

    const { data, error } = await sb
      .from('locations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`場所の更新に失敗しました: ${error.message}`);
    return mapLocation(data as DbLocation);
  }

  // ---------- items ----------
  async getItems(): Promise<Item[]> {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from('items')
      .select('*')
      .order('management_number');
    if (error) throw new Error(`物品の取得に失敗しました: ${error.message}`);
    const items = (data as DbItem[]).map(mapItem);
    // デバッグ: 物品データの確認 (問題の原因特定後に削除可)
    console.debug('[SupabaseRepo] getItems():', items.map(i => ({
      id: i.id,
      managementNumber: i.managementNumber,
      itemName: i.itemName,
      currentStatus: i.currentStatus,
    })));
    return items;
  }

  async getItemById(id: string): Promise<Item | undefined> {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from('items')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`物品の取得に失敗しました: ${error.message}`);
    return data ? mapItem(data as DbItem) : undefined;
  }

  async getItemByManagementNumber(managementNumber: string): Promise<Item | undefined> {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from('items')
      .select('*')
      .ilike('management_number', managementNumber.trim())
      .maybeSingle();
    if (error) throw new Error(`物品の検索に失敗しました: ${error.message}`);
    return data ? mapItem(data as DbItem) : undefined;
  }

  async createItem(
    input: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'lastMovedAt' | 'lastPersonName' | 'currentStatus'>
  ): Promise<Item> {
    const sb = requireSupabase();

    // 場所種別から current_status を決定する
    const { data: locRow } = await sb
      .from('locations')
      .select('location_type')
      .eq('id', input.currentLocationId)
      .maybeSingle();
    const currentStatus = locRow ? locTypeToStatus((locRow as { location_type: string }).location_type) : 'unknown';

    const { data, error } = await sb
      .from('items')
      .insert({
        management_number:  input.managementNumber,
        item_name:          input.itemName,
        category_id:        input.categoryId,
        manufacturer:       input.manufacturer  ?? '',
        model_number:       input.modelNumber   ?? '',
        serial_number:      input.serialNumber  ?? '',
        current_location_id: input.currentLocationId,
        current_status:     currentStatus,
        notes:              input.notes ?? '',
        is_active:          input.isActive ?? true,
      })
      .select()
      .single();
    if (error) throw new Error(`物品の登録に失敗しました: ${error.message}`);
    return mapItem(data as DbItem);
  }

  async updateItem(
    id: string,
    input: Partial<Omit<Item, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Item> {
    const sb = requireSupabase();
    const updateData: Record<string, unknown> = {};

    if (input.managementNumber     !== undefined) updateData.management_number   = input.managementNumber;
    if (input.itemName             !== undefined) updateData.item_name            = input.itemName;
    if (input.categoryId           !== undefined) updateData.category_id          = input.categoryId;
    if (input.manufacturer         !== undefined) updateData.manufacturer          = input.manufacturer;
    if (input.modelNumber          !== undefined) updateData.model_number          = input.modelNumber;
    if (input.serialNumber         !== undefined) updateData.serial_number         = input.serialNumber;
    if (input.notes                !== undefined) updateData.notes                 = input.notes;
    if (input.isActive             !== undefined) {
      updateData.is_active = input.isActive;
      // 使用停止にする場合は current_status を inactive に設定
      if (!input.isActive) updateData.current_status = 'inactive';
    }
    if (input.currentLocationId !== undefined) {
      updateData.current_location_id = input.currentLocationId;
      // 場所が変わる場合、場所種別から current_status を再計算
      const { data: locRow } = await sb
        .from('locations')
        .select('location_type')
        .eq('id', input.currentLocationId)
        .maybeSingle();
      if (locRow) {
        updateData.current_status = locTypeToStatus((locRow as { location_type: string }).location_type);
      }
    }
    // 使用停止から復活させる場合(isActive=true かつ currentStatus 指定あり)
    if (input.isActive === true && input.currentStatus !== undefined) {
      updateData.current_status = input.currentStatus;
    }

    const { data, error } = await sb
      .from('items')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`物品の更新に失敗しました: ${error.message}`);
    return mapItem(data as DbItem);
  }

  // ---------- movements ----------
  async getMovements(): Promise<Movement[]> {
    const sb = requireSupabase();
    // JOIN で物品名・場所名を直接取得する。
    // インメモリ結合のみに頼らず、DB レベルで結合することで表示の信頼性を高める。
    const { data, error } = await sb
      .from('movements')
      .select(`
        *,
        item:items!movements_item_id_fkey (id, item_name, management_number),
        from_location:locations!movements_from_location_id_fkey (id, location_name),
        to_location:locations!movements_to_location_id_fkey (id, location_name)
      `)
      .order('moved_at', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      // JOIN が失敗した場合(外部キー名の不一致など)は flat select にフォールバック
      console.warn('[SupabaseRepo] JOIN付きgetMovementsが失敗。フォールバックします:', error.message);
      const { data: flatData, error: flatError } = await sb
        .from('movements')
        .select('*')
        .order('moved_at', { ascending: false })
        .order('created_at', { ascending: false });
      if (flatError) throw new Error(`履歴の取得に失敗しました: ${flatError.message}`);
      return (flatData as DbMovement[]).map(mapMovement);
    }
    const movements = (data as DbMovementWithJoins[]).map(mapMovement);
    // デバッグ: 移動履歴データの確認 (問題の原因特定後に削除可)
    console.debug('[SupabaseRepo] getMovements():', movements.map(m => ({
      id: m.id,
      itemId: m.itemId,
      _itemName: m._itemName,
      _managementNumber: m._managementNumber,
      movementType: m.movementType,
    })));
    return movements;
  }

  async getMovementsByItemId(itemId: string): Promise<Movement[]> {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from('movements')
      .select(`
        *,
        item:items!movements_item_id_fkey (id, item_name, management_number),
        from_location:locations!movements_from_location_id_fkey (id, location_name),
        to_location:locations!movements_to_location_id_fkey (id, location_name)
      `)
      .eq('item_id', itemId)
      .order('moved_at', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw new Error(`物品履歴の取得に失敗しました: ${error.message}`);
    return (data as DbMovementWithJoins[]).map(mapMovement);
  }

  // ---------- 入出庫・移動の登録 (RPC経由) ----------
  async registerMovement(
    movementType: MovementType,
    input: MovementInput
  ): Promise<{ item: Item; movement: Movement }> {
    const sb = requireSupabase();

    // Supabase版では登録者情報は RPC 内部で auth.uid() から自動取得。
    // フロントから registeredByUserId / registeredByName は送らない。
    const { data, error } = await sb.rpc('register_movement', {
      p_item_id:        input.itemId,
      p_movement_type:  movementType,
      p_to_location_id: input.toLocationId,
      p_moved_at:       input.movedAt ?? null,
      p_notes:          input.notes ?? '',
    });

    if (error) {
      // RPC 内の RAISE EXCEPTION メッセージをそのまま表示する
      throw new Error(error.message);
    }

    // RPC の戻り値: { movement: DbMovement, item: DbItem }
    const result = data as { movement: DbMovement; item: DbItem };
    return {
      movement: mapMovement(result.movement),
      item:     mapItem(result.item),
    };
  }

  // ---------- 初期化 ----------
  async ensureSeeded(): Promise<void> {
    // Supabase版では004_seed_initial_data.sqlで投入済みのため no-op
    return;
  }

  async resetToSeedData(): Promise<void> {
    // Supabase版ではフロントからのリセットは非対応。
    // Supabase SQL Editor から 004_seed_initial_data.sql を再実行してください。
    throw new Error(
      'Supabase版ではこの機能は利用できません。\n' +
      'Supabase SQL Editor から 004_seed_initial_data.sql を再実行してデータをリセットしてください。'
    );
  }
}

export const supabaseRepository: DataRepository = new SupabaseRepository();
