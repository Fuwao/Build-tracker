// 認証確認中・データ取得中に表示するローディング画面
// return null は禁止。必ずこのコンポーネントを返す。
interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = '読み込み中…' }: LoadingScreenProps) {
  return (
    <div
      className="app-shell"
      style={{ alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}
    >
      <div style={{ textAlign: 'center', color: 'var(--color-text-sub)', padding: 'var(--space-5)' }}>
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
      </div>
      {/* スピナーアニメーション */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
