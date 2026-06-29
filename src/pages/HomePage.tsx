import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { useAppData } from '../hooks/useAppData';
import { getHomeCounts } from '../repository/selectors';
import { useAuth } from '../contexts/AuthContext';

export function HomePage() {
  const { items, loading } = useAppData();
  const counts = useMemo(() => getHomeCounts(items), [items]);
  const { profile, signOut } = useAuth();

  return (
    <div className="app-shell">
      <Header title="工具・備品管理" showBack={false} showNav />
      <main className="page page--narrow">
        {/* ユーザー情報バー (モバイル用。デスクトップはヘッダーのナビに表示) */}
        {profile ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-2)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2) var(--space-3)',
              marginBottom: 'var(--space-3)',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-text-sub)' }}>
              ログイン中：
              <strong style={{ color: 'var(--color-text)', marginLeft: 4 }}>{profile.display_name}</strong>
              <span
                style={{
                  marginLeft: 6,
                  background: 'var(--color-accent-soft)',
                  color: 'var(--color-accent)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '1px 6px',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {profile.role}
              </span>
            </span>
            <button
              type="button"
              className="btn btn--secondary"
              style={{ minHeight: 32, padding: '0 12px', fontSize: 13, flexShrink: 0 }}
              onClick={() => { void signOut(); }}
            >
              ログアウト
            </button>
          </div>
        ) : null}

        <p className="page-lead">出庫・入庫・移動を記録して、工具・備品の現在地を管理します。</p>

        <p className="section-title" style={{ marginTop: 0 }}>本日の状況</p>
        <div className="status-strip">
          <div className="status-strip__item">
            <div className="status-strip__value">{loading ? '…' : counts.storage}</div>
            <div className="status-strip__label">置場にある</div>
          </div>
          <div className="status-strip__item">
            <div className="status-strip__value">{loading ? '…' : counts.site}</div>
            <div className="status-strip__label">現場にある</div>
          </div>
          <div className="status-strip__item">
            <div className="status-strip__value">{loading ? '…' : counts.unknown}</div>
            <div className="status-strip__label">所在不明</div>
          </div>
        </div>

        <p className="section-title">主要操作</p>
        <Link to="/qr-scan" className="btn btn--secondary btn--block">
          QRコードで読み取って登録
        </Link>
        <div className="action-list">
          <Link to="/search" className="btn btn--primary btn--block">出庫する</Link>
          <Link to="/search" className="btn btn--primary btn--block">置場へ戻す</Link>
          <Link to="/search" className="btn btn--primary btn--block">別の現場へ移動</Link>
        </div>
        <span className="action-list__hint">対象の物品を検索・選択してから登録します</span>

        <p className="section-title">現在地確認</p>
        <Link to="/current-locations" className="nav-row">
          <span className="nav-row__label">現在地一覧を見る</span>
          <span className="nav-row__chevron" aria-hidden>›</span>
        </Link>

        <p className="section-title">履歴確認</p>
        <Link to="/history" className="nav-row">
          <span className="nav-row__label">出庫・入庫・移動の履歴を見る</span>
          <span className="nav-row__chevron" aria-hidden>›</span>
        </Link>

        <div className="quick-links">
          <Link to="/items" className="quick-link">物品管理</Link>
          <Link to="/locations" className="quick-link">場所・現場管理</Link>
          <Link to="/qr-issue" className="quick-link">QRコード発行</Link>
          <Link to="/settings" className="quick-link">設定</Link>
        </div>
      </main>
    </div>
  );
}
