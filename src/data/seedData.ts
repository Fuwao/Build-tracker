import type { Category, Item, Location, Movement } from '../types';
import { generateId } from '../utils/id';

// 固定IDで初期データを生成する(参照整合性を保つため)

export const SEED_CATEGORY_IDS = {
  powerTool: 'cat_power_tool',
  handTool: 'cat_hand_tool',
  measuring: 'cat_measuring',
  heavy: 'cat_heavy',
  vehicle: 'cat_vehicle',
  supply: 'cat_supply',
  other: 'cat_other',
} as const;

export const SEED_LOCATION_IDS = {
  storageMain: 'loc_storage_main',
  storageMaterial: 'loc_storage_material',
  siteA: 'loc_site_a',
  siteB: 'loc_site_b',
  siteC: 'loc_site_c',
  repair: 'loc_repair',
  unknown: 'loc_unknown',
} as const;

function buildSeedCategories(nowIso: string): Category[] {
  const names: [string, string][] = [
    [SEED_CATEGORY_IDS.powerTool, '電動工具'],
    [SEED_CATEGORY_IDS.handTool, '手工具'],
    [SEED_CATEGORY_IDS.measuring, '測定機器'],
    [SEED_CATEGORY_IDS.heavy, '重機'],
    [SEED_CATEGORY_IDS.vehicle, '車両'],
    [SEED_CATEGORY_IDS.supply, '備品'],
    [SEED_CATEGORY_IDS.other, 'その他'],
  ];
  return names.map(([id, name]) => ({
    id,
    name,
    isActive: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  }));
}

function buildSeedLocations(nowIso: string): Location[] {
  const defs: [string, string, Location['locationType']][] = [
    [SEED_LOCATION_IDS.storageMain, '本社置場', 'storage'],
    [SEED_LOCATION_IDS.storageMaterial, '資材置場', 'storage'],
    [SEED_LOCATION_IDS.siteA, 'テスト現場A', 'site'],
    [SEED_LOCATION_IDS.siteB, 'テスト現場B', 'site'],
    [SEED_LOCATION_IDS.siteC, 'テスト現場C', 'site'],
    [SEED_LOCATION_IDS.repair, '修理中', 'repair'],
    [SEED_LOCATION_IDS.unknown, '所在不明', 'other'],
  ];
  return defs.map(([id, locationName, locationType]) => ({
    id,
    locationName,
    locationType,
    startDate: nowIso,
    endDate: null,
    notes: '',
    isActive: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  }));
}

function buildSeedItemsAndMovements(nowIso: string): { items: Item[]; movements: Movement[] } {
  const items: Item[] = [
    {
      id: generateId('item'),
      managementNumber: 'TOOL-001',
      itemName: '電動ハンマー',
      categoryId: SEED_CATEGORY_IDS.powerTool,
      manufacturer: 'マキタ',
      modelNumber: 'HM1213C',
      serialNumber: 'SN-0001',
      currentLocationId: SEED_LOCATION_IDS.storageMain,
      currentStatus: 'storage',
      lastMovedAt: null,
      lastPersonName: '',
      notes: '',
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: generateId('item'),
      managementNumber: 'TOOL-002',
      itemName: 'インパクトドライバー',
      categoryId: SEED_CATEGORY_IDS.powerTool,
      manufacturer: 'マキタ',
      modelNumber: 'TD172D',
      serialNumber: 'SN-0002',
      currentLocationId: SEED_LOCATION_IDS.siteA,
      currentStatus: 'site',
      lastMovedAt: nowIso,
      lastPersonName: '山田',
      notes: '',
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: generateId('item'),
      managementNumber: 'TOOL-003',
      itemName: '丸ノコ',
      categoryId: SEED_CATEGORY_IDS.powerTool,
      manufacturer: 'HiKOKI',
      modelNumber: 'C6MEY',
      serialNumber: 'SN-0003',
      currentLocationId: SEED_LOCATION_IDS.storageMaterial,
      currentStatus: 'storage',
      lastMovedAt: null,
      lastPersonName: '',
      notes: '',
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: generateId('item'),
      managementNumber: 'TOOL-004',
      itemName: 'レーザー墨出し器',
      categoryId: SEED_CATEGORY_IDS.measuring,
      manufacturer: 'タジマ',
      modelNumber: 'ZIPGREEN',
      serialNumber: 'SN-0004',
      currentLocationId: SEED_LOCATION_IDS.repair,
      currentStatus: 'repair',
      lastMovedAt: nowIso,
      lastPersonName: '佐藤',
      notes: '修理依頼中',
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: generateId('item'),
      managementNumber: 'MACHINE-001',
      itemName: '油圧ショベル',
      categoryId: SEED_CATEGORY_IDS.heavy,
      manufacturer: 'コマツ',
      modelNumber: 'PC30',
      serialNumber: 'SN-0005',
      currentLocationId: SEED_LOCATION_IDS.siteB,
      currentStatus: 'site',
      lastMovedAt: nowIso,
      lastPersonName: '鈴木',
      notes: '',
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: generateId('item'),
      managementNumber: 'VEHICLE-001',
      itemName: '2tダンプ',
      categoryId: SEED_CATEGORY_IDS.vehicle,
      manufacturer: 'いすゞ',
      modelNumber: 'エルフ',
      serialNumber: 'SN-0006',
      currentLocationId: SEED_LOCATION_IDS.storageMain,
      currentStatus: 'storage',
      lastMovedAt: null,
      lastPersonName: '',
      notes: '',
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const movements: Movement[] = [
    {
      id: generateId('mov'),
      itemId: items[1].id, // TOOL-002
      movementType: 'outbound',
      fromLocationId: SEED_LOCATION_IDS.storageMain,
      toLocationId: SEED_LOCATION_IDS.siteA,
      movedAt: nowIso,
      personName: '山田',
      notes: '初期搬入',
      createdAt: nowIso,
    },
    {
      id: generateId('mov'),
      itemId: items[3].id, // TOOL-004
      movementType: 'transfer',
      fromLocationId: SEED_LOCATION_IDS.siteC,
      toLocationId: SEED_LOCATION_IDS.repair,
      movedAt: nowIso,
      personName: '佐藤',
      notes: '故障のため修理へ',
      createdAt: nowIso,
    },
    {
      id: generateId('mov'),
      itemId: items[4].id, // MACHINE-001
      movementType: 'outbound',
      fromLocationId: SEED_LOCATION_IDS.storageMain,
      toLocationId: SEED_LOCATION_IDS.siteB,
      movedAt: nowIso,
      personName: '鈴木',
      notes: '',
      createdAt: nowIso,
    },
  ];

  return { items, movements };
}

export function buildSeedData(): {
  categories: Category[];
  locations: Location[];
  items: Item[];
  movements: Movement[];
} {
  const nowIso = new Date().toISOString();
  const categories = buildSeedCategories(nowIso);
  const locations = buildSeedLocations(nowIso);
  const { items, movements } = buildSeedItemsAndMovements(nowIso);
  return { categories, locations, items, movements };
}
