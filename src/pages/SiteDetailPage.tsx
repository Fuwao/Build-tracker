import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { ItemCard } from '../components/ItemCard';
import { MovementCard } from '../components/MovementCard';
import { EmptyState } from '../components/EmptyState';
import { useAppData } from '../hooks/useAppData';
import { getItemsWithRelations, getMovementsWithRelations } from '../repository/selectors';

export function SiteDetailPage() {
  const { locationId } = useParams<{ locationId: string }>();
  const { items, locations, categories, movements, loading, error, reload } = useAppData();

  const location = useMemo(() => locations.find((l) => l.id === locationId), [locations, locationId]);
  const allItems = useMemo(() => getItemsWithRelations(items, locations, categories), [items, locations, categories]);
  const allMovements = useMemo(() => getMovementsWithRelations(movements, items, locations), [movements, items, locations]);

  const currentItems = useMemo(
    () => allItems.filter((i) => i.currentLocationId === locationId),
    [allItems, locationId]
  );
  const returnedItems = useMemo(
    () => allItems.filter((i) => !i.isActive || i.currentLocationId !== locationId).filter(
      () => allMovements.some((m) => m.siteLocationId === locationId)
    ).slice(0, 0), // placeholder — actual logic: items that moved FROM this site
    []
  );
  const siteMovements = useMemo(
    () => allMovements.filter((m) => m.siteLocationId === locationId),
    [allMovements, locationId]
  );

  if (loading) {
    return (
      <div className="app-shell">
        <Header title="現場別確認" />
        <main className="page page--narrow"><div className="empty-state">読み込み中…</div></main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-shell">
        <Header title="現場別確認" />
        <main className="page page--narrow">
          <div className="error-banner">{error}</div>
          <button type="button" className="btn btn--primary btn--block" onClick={reload}>再試行</button>
          <Link to="/" className="btn btn--secondary btn--block">ホームへ戻る</Link>
        </main>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="app-shell">
        <Header title="現場別確認" />
        <main className="page page--narrow">
          <div className="error-banner">該当する現場が見つかりません。</div>
          <Link to="/current-locations" className="btn btn--primary btn--block">現在地一覧へ戻る</Link>
        </main>
      </div>
    );
  }

  // 現在ここにある物品(返却済みを別途カウントするのではなく、シンプルに現在地==this site)
  const itemsHere = allItems.filter((i) => i.currentLocationId === locationId && i.isActive);
  // 過去にこの現場を経由した移動
  const movementsHere = allMovements.filter((m) => m.siteLocationId === locationId);
  void currentItems; void returnedItems; void siteMovements;

  return (
    <div className="app-shell">
      <Header title="現場別確認" />
      <main className="page page--narrow">
        <p className="page-lead">{location.locationName} の現在の状況と履歴です。</p>

        <p className="section-title">現在ここにある物品 ({itemsHere.length}件)</p>
        {itemsHere.length === 0 ? (
          <EmptyState message="現在この現場にある物品はありません。" />
        ) : (
          <div className="list">{itemsHere.map((i) => <ItemCard key={i.id} item={i} />)}</div>
        )}

        <p className="section-title">この現場の移動履歴 ({movementsHere.length}件)</p>
        {movementsHere.length === 0 ? (
          <EmptyState message="移動履歴がありません。" />
        ) : (
          <div className="list">{movementsHere.map((m) => <MovementCard key={m.id} movement={m} />)}</div>
        )}
      </main>
    </div>
  );
}
