import { useState } from 'react';
import { Header } from '../components/Header';
import { repository } from '../repository';

export function SettingsPage() {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleReset() {
    setSubmitting(true);
    try {
      await repository.resetToSeedData();
      setConfirming(false);
      setDone(true);
    } catch (err) {
      console.error('テストデータの初期化に失敗しました', err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell">
      <Header title="設定" showNav />
      <main className="page page--narrow">
        <div className="panel">
          <p className="section-title">テストデータ</p>
          <p className="form-hint">
            物品・場所・分類・履歴のデータを、初期のテストデータへ戻します。現在登録されているデータはすべて消去されます。
          </p>

          {done ? <div className="error-banner" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)', borderColor: 'var(--color-accent)' }}>テストデータを初期化しました。</div> : null}

          {!confirming ? (
            <button type="button" className="btn btn--danger btn--block" onClick={() => { setConfirming(true); setDone(false); }}>
              テストデータを初期化
            </button>
          ) : (
            <>
              <div className="error-banner">本当に初期化しますか？現在のデータはすべて消去され、元に戻せません。</div>
              <div className="bottom-actions__row">
                <button type="button" className="btn btn--secondary btn--block" onClick={() => setConfirming(false)}>キャンセル</button>
                <button type="button" className="btn btn--danger btn--block" disabled={submitting} onClick={() => { void handleReset(); }}>
                  {submitting ? '初期化中…' : '初期化する'}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="panel">
          <p className="section-title">このアプリについて</p>
          <p className="form-hint">
            工具・備品の入出庫・所在管理アプリです。データはこの端末のブラウザ(localStorage)にのみ保存されます。
            他の端末とはデータは共有されません。
          </p>
        </div>
      </main>
    </div>
  );
}
