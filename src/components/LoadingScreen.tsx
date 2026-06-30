// 認証確認中・データ取得中に表示するローディング画面
// return null は禁止。必ずこのコンポーネントを返す。
interface LoadingScreenProps {
  message?: string;
  /** 5秒以上かかっている場合などに表示する補足メッセージ */
  subMessage?: string;
  /** true の場合「再読み込み」ボタンを表示する */
  showReload?: boolean;
}

export function LoadingScreen({ message = '読み込み中…', subMessage, showReload = false }: LoadingScreenProps) {
  return (
    <div
      className="app-shell"
      style={{ alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}
    >
      <div style={{ textAlign: 'center', color: 'var(--color-text-sub)', padding: 'var(--space-5)', maxWidth: 320 }}>
        <div
          style={{
            width: 36,
            height: 36,
            border: '3px solid var(--color-border)',
            borderTop: '3px solid var(--color-accent)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto var(--space-3)',
          }}
        />
        <p style={{ margin: 0, fontSize: 'var(--font-size-body)' }}>{message}</p>

        {subMessage ? (
          <>
            <p
              style={{
                marginTop: 'var(--space-3)',
                fontSize: 'var(--font-size-caption)',
                color: 'var(--color-text-sub)',
                whiteSpace: 'pre-line',
                lineHeight: 1.6,
              }}
            >
              {subMessage}
            </p>
            {showReload ? (
              <button
                type="button"
                className="btn btn--primary btn--block"
                style={{ marginTop: 'var(--space-3)' }}
                onClick={() => window.location.reload()}
              >
                再読み込み
              </button>
            ) : null}
          </>
        ) : null}
      </div>
      {/* スピナーアニメーション */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
