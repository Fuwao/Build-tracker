import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { MovementForm } from '../components/MovementForm';
import { useAppData } from '../hooks/useAppData';
import { useAuth } from '../contexts/AuthContext';
import { getActiveLocations } from '../repository/selectors';

export function OutboundPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const { items, locations, categories, loading, error, reload } = useAppData();
  const { profile } = useAuth();
  const isEmployee = profile?.role === 'employee';

  const item = useMemo(() => items.find((i) => i.id === itemId), [items, itemId]);
  const siteLocations = useMemo(
    () => getActiveLocations(locations).filter((l) => l.locationType === 'site'),
    [locations]
  );

  if (loading) {
    return (
      <div className="app-shell">
        <Header title="出庫登録" />
        <main className="page page--narrow"><div className="empty-state">読み込み中…</div></main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-shell">
        <Header title="出庫登録" />
        <main className="page page--narrow">
          <div className="error-banner">{error}</div>
          <button type="button" className="btn btn--primary btn--block" onClick={reload}>再試行</button>
          <Link to="/" className="btn btn--secondary btn--block">ホームへ戻る</Link>
        </main>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="app-shell">
        <Header title="出庫登録" />
        <main className="page page--narrow">
          <div className="error-banner">対象の物品が見つかりません。検索しなおしてください。</div>
          <Link to="/search" className="btn btn--primary btn--block">手入力検索へ戻る</Link>
        </main>
      </div>
    );
  }

  // employee: 出庫は「置場にある」物品のみ許可。それ以外はURLを直接入力しても拒否。
  if (isEmployee && (!item.isActive || item.currentStatus !== 'storage')) {
    return (
      <div className="app-shell">
        <Header title="出庫登録" />
        <main className="page page--narrow">
          <div className="error-banner">
            {!item.isActive
              ? 'この物品は使用停止中です。'
              : item.currentStatus === 'repair'
                ? 'この物品は修理中のため、管理者のみ操作できます。'
                : item.currentStatus === 'other'
                  ? 'この物品は所在不明のため、管理者のみ操作できます。'
                  : 'この物品は現在出庫できる状態にありません。'}
          </div>
          <Link to={`/items/${item.id}`} className="btn btn--secondary btn--block">物品確認に戻る</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Header title="出庫登録" />
      <main className="page page--narrow page--with-bottom-bar">
        <MovementForm
          item={item}
          locations={locations}
          categories={categories}
          movementType="outbound"
          destinationLabel="移動先の現場"
          destinationLocations={siteLocations}
          submitLabel="出庫する"
          emptyDestinationMessage="現場が登録されていません。場所・現場管理から現場を登録してください。"
        />
      </main>
    </div>
  );
}
