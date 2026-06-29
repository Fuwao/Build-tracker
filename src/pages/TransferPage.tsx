import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { MovementForm } from '../components/MovementForm';
import { useAppData } from '../hooks/useAppData';
import { useAuth } from '../contexts/AuthContext';
import { getActiveLocations } from '../repository/selectors';

export function TransferPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const { items, locations, categories, loading, error, reload } = useAppData();
  const { profile } = useAuth();
  const isEmployee = profile?.role === 'employee';

  const item = useMemo(() => items.find((i) => i.id === itemId), [items, itemId]);
  const destinations = useMemo(
    () => {
      // [調査メモ] 現在の移動先は「現在地以外の有効な場所すべて」(置場・修理先・その他も含む)。
      // 将来の権限制御仕様では employee 向けには locationType==='site' まで絞り込む必要がある。
      return getActiveLocations(locations).filter((l) => l.id !== item?.currentLocationId);
    },
    [locations, item]
  );

  if (loading) {
    return (
      <div className="app-shell">
        <Header title="移動登録" />
        <main className="page page--narrow"><div className="empty-state">読み込み中…</div></main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-shell">
        <Header title="移動登録" />
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
        <Header title="移動登録" />
        <main className="page page--narrow">
          <div className="error-banner">対象の物品が見つかりません。検索しなおしてください。</div>
          <Link to="/search" className="btn btn--primary btn--block">手入力検索へ戻る</Link>
        </main>
      </div>
    );
  }

  // employee: 移動は「現場にある」物品のみ許可
  if (isEmployee && (!item.isActive || item.currentStatus !== 'site' && item.currentStatus !== 'onsite')) {
    return (
      <div className="app-shell">
        <Header title="移動登録" />
        <main className="page page--narrow">
          <div className="error-banner">
            {!item.isActive ? 'この物品は使用停止中です。'
              : item.currentStatus === 'repair' ? 'この物品は修理中のため、管理者のみ操作できます。'
              : ['other','unknown'].includes(item.currentStatus) ? 'この物品は所在不明のため、管理者のみ操作できます。'
              : 'この物品は現在移動できる状態にありません。'}
          </div>
          <Link to={`/items/${item.id}`} className="btn btn--secondary btn--block">物品確認に戻る</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Header title="移動登録" />
      <main className="page page--narrow page--with-bottom-bar">
        <MovementForm
          item={item}
          locations={locations}
          categories={categories}
          movementType="transfer"
          destinationLabel="移動先"
          destinationLocations={destinations}
          submitLabel="移動する"
          emptyDestinationMessage="移動先となる場所が登録されていません。場所・現場管理から登録してください。"
        />
      </main>
    </div>
  );
}
