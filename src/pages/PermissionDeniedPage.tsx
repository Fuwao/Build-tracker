import { Link } from 'react-router-dom';
import { Header } from '../components/Header';

export function PermissionDeniedPage() {
  return (
    <div className="app-shell">
      <Header title="アクセス制限" />
      <main className="page page--narrow">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 'var(--space-3)',
            marginTop: 'var(--space-6)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'var(--color-danger-soft)',
              color: 'var(--color-danger)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
            }}
          >
            🔒
          </div>
          <h2 style={{ fontSize: 'var(--font-size-heading)', fontWeight: 700 }}>
            アクセスできません
          </h2>
          <p style={{ color: 'var(--color-text-sub)' }}>
            このページを表示する権限がありません。
          </p>
          <Link to="/" className="btn btn--primary btn--block">
            ホームへ戻る
          </Link>
        </div>
      </main>
    </div>
  );
}
