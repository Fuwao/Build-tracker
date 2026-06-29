import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { StatusBadge } from '../components/StatusBadge';
import { useAppData } from '../hooks/useAppData';
import { useAuth } from '../contexts/AuthContext';
import { getCategoryName, getLocationName } from '../repository/selectors';
import { formatDateTime } from '../utils/date';

export function ItemDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const { items, locations, categories, loading, error, reload } = useAppData();

  const item = useMemo(() => items.find((i) => i.id === itemId), [items, itemId]);

  if (loading) {
    return (
      <div className="app-shell">
        <Header title="物品確認" />
        <main className="page page--narrow">
          <div className="empty-state">読み込み中…</div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-shell">
        <Header title="物品確認" />
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
        <Header title="物品確認" />
        <main className="page page--narrow">
          <div className="error-banner">対象の物品が見つかりません。検索しなおしてください。</div>
          <Link to="/search" className="btn btn--primary btn--block">手入力検索へ戻る</Link>
        </main>
      </div>
    );
  }

  const isStorage = item.currentStatus === 'storage';
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  // ここに到達した時点で item は必ず存在する(上の if(!item) で早期 return 済み)
  const resolvedItem = item;

  // ================================================================
  // 操作ボタンの組み立て
  // admin: 既存の3ボタン(状態に応じて有効/無効)
  // employee: 状態に応じた制限表示
  // ================================================================
  function renderBottomActions() { const item = resolvedItem;
    if (isAdmin) {
      // admin: これまで通り全操作表示
      return (
        <div className="bottom-actions">
          <Link
            to={`/items/${item.id}/outbound`}
            className={`btn btn--block ${isStorage ? 'btn--primary' : 'btn--disabled'}`}
            aria-disabled={!isStorage}
            onClick={(e) => { if (!isStorage) e.preventDefault(); }}
          >
            出庫する
          </Link>
          <Link
            to={`/items/${item.id}/inbound`}
            className={`btn btn--block ${!isStorage ? 'btn--primary' : 'btn--disabled'}`}
            aria-disabled={isStorage}
            onClick={(e) => { if (isStorage) e.preventDefault(); }}
          >
            置場へ戻す
          </Link>
          <Link to={`/items/${item.id}/transfer`} className="btn btn--secondary btn--block">
            別の場所へ移動
          </Link>
        </div>
      );
    }

    // employee: 物品の現在状態に応じた操作制限
    if (!item.isActive) {
      return (
        <div className="bottom-actions">
          <div className="error-banner" style={{ border: 'none', background: 'var(--color-disabled-bg)', color: 'var(--color-disabled-text)' }}>
            この物品は使用停止中です。
          </div>
        </div>
      );
    }

    if (item.currentStatus === 'repair') {
      return (
        <div className="bottom-actions">
          <div className="error-banner">この物品は修理中のため、管理者のみ操作できます。</div>
        </div>
      );
    }

    // 所在不明: 'other'(localStorage) または 'unknown'(Supabase)
    if (item.currentStatus === 'other' || item.currentStatus === 'unknown') {
      return (
        <div className="bottom-actions">
          <div className="error-banner">この物品は所在不明のため、管理者のみ操作できます。</div>
        </div>
      );
    }

    if (item.currentStatus === 'storage') {
      // 置場にある → 出庫のみ
      return (
        <div className="bottom-actions">
          <Link to={`/items/${item.id}/outbound`} className="btn btn--primary btn--block">
            出庫する
          </Link>
        </div>
      );
    }

    // 現場にある: 'site'(localStorage) または 'onsite'(Supabase)
    if (item.currentStatus === 'site' || item.currentStatus === 'onsite') {
      // 現場にある → 入庫・移動
      return (
        <div className="bottom-actions">
          <Link to={`/items/${item.id}/inbound`} className="btn btn--primary btn--block">
            置場へ戻す
          </Link>
          <Link to={`/items/${item.id}/transfer`} className="btn btn--secondary btn--block">
            別の現場へ移動
          </Link>
        </div>
      );
    }

    return null;
  }

  return (
    <div className="app-shell">
      <Header title="物品確認" />
      <main className="page page--narrow page--with-bottom-bar">
        <div className="item-heading">
          <span className="item-heading__number">{item.managementNumber}</span>
          <h2 className="item-heading__name">{item.itemName}</h2>
        </div>

        <div className="info-block">
          <div className="info-row info-row--emphasis">
            <span className="info-row__label">現在地</span>
            <span className="info-row__value">{getLocationName(locations, item.currentLocationId)}</span>
          </div>
          <div className="info-row">
            <span className="info-row__label">状態</span>
            <span className="info-row__value"><StatusBadge status={item.currentStatus} /></span>
          </div>
          <div className="info-row">
            <span className="info-row__label">分類</span>
            <span className="info-row__value">{getCategoryName(categories, item.categoryId)}</span>
          </div>
          <div className="info-row">
            <span className="info-row__label">最終更新日</span>
            <span className="info-row__value">{formatDateTime(item.lastMovedAt)}</span>
          </div>
          <div className="info-row">
            <span className="info-row__label">最終担当者</span>
            <span className="info-row__value">
              {(resolvedItem.lastRegisteredByName ?? resolvedItem.lastPersonName) || '-'}
            </span>
          </div>
          {item.notes ? (
            <div className="info-row">
              <span className="info-row__label">備考</span>
              <span className="info-row__value">{item.notes}</span>
            </div>
          ) : null}
        </div>

        <p className="section-title">操作を選択してください</p>
      </main>

      {renderBottomActions()}
    </div>
  );
}
