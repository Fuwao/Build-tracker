import type {
  Category,
  Item,
  Location,
  Movement,
  MovementInput,
  MovementType,
} from '../types';

export interface DataRepository {
  // ---- categories ----
  getCategories(): Promise<Category[]>;

  // ---- locations ----
  getLocations(): Promise<Location[]>;
  getLocationById(id: string): Promise<Location | undefined>;
  createLocation(input: Omit<Location, 'id' | 'createdAt' | 'updatedAt'>): Promise<Location>;
  updateLocation(id: string, input: Partial<Omit<Location, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Location>;

  // ---- items ----
  getItems(): Promise<Item[]>;
  getItemById(id: string): Promise<Item | undefined>;
  getItemByManagementNumber(managementNumber: string): Promise<Item | undefined>;
  createItem(input: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'lastMovedAt' | 'lastPersonName' | 'currentStatus'>): Promise<Item>;
  updateItem(id: string, input: Partial<Omit<Item, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Item>;

  // ---- movements ----
  getMovements(): Promise<Movement[]>;
  getMovementsByItemId(itemId: string): Promise<Movement[]>;

  // ---- 入出庫・移動の共通登録処理(履歴追加+現在地更新を1トランザクションとして扱う) ----
  registerMovement(movementType: MovementType, input: MovementInput): Promise<{ item: Item; movement: Movement }>;

  // ---- 初期化・リセット ----
  ensureSeeded(): Promise<void>;
  resetToSeedData(): Promise<void>;
}
