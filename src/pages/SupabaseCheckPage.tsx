// =============================================================================
// src/pages/SupabaseCheckPage.tsx
// Supabase 接続確認ページ (開発・動作確認専用)
//
// このページは Supabase 接続確認が完了したら削除できます。
// 削除手順: このファイルを削除 + App.tsx から "/supabase-check" ルートを削除
// =============================================================================
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { supabase, supabaseConfigured, hasSupabaseUrl, hasSupabaseKey } from '../lib/supabase';

type CheckStatus = 'pending' | 'ok' | 'empty' | 'rls' | 'error';

interface TableResult {
  label: string;
  table: string;
  status: CheckStatus;
  count: number;
  message: string;
}

const STATUS_ICON: Record<CheckStatus, string> = {
  pending: '⏳',
  ok:      '✅',
  empty:   '⚠️',
  rls:     '🔒',
  error:   '❌',
};

const STATUS_LABEL: Record<CheckStatus, string> = {
  pending: '確認中…',
  ok:      '取得成功',
  empty:   '0件(データなし)',
  rls:     '0件(RLSにより未ログインは取得不可)',
  error:   'エラー',
};

const TABLES: { label: string; table: string }[] = [
  { label: 'item_categories (分類)', table: 'item_categories' },
  { label: 'locations (場所)',        table: 'locations'       },
  { label: 'items (物品)',            table: 'items'           },
];

export function SupabaseCheckPage() {
  const [results, setResults] = useState<TableResult[]>(
    TABLES.map((t) => ({ ...t, status: 'pending', count: 0, message: '' }))
  );
  const [ran, setRan] = useState(false);

  async function runChecks() {
    if (!supabase) return;
    setRan(true);

    for (const t of TABLES) {
      try {
        const { data, error } = await supabase.from(t.table).select('id');

        let status: CheckStatus;
        let count = 0;
        let message = '';

        if (error) {
          // Supabase がエラーを返した場合(RLS違反など)
          status  = error.code === 'PGRST301' || error.message.includes('permission') ? 'rls' : 'error';
          message = `${error.code ?? ''} ${error.message}`;
        } else if (!data || data.length === 0) {
          // 成功したが 0 件 — RLS で全行がフィルタされた可能性が高い
          status  = 'rls';
          message = '未ログイン状態のためRLSにより全行が除外されました。ログイン後に再確認してください。';
        } else {
          status = 'ok';
          count  = data.length;
        }

        setResults((prev) =>
          prev.map((r) =>
            r.table === t.table ? { ...r, status, count, message } : r
          )
        );
      } catch (e) {
        setResults((prev) =>
          prev.map((r) =>
            r.table === t.table
              ? { ...r, status: 'error', message: e instanceof Error ? e.message : '不明なエラー' }
              : r
          )
        );
      }
    }
  }

  useEffect(() => {
    if (supabaseConfigured) {
      void runChecks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;

  return (
    <div className="app-shell">
      <Header title="Supabase接続確認" />
      <main className="page page--narrow">
        <p className="page-lead" style={{ color: 'var(--color-warning)', fontWeight: 700 }}>
          ⚙️ 開発用ページ。接続確認後は削除できます。
        </p>

        {/* 環境変数の設定状況 */}
        <p className="section-title">環境変数</p>
        <div className="info-block">
          <div className="info-row">
            <span className="info-row__label">VITE_SUPABASE_URL</span>
            <span className="info-row__value">
              {hasSupabaseUrl
                ? `✅ 設定済み (${supabaseUrl?.slice(0, 30)}…)`
                : '❌ 未設定'}
            </span>
          </div>
          <div className="info-row">
            <span className="info-row__label">VITE_SUPABASE_ANON_KEY</span>
            <span className="info-row__value">
              {hasSupabaseKey ? '✅ 設定済み' : '❌ 未設定'}
            </span>
          </div>
        </div>

        {!supabaseConfigured ? (
          <>
            <div className="error-banner" style={{ marginTop: 'var(--space-4)' }}>
              環境変数が設定されていません。プロジェクトルートに <code>.env.local</code> を作成してください。
              設定手順はREADMEを参照してください。
            </div>
            <div className="panel" style={{ marginTop: 'var(--space-4)' }}>
              <p className="section-title">.env.local の書き方</p>
              <pre style={{ fontSize: 13, overflowX: 'auto', margin: 0, lineHeight: 1.6 }}>
{`VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`}
              </pre>
              <p className="form-hint" style={{ marginTop: 'var(--space-2)' }}>
                Supabase ダッシュボード → Project Settings → API から取得できます。
                設定後は開発サーバーを再起動(<code>npm run dev</code>)してください。
              </p>
            </div>
          </>
        ) : (
          <>
            {/* テーブル別の取得確認 */}
            <p className="section-title">テーブル接続確認</p>
            <p className="page-lead">
              RLSが有効なため、未ログイン状態では0件(🔒)になります。これは正常な動作です。
            </p>

            <div className="info-block">
              {results.map((r) => (
                <div key={r.table} className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span className="info-row__label">{r.label}</span>
                    <span className="info-row__value">
                      {STATUS_ICON[r.status]} {r.status === 'ok' ? `${r.count}件` : STATUS_LABEL[r.status]}
                    </span>
                  </div>
                  {r.message ? (
                    <span style={{ fontSize: 12, color: 'var(--color-text-sub)', paddingLeft: 4, wordBreak: 'break-all' }}>
                      {r.message}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>

            {ran ? (
              <button
                type="button"
                className="btn btn--secondary btn--block"
                style={{ marginTop: 'var(--space-4)' }}
                onClick={() => {
                  setResults(TABLES.map((t) => ({ ...t, status: 'pending', count: 0, message: '' })));
                  void runChecks();
                }}
              >
                再確認する
              </button>
            ) : null}

            <div className="panel" style={{ marginTop: 'var(--space-4)' }}>
              <p className="section-title">🔒 RLS について</p>
              <p className="form-hint">
                現在 RLS (Row Level Security) が有効になっています。
                未ログイン状態では全テーブルのデータが取得できません(0件)。
                これは意図した動作です。ログイン機能を実装した後に再度確認してください。
              </p>
            </div>
          </>
        )}

        <div style={{ marginTop: 'var(--space-5)', display: 'flex', gap: 'var(--space-2)' }}>
          <Link to="/" className="btn btn--secondary">ホームへ戻る</Link>
        </div>
      </main>
    </div>
  );
}
