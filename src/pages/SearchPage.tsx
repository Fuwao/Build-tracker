import { useMemo, useState } from 'react';
import { Header } from '../components/Header';
import { ItemCard } from '../components/ItemCard';
import { EmptyState } from '../components/EmptyState';
import { useAppData } from '../hooks/useAppData';
import { searchItems } from '../repository/selectors';
import { Link } from 'react-router-dom';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const { items, locations, categories, loading, error, reload } = useAppData();
  const results = useMemo(
    () => searchItems(items, locations, categories, query),
    [items, locations, categories, query]
  );

  if (error) {
    return (
      <div className="app-shell">
        <Header title="手入力で登録" />
        <main className="page page--narrow">
          <div className="error-banner">{error}</div>
          <button type="button" className="btn btn--primary btn--block" onClick={reload}>再試行</button>
          <Link to="/" className="btn btn--secondary btn--block">ホームへ戻る</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Header title="手入力で登録" />
      <main className="page page--narrow">
        <p className="page-lead">管理番号・物品名・分類で検索して、対象の物品を選択してください。</p>
        <div className="search-bar">
          <input
            type="text"
            className="search-input"
            placeholder="管理番号・物品名・分類で検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {loading ? (
          <div className="empty-state">読み込み中…</div>
        ) : (
          <>
            <p className="result-count">{results.length}件</p>
            {results.length === 0 ? (
              <EmptyState message="該当する物品が見つかりません。" />
            ) : (
              <div className="list">
                {results.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
