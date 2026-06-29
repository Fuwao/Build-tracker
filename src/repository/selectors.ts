// 全関数が純粋関数(引数として渡された配列のみを参照し、副作用なし)。
// repository を直接 import しない。
// 各ページが useEffect で取得済みの配列を引数として渡し、
// useMemo 内でこれらの関数を呼び出して表示用データを導出する。
import type { Category, Item, ItemWithRelations, Location, Movement, MovementWithRelations } from '../types';

export function getActiveLocations(locations: Location[]): Location[] {
  return locations.filter((l) => l.isActive);
}

export function getActiveCategories(categories: Category[]): Category[] {
  return categories.filter((c) => c.isActive);
}

export function getLocationName(locations: Location[], locationId: string): string {
  const loc = locations.find((l) => l.id === locationId);
  return loc ? loc.locationName : '不明な場所';
}

export function getCategoryName(categories: Category[], categoryId: string): string {
  const cat = categories.find((c) => c.id === categoryId);
  return cat ? cat.name : '未分類';
}

export function toItemWithRelations(item: Item, locations: Location[], categories: Category[]): ItemWithRelations {
  return {
    ...item,
    categoryName: getCategoryName(categories, item.categoryId),
    locationName: getLocationName(locations, item.currentLocationId),
  };
}

export function getItemsWithRelations(
  items: Item[],
  locations: Location[],
  categories: Category[],
  includeInactive = false
): ItemWithRelations[] {
  return items
    .filter((i) => includeInactive || i.isActive)
    .map((i) => toItemWithRelations(i, locations, categories));
}

export function getMovementsWithRelations(
  movements: Movement[],
  items: Item[],
  locations: Location[]
): MovementWithRelations[] {
  // デバッグ: 実際のデータを確認する (問題の原因特定後に削除可)
  if (movements.length > 0 || items.length > 0) {
    console.debug('[selectors] getMovementsWithRelations:', {
      movementCount: movements.length,
      itemCount: items.length,
      sampleMovement: movements[0] ? {
        id: movements[0].id,
        itemId: movements[0].itemId,
        _itemName: movements[0]._itemName,
        _managementNumber: movements[0]._managementNumber,
      } : null,
      sampleItem: items[0] ? { id: items[0].id, itemName: items[0].itemName } : null,
    });
  }

  return movements
    .map((m: Movement) => {
      // 優先順: Supabase JOIN で事前取得した値 → インメモリ検索 → フォールバック
      const item = m._itemName ? undefined : items.find((i) => i.id === m.itemId);
      const fromName = m._fromLocationName ?? getLocationName(locations, m.fromLocationId);
      const toName   = m._toLocationName   ?? getLocationName(locations, m.toLocationId);
      const siteLocationName = m.movementType === 'inbound' ? fromName : toName;
      const siteLocationId   = m.movementType === 'inbound' ? m.fromLocationId : m.toLocationId;
      return {
        ...m,
        // 事前結合データを優先。なければインメモリ検索結果。どちらもなければ '不明'
        managementNumber: m._managementNumber ?? item?.managementNumber ?? '不明',
        itemName:         m._itemName         ?? item?.itemName         ?? '不明な物品',
        fromLocationName: fromName,
        toLocationName:   toName,
        siteLocationName,
        siteLocationId,
      };
    })
    .sort((a, b) => {
      // movedAt を優先、なければ createdAt でフォールバック
      const aTime = new Date(a.movedAt ?? a.createdAt ?? 0).getTime();
      const bTime = new Date(b.movedAt ?? b.createdAt ?? 0).getTime();
      return bTime - aTime; // 降順(最新が先頭)
    });
}

export interface HomeCounts {
  storage: number;
  site: number;
  unknown: number;
}

export function getHomeCounts(items: Item[]): HomeCounts {
  const active = items.filter((i) => i.isActive);
  return {
    // storage は両システムで同じ値
    storage: active.filter((i) => i.currentStatus === 'storage').length,
    // site(localStorage) OR onsite(Supabase) で現場にある
    site: active.filter((i) => i.currentStatus === 'site' || i.currentStatus === 'onsite').length,
    // other(localStorage) OR unknown(Supabase) OR inactive で所在不明・使用停止扱い
    unknown: active.filter((i) =>
      i.currentStatus === 'other' || i.currentStatus === 'unknown' || i.currentStatus === 'inactive'
    ).length,
  };
}

export function searchItems(
  items: Item[],
  locations: Location[],
  categories: Category[],
  query: string
): ItemWithRelations[] {
  const all = getItemsWithRelations(items, locations, categories);
  const q = query.trim().toLowerCase();
  if (!q) return all;
  return all.filter(
    (i) =>
      i.managementNumber.toLowerCase().includes(q) ||
      i.itemName.toLowerCase().includes(q) ||
      i.categoryName.toLowerCase().includes(q)
  );
}
