// =============================================================================
// src/pages/EmployeeHomePage.tsx
// employee ロール専用ホーム画面
//
// admin は既存の HomePage.tsx を使用する。
// =============================================================================
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { MovementCard } from '../components/MovementCard';
import { useAppData } from '../hooks/useAppData';
import { useAuth } from '../contexts/AuthContext';
import { getMovementsWithRelations } from '../repository/selectors';

export function EmployeeHomePage() {
  const { profile, signOut } = useAuth();
  const { movements, items, locations, loading } = useAppData();

  // 自分の最近の登録:
  // - registeredByUserId === profile.id でフィルタ(ログイン機能追加後に登録した分のみ)
  // - 旧データには registeredByUserId がないため、古い履歴はヒットしない仕様
  const myMovements = useMemo(() => {
    if (!profile) return [];
    const all = getMovementsWithRelations(movements, items, locations);
    return all
      .filter((m) => m.registeredByUserId === profile.id)
      .slice(0, 5);
  }, [movements, items, locations, profile]);

  return (
    <div className="app-shell">
      <Header title="工具・備品管理" showBack={false} showNav />
      <main className="page page--narrow">
        {/* ユーザー情報バー */}
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

        {/* 主要操作 */}
        <p className="section-title" style={{ marginTop: 0 }}>登録する</p>
        <Link to="/qr-scan" className="btn btn--secondary btn--block" style={{ marginBottom: 'var(--space-2)' }}>
          QRコードで読み取って登録
        </Link>
        <Link to="/search" className="btn btn--primary btn--block">
          手入力で物品を検索して登録
        </Link>

        {/* 自分の最近の登録 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 'var(--space-5)',
          }}
        >
          <p className="section-title" style={{ marginTop: 0 }}>自分の最近の登録</p>
        </div>
        <p className="form-hint" style={{ marginBottom: 'var(--space-2)' }}>
          ログイン機能追加後に登録した履歴のみ表示されます。
        </p>

        {loading ? (
          <div className="empty-state">読み込み中…</div>
        ) : myMovements.length === 0 ? (
          <div className="empty-state">まだ登録履歴がありません。</div>
        ) : (
          <div className="list">
            {myMovements.map((m) => (
              <MovementCard key={m.id} movement={m} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
