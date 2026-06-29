import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="app-shell">
      <header className="header">
        <h1 className="header__title">ページが見つかりません</h1>
      </header>
      <main className="page page--narrow">
        <div className="error-page">
          <p>お探しのページは見つかりませんでした。URLが間違っているか、削除された可能性があります。</p>
          <Link to="/" className="btn btn--primary btn--block">ホームへ戻る</Link>
        </div>
      </main>
    </div>
  );
}
