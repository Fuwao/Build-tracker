// =============================================================================
// src/pages/LoginPage.tsx
// ログイン画面
// アカウント作成は Supabase Dashboard または将来の admin 画面で行う。
// 新規登録フォームはここには含まない。
// =============================================================================
import { useState, type FormEvent } from 'react';
import { supabase, supabaseConfigured } from '../lib/supabase';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Supabase が設定されていない場合は設定案内を表示
  if (!supabaseConfigured || !supabase) {
    return (
      <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
        <main
          style={{
            width: '100%',
            maxWidth: 400,
            padding: 'var(--space-5) var(--space-4)',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            margin: 'var(--space-4)',
          }}
        >
          <h1 style={{ fontSize: 'var(--font-size-heading)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
            工具・備品管理
          </h1>
          <div className="error-banner">
            Supabase の環境変数が設定されていません。
            プロジェクトルートに <code>.env.local</code> を作成し、
            開発サーバーを再起動してください。
          </div>
          <div className="panel" style={{ marginTop: 'var(--space-4)' }}>
            <p className="section-title">.env.local の設定例</p>
            <pre style={{ fontSize: 12, overflowX: 'auto', margin: 0, lineHeight: 1.6 }}>
{`VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...`}
            </pre>
          </div>
        </main>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!email.trim()) { setError('メールアドレスを入力してください。'); return; }
    if (!password)     { setError('パスワードを入力してください。'); return; }

    setSubmitting(true);
    try {
      const { error: authError } = await supabase!.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        // Supabase Auth のエラーメッセージを日本語に変換
        if (authError.message.includes('Invalid login credentials')) {
          setError('メールアドレスまたはパスワードが正しくありません。');
        } else if (authError.message.includes('Email not confirmed')) {
          setError('メールアドレスが確認されていません。Supabase Dashboard で確認してください。');
        } else {
          setError(`ログインに失敗しました: ${authError.message}`);
        }
        return;
      }

      // ログイン成功 → AuthContext の onAuthStateChange が発火して画面遷移する
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ネットワークエラーが発生しました。通信環境を確認してください。');
    } finally {
      setSubmitting(false);
    }
  }

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
        }}
      >
        <h1
          style={{
            fontSize: 'var(--font-size-heading)',
            fontWeight: 700,
            marginBottom: 4,
            color: 'var(--color-text)',
          }}
        >
          工具・備品管理
        </h1>
        <p className="page-lead" style={{ marginBottom: 'var(--space-5)' }}>
          ログインしてください
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {error ? <div className="error-banner">{error}</div> : null}

          <div className="form-group">
            <label className="form-label" htmlFor="email">メールアドレス</label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoCapitalize="off"
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">パスワード</label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="パスワード"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--block"
            disabled={submitting}
            style={{ marginTop: 'var(--space-2)' }}
          >
            {submitting ? 'ログイン中…' : 'ログイン'}
          </button>
        </form>

        <p
          className="form-hint"
          style={{ marginTop: 'var(--space-4)', textAlign: 'center' }}
        >
          アカウントは管理者が Supabase Dashboard で作成します。
        </p>
      </main>
    </div>
  );
}
