import { useCallback, useEffect, useState } from 'react';
import { repository } from '../repository';
import type { Category, Item, Location, Movement } from '../types';

export interface AppData {
  items: Item[];
  locations: Location[];
  categories: Category[];
  movements: Movement[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * 全4リソース(items / locations / categories / movements)を並列取得する共通フック。
 * localStorageは内部的に同期なので遅延は実質ゼロだが、インターフェースは非同期で
 * 統一しておくことで Supabase 差し替え時の変更を最小化する。
 *
 * 使い方:
 *   const { items, locations, loading, error, reload } = useAppData()
 *   const activeLocations = useMemo(() => getActiveLocations(locations), [locations])
 */
export function useAppData(): AppData {
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [i, l, c, m] = await Promise.all([
          repository.getItems(),
          repository.getLocations(),
          repository.getCategories(),
          repository.getMovements(),
        ]);
        if (!cancelled) {
          setItems(i);
          setLocations(l);
          setCategories(c);
          setMovements(m);
        }
      } catch {
        if (!cancelled) setError('データの読み込みに失敗しました。再試行してください。');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [reloadKey]);

  return { items, locations, categories, movements, loading, error, reload };
}
