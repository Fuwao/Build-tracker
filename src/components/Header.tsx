import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  showNav?: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  admin:    'admin',
  employee: '現場',
};

export function Header({ title, showBack = true, showNav = false }: HeaderProps) {
  const navigate = useNavigate();
  const { profile, authStatus, signOut } = useAuth();

  const isReady   = authStatus === 'ready' && profile;
  const isAdmin   = isReady && profile.role === 'admin';

  return (
    <header className="header">
      {showBack ? (
        <button
          type="button"
          className="header__back"
          aria-label="戻る"
          onClick={() => navigate(-1)}
        >
          ‹
        </button>
      ) : null}

      <h1 className="header__title">{title}</h1>

      {showNav ? (
        <nav className="header__nav" style={{ alignItems: 'center' }}>
          {/* admin: 管理系リンク全表示 */}
          {isAdmin ? (
            <>
              <Link to="/items">物品管理</Link>
              <Link to="/locations">場所・現場管理</Link>
              <Link to="/qr-issue">QR発行</Link>
              <Link to="/settings">設定</Link>
            </>
          ) : isReady ? (
            /* employee: 現場操作リンクのみ */
            <>
              <Link to="/qr-scan">QR登録</Link>
              <Link to="/search">手入力登録</Link>
            </>
          ) : null}

          {/* 全ロール共通: ユーザー名・role・ログアウトボタン */}
          {isReady ? (
            <>
              <span
                style={{
                  borderLeft: '1px solid var(--color-border)',
                  paddingLeft: 'var(--space-3)',
                  fontSize: 13,
                  color: 'var(--color-text-sub)',
                  whiteSpace: 'nowrap',
                }}
              >
                {profile.display_name}
                <span
                  style={{
                    marginLeft: 4,
                    background: 'var(--color-accent-soft)',
                    color: 'var(--color-accent)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '1px 5px',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {ROLE_LABEL[profile.role] ?? profile.role}
                </span>
              </span>
              <button
                type="button"
                className="btn btn--secondary"
                style={{ minHeight: 32, padding: '0 12px', fontSize: 13 }}
                onClick={() => { void signOut(); }}
              >
                ログアウト
              </button>
            </>
          ) : null}
        </nav>
      ) : null}
    </header>
  );
}
