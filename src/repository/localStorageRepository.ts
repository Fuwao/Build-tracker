// [Supabase移行に向けた調査メモ]
// このファイル(および ./types.ts の DataRepository インターフェース)は、
// 全メソッドが async 関数として定義されているが、localStorage自体は同期処理のため
// 内部ロジックはすべて同期のまま実行される。
// SupabaseのクライアントAPIは全て非同期(Promiseを返す)であるため、
// 移行時にはこのファイルを supabaseRepository.ts に差し替える。
// 差し替えは src/repository/index.ts の1行を変えるだけで対応できる。
//
// registerMovement の2つの writeArray 呼び出しについて:
// localStorage には複数キーをまたいだトランザクション機構がなく、
// movements の書き込みが成功して items の書き込みが失敗すると不整合が生じる。
// Supabase移行時は単一の Postgres 関数(RPC)で実行し原子性を確保すること。
import type {
  Category,
  Item,
  Location,
  Movement,
  MovementInput,
  MovementType,
  ItemStatus,
} from '../types';
import { buildSeedData } from '../data/seedData';
import { generateId } from '../utils/id';
import { nowIso } from '../utils/date';
import type { DataRepository } from './types';

const STORAGE_KEYS = {
  items: 'item-tracker-items-v1',
  locations: 'item-tracker-locations-v1',
  categories: 'item-tracker-categories-v1',
  movements: 'item-tracker-movements-v1',
} as const;

function readArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as T[];
  } catch (e) {
    console.error(`localStorageの読み込みに失敗しました(key=${key})`, e);
    return [];
  }
}

function writeArray<T>(key: string, value: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`localStorageの保存に失敗しました(key=${key})`, e);
    throw new Error('データの保存に失敗しました。ストレージの空き容量を確認してください。');
  }
}

function statusFromLocationType(locationType: Location['locationType']): ItemStatus {
  return locationType;
}

class LocalStorageRepository implements DataRepository {
  // ---------- categories ----------
  async getCategories(): Promise<Category[]> {
    return readArray<Category>(STORAGE_KEYS.categories);
  }

  // ---------- locations ----------
  async getLocations(): Promise<Location[]> {
    return readArray<Location>(STORAGE_KEYS.locations);
  }

  async getLocationById(id: string): Promise<Location | undefined> {
    return readArray<Location>(STORAGE_KEYS.locations).find((l) => l.id === id);
  }

  async createLocation(input: Omit<Location, 'id' | 'createdAt' | 'updatedAt'>): Promise<Location> {
    const locations = readArray<Location>(STORAGE_KEYS.locations);
    const ts = nowIso();
    const newLocation: Location = {
      ...input,
      id: generateId('loc'),
      createdAt: ts,
      updatedAt: ts,
    };
    locations.push(newLocation);
    writeArray(STORAGE_KEYS.locations, locations);
    return newLocation;
  }

  async updateLocation(id: string, input: Partial<Omit<Location, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Location> {
    const locations = readArray<Location>(STORAGE_KEYS.locations);
    const idx = locations.findIndex((l) => l.id === id);
    if (idx === -1) throw new Error('対象の場所が見つかりません');
    const updated: Location = { ...locations[idx], ...input, updatedAt: nowIso() };
    locations[idx] = updated;
    writeArray(STORAGE_KEYS.locations, locations);
    return updated;
  }

  // ---------- items ----------
  async getItems(): Promise<Item[]> {
    return readArray<Item>(STORAGE_KEYS.items);
  }

  async getItemById(id: string): Promise<Item | undefined> {
    return readArray<Item>(STORAGE_KEYS.items).find((i) => i.id === id);
  }

  async getItemByManagementNumber(managementNumber: string): Promise<Item | undefined> {
    const target = managementNumber.trim().toLowerCase();
    return readArray<Item>(STORAGE_KEYS.items).find((i) => i.managementNumber.toLowerCase() === target);
  }

  async createItem(
    input: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'lastMovedAt' | 'lastPersonName' | 'currentStatus'>
  ): Promise<Item> {
    const items = readArray<Item>(STORAGE_KEYS.items);
    const location = readArray<Location>(STORAGE_KEYS.locations).find((l) => l.id === input.currentLocationId);
    const ts = nowIso();
    const newItem: Item = {
      ...input,
      id: generateId('item'),
      currentStatus: location ? statusFromLocationType(location.locationType) : 'other',
      lastMovedAt: null,
      lastPersonName: '',
      createdAt: ts,
      updatedAt: ts,
    };
    items.push(newItem);
    writeArray(STORAGE_KEYS.items, items);
    return newItem;
  }

  async updateItem(id: string, input: Partial<Omit<Item, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Item> {
    const items = readArray<Item>(STORAGE_KEYS.items);
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) throw new Error('対象の物品が見つかりません');
    let next: Item = { ...items[idx], ...input, updatedAt: nowIso() };
    if (input.currentLocationId && input.currentLocationId !== items[idx].currentLocationId) {
      const location = readArray<Location>(STORAGE_KEYS.locations).find((l) => l.id === input.currentLocationId);
      next = { ...next, currentStatus: location ? statusFromLocationType(location.locationType) : 'other' };
    }
    items[idx] = next;
    writeArray(STORAGE_KEYS.items, items);
    return next;
  }

  // ---------- movements ----------
  async getMovements(): Promise<Movement[]> {
    const all = readArray<Movement>(STORAGE_KEYS.movements);
    // 最新が先頭になるよう並び替え(movedAt 降順、同値なら createdAt 降順)
    return all.sort((a, b) => {
      const aTime = new Date(a.movedAt ?? a.createdAt ?? 0).getTime();
      const bTime = new Date(b.movedAt ?? b.createdAt ?? 0).getTime();
      if (bTime !== aTime) return bTime - aTime;
      return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
    });
  }

  async getMovementsByItemId(itemId: string): Promise<Movement[]> {
    const all = readArray<Movement>(STORAGE_KEYS.movements).filter((m) => m.itemId === itemId);
    return all.sort((a, b) => {
      const aTime = new Date(a.movedAt ?? a.createdAt ?? 0).getTime();
      const bTime = new Date(b.movedAt ?? b.createdAt ?? 0).getTime();
      if (bTime !== aTime) return bTime - aTime;
      return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
    });
  }

  // 入出庫・移動の共通登録処理。履歴追加と現在地更新を必ずセットで行う。
  // registeredByName(ログイン連携) → personName(旧フリー入力) の優先順で登録者名を決定する。
  async registerMovement(movementType: MovementType, input: MovementInput): Promise<{ item: Item; movement: Movement }> {
    const items = readArray<Item>(STORAGE_KEYS.items);
    const item = items.find((i) => i.id === input.itemId);
    if (!item) {
      throw new Error('対象の物品が見つかりません。検索しなおしてください。');
    }
    const locations = readArray<Location>(STORAGE_KEYS.locations);
    const toLocation = locations.find((l) => l.id === input.toLocationId);
    if (!toLocation) {
      throw new Error('移動先の場所が見つかりません。');
    }

    // 登録者名: 新フィールド → 旧フィールド の優先順で解決
    const resolvedName = (input.registeredByName || input.personName || '').trim();
    if (!resolvedName) {
      throw new Error('登録者情報が設定されていません。再ログインしてください。');
    }
    if (!input.movedAt) {
      throw new Error('日付を入力してください。');
    }

    const fromLocationId = item.currentLocationId;
    const ts = nowIso();

    const movement: Movement = {
      id: generateId('mov'),
      itemId: item.id,
      movementType,
      fromLocationId,
      toLocationId: input.toLocationId,
      movedAt: input.movedAt,
      personName: resolvedName,                                 // 後方互換用
      registeredByName: input.registeredByName ?? resolvedName, // 新フィールド
      registeredByUserId: input.registeredByUserId,
      notes: input.notes ?? '',
      createdAt: ts,
    };

    const movements = readArray<Movement>(STORAGE_KEYS.movements);
    movements.push(movement);

    const updatedItem: Item = {
      ...item,
      currentLocationId: input.toLocationId,
      currentStatus: statusFromLocationType(toLocation.locationType),
      lastMovedAt: input.movedAt,
      lastPersonName: resolvedName,                                  // 後方互換用
      lastRegisteredByName: input.registeredByName ?? resolvedName,  // 新フィールド
      lastRegisteredByUserId: input.registeredByUserId,
      updatedAt: ts,
    };
    const idx = items.findIndex((i) => i.id === item.id);
    if (idx === -1) {
      throw new Error('対象の物品が見つかりません。検索しなおしてください。');
    }
    items[idx] = updatedItem;

    // 履歴と現在地更新を1セットで保存する(片方だけ保存される状態を防ぐ)
    writeArray(STORAGE_KEYS.movements, movements);
    writeArray(STORAGE_KEYS.items, items);

    return { item: updatedItem, movement };
  }

  // ---------- 初期化・リセット ----------
  async ensureSeeded(): Promise<void> {
    const hasItemsKey = localStorage.getItem(STORAGE_KEYS.items) !== null;
    if (hasItemsKey) return;
    this.seedAll();
  }

  async resetToSeedData(): Promise<void> {
    this.seedAll();
  }

  private seedAll(): void {
    const seed = buildSeedData();
    writeArray(STORAGE_KEYS.categories, seed.categories);
    writeArray(STORAGE_KEYS.locations, seed.locations);
    writeArray(STORAGE_KEYS.items, seed.items);
    writeArray(STORAGE_KEYS.movements, seed.movements);
  }
}

export const repository: DataRepository = new LocalStorageRepository();
