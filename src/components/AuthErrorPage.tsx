// profile取得失敗・無効アカウント用のエラー画面
// ログアウトボタンで別のアカウントでログインし直せる
import { useAuth, type AuthStatus } from '../contexts/AuthContext';

interface AuthErrorPageProps {
  status: Extract<AuthStatus, 'profile_missing' | 'inactive' | 'profile_error'>;
}

const MESSAGES: Record<AuthErrorPageProps['status'], { title: string; body: string }> = {
  profile_missing: {
    title: 'アカウント情報が見つかりません',
    body: 'アカウント情報が登録されていないか、無効化されている可能性があります。管理者へ連絡してください。',
  },
  inactive: {
    title: 'アカウントが無効です',
    body: 'このアカウントは無効化されています。管理者へ連絡してください。',
  },
  profile_error: {
    title: 'アカウント情報の取得に失敗しました',
    body: 'ネットワークエラーが発生した可能性があります。再試行してください。',
  },
};

export function AuthErrorPage({ status }: AuthErrorPageProps) {
  const { signOut, retryProfile } = useAuth();
  const { title, body } = MESSAGES[status];

  return (
    <div
      className="app-shell"
      style={{ alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: 'var(--color-bg)' }}
    >
      <main
        style={{
          width: '100%',
          maxWidth: 400,
          padding: 'var(--space-5) var(--space-4)',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          margin: 'var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
      >
        <h1 style={{ fontSize: 'var(--font-size-subheading)', fontWeight: 700, color: 'var(--color-text)' }}>
          {title}
        </h1>

        <div className="error-banner">{body}</div>

        {status === 'profile_error' ? (
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={retryProfile}
          >
            再試行する
          </button>
        ) : null}

        <button
          type="button"
          className="btn btn--secondary btn--block"
          onClick={() => { void signOut(); }}
        >
          別のアカウントでログインする
        </button>
      </main>
    </div>
  );
}
