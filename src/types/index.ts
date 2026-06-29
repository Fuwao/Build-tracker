// ===== 場所種別 =====
// 'unknown' を Supabase 版で追加(DB: unknown → 所在不明の場所)
export type LocationType = 'storage' | 'site' | 'repair' | 'unknown' | 'other';

// ===== 物品の現在状態 =====
// Supabase DB: storage | onsite | repair | unknown | inactive
// localStorage 旧値: storage | site | repair | other
// 両システムの値をすべてサポートする
export type ItemStatus =
  | 'storage'   // 置場にある
  | 'site'      // 現場にある(localStorage)
  | 'onsite'    // 現場にある(Supabase DB)
  | 'repair'    // 修理中
  | 'other'     // 所在不明(localStorage)
  | 'unknown'   // 所在不明(Supabase DB)
  | 'inactive'; // 使用停止(Supabase DB: is_active=false)

// ===== 移動種別 =====
export type MovementType = 'outbound' | 'inbound' | 'transfer';

export interface Category {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Location {
  id: string;
  locationName: string;
  locationType: LocationType;
  // [調査メモ] startDateは型上は単なるstringだが、フォームからの入力は
  // "YYYY-MM-DD"形式、seedData.ts内では new Date().toISOString() による
  // フルのISO日時文字列を入れている。実際にフォームの<input type="date">に
  // 表示する際は日時部分が無視され表示が崩れる(既存の小さな不整合)。
  // Supabase移行時にdate型のカラムにするなら、このタイミングで統一するとよい。
  startDate: string;
  endDate: string | null;
  notes: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Item {
  id: string;
  managementNumber: string;
  itemName: string;
  categoryId: string;
  manufacturer: string;
  modelNumber: string;
  serialNumber: string;
  currentLocationId: string;
  currentStatus: ItemStatus;
  lastMovedAt: string | null;
  /** 後方互換用: 旧フリー入力の担当者名。新規登録では lastRegisteredByName を使用。 */
  lastPersonName: string;
  /** ログイン機能追加後の登録者表示名スナップショット(新規登録のみ)。既存データは undefined。 */
  lastRegisteredByName?: string;
  /** ログイン機能追加後の登録者 Supabase Auth ID(新規登録のみ)。既存データは undefined。 */
  lastRegisteredByUserId?: string;
  notes: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Movement {
  id: string;
  itemId: string;
  movementType: MovementType;
  fromLocationId: string;
  toLocationId: string;
  movedAt: string;
  /** 後方互換用: 旧フリー入力の担当者名。新規登録では registeredByName を使用。 */
  personName: string;
  /** ログイン機能追加後の登録者表示名スナップショット(新規登録のみ)。既存データは undefined。 */
  registeredByName?: string;
  /** ログイン機能追加後の登録者 Supabase Auth ID(新規登録のみ)。既存データは undefined。 */
  registeredByUserId?: string;
  notes: string;
  createdAt: string;

  // Supabase JOIN で事前取得した表示用フィールド。
  // localStorage 版では undefined になる(selectors.ts がインメモリで補完する)。
  _itemName?: string;
  _managementNumber?: string;
  _fromLocationName?: string;
  _toLocationName?: string;
}

// ===== 入出庫・移動の登録用入力 =====
export interface MovementInput {
  itemId: string;
  toLocationId: string;
  movedAt: string;
  /** @deprecated ログイン機能導入前の後方互換フィールド。新規呼び出しでは使わない。 */
  personName?: string;
  /** ログイン中ユーザーの Supabase Auth ID */
  registeredByUserId?: string;
  /** ログイン中ユーザーの表示名スナップショット */
  registeredByName?: string;
  notes: string;
}

// ===== 一覧表示用の結合データ =====
export interface ItemWithRelations extends Item {
  categoryName: string;
  locationName: string;
}

export interface MovementWithRelations extends Movement {
  managementNumber: string;
  itemName: string;
  fromLocationName: string;
  toLocationName: string;
  siteLocationName: string; // 現場名(現場別表示用。outbound/transferのtoLocation、inboundのfromLocationなど現場側を指す)
  siteLocationId: string;
}

export const STATUS_LABEL: Record<ItemStatus, string> = {
  storage:  '置場にある',
  site:     '現場にある',    // localStorage 旧値
  onsite:   '現場にある',    // Supabase DB 値
  repair:   '修理中',
  other:    '所在不明',      // localStorage 旧値
  unknown:  '所在不明',      // Supabase DB 値
  inactive: '使用停止',      // Supabase DB 値
};

export const LOCATION_TYPE_LABEL: Record<LocationType, string> = {
  storage: '置場',
  site:    '現場',
  repair:  '修理先',
  unknown: '所在不明',  // Supabase 追加
  other:   'その他',
};

export const MOVEMENT_TYPE_LABEL: Record<MovementType, string> = {
  outbound: '出庫',
  inbound: '入庫',
  transfer: '移動',
};
