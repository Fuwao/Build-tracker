import { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { useAppData } from '../hooks/useAppData';
import { getActiveCategories, getActiveLocations, getItemsWithRelations } from '../repository/selectors';
import { formatDate, formatDateTime } from '../utils/date';
import { downloadCsv } from '../utils/csv';
import type { ItemStatus } from '../types';
import { STATUS_LABEL } from '../types';

export function LocationsOverviewPage() {
  const navigate = useNavigate();
  const { items, locations, categories, loading, error, reload } = useAppData();

  const [keyword, setKeyword] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [status, setStatus] = useState<ItemStatus | ''>('');
  const [dateInput, setDateInput] = useState('');
  const [monthInput, setMonthInput] = useState('');

  const activeCategories = useMemo(() => getActiveCategories(categories), [categories]);
  const activeLocations = useMemo(() => getActiveLocations(locations), [locations]);

  const allItems = useMemo(
    () => getItemsWithRelations(items, locations, categories),
    [items, locations, categories]
  );

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return allItems.filter((item) => {
      if (kw && !(item.managementNumber.toLowerCase().includes(kw) || item.itemName.toLowerCase().includes(kw) || item.categoryName.toLowerCase().includes(kw))) return false;
      if (categoryId && item.categoryId !== categoryId) return false;
      if (locationId && item.currentLocationId !== locationId) return false;
      if (status && item.currentStatus !== status) return false;
      if (dateInput) {
        if (!item.lastMovedAt) return false;
        const d = new Date(item.lastMovedAt);
        const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (ds !== dateInput) return false;
      }
      if (monthInput) {
        if (!item.lastMovedAt) return false;
        const d = new Date(item.lastMovedAt);
        const ms = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (ms !== monthInput) return false;
      }
      return true;
    });
  }, [allItems, keyword, categoryId, locationId, status, dateInput, monthInput]);

  function handleExport() {
    if (filtered.length === 0) {
      window.alert('出力できるデータがありません。絞り込み条件を見直してください。');
      return;
    }
    downloadCsv(
      `現在地一覧_${new Date().toISOString().slice(0, 10)}.csv`,
      ['管理番号', '物品名', '分類', '現在地', '状態', '最終移動日', '最終担当者', '備考'],
      filtered.map((i) => [
        i.managementNumber, i.itemName, i.categoryName, i.locationName,
        STATUS_LABEL[i.currentStatus], formatDateTime(i.lastMovedAt),
        (i.lastRegisteredByName ?? i.lastPersonName) || '', i.notes,
      ])
    );
  }

  if (error) {
    return (
      <div className="app-shell">
        <Header title="現在地を確認" />
        <main className="page">
          <div className="error-banner">{error}</div>
          <button type="button" className="btn btn--primary btn--block" onClick={reload}>再試行</button>
          <Link to="/" className="btn btn--secondary btn--block">ホームへ戻る</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Header title="現在地を確認" />
      <main className="page">
        <div className="search-bar">
          <input
            type="text"
            className="search-input"
            placeholder="管理番号・物品名・分類で検索"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>

        <div className="filter-panel">
          <div className="filter-row">
            <select className="form-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">分類:すべて</option>
              {activeCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="form-select" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">現在地:すべて</option>
              {activeLocations.map((l) => <option key={l.id} value={l.id}>{l.locationName}</option>)}
            </select>
          </div>
          <div className="filter-row">
            <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value as ItemStatus | '')}>
              <option value="">状態:すべて</option>
              {Object.entries(STATUS_LABEL).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <input type="month" className="form-input" value={monthInput} onChange={(e) => { setMonthInput(e.target.value); setDateInput(''); }} />
          </div>
          <input type="date" className="form-input" value={dateInput} onChange={(e) => { setDateInput(e.target.value); setMonthInput(''); }} />
        </div>

        <div className="toolbar">
          <span className="result-count">{loading ? '読み込み中…' : `${filtered.length}件`}</span>
          <button type="button" className="btn btn--secondary" onClick={handleExport} disabled={loading}>CSV出力</button>
        </div>

        {loading ? (
          <div className="empty-state">読み込み中…</div>
        ) : filtered.length === 0 ? (
          <EmptyState message="該当する物品がありません。" />
        ) : (
          <>
            <div className="list list--desktop-hidden">
              {filtered.map((item) => (
                <button type="button" key={item.id} className="list-row" onClick={() => navigate(`/items/${item.id}`)}>
                  <div className="list-row__main">
                    <span className="list-row__number">{item.managementNumber}</span>
                    <span className="list-row__name">{item.itemName}</span>
                    <span className="list-row__meta">{item.locationName} ・ 最終更新 {formatDate(item.lastMovedAt)}</span>
                  </div>
                  <div className="list-row__side">
                    <StatusBadge status={item.currentStatus} />
                  </div>
                </button>
              ))}
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>管理番号</th><th>物品名</th><th>分類</th><th>現在地</th>
                    <th>状態</th><th>最終移動日</th><th>最終担当者</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id} onClick={() => navigate(`/items/${item.id}`)} style={{ cursor: 'pointer' }}>
                      <td>{item.managementNumber}</td><td>{item.itemName}</td>
                      <td>{item.categoryName}</td><td>{item.locationName}</td>
                      <td><StatusBadge status={item.currentStatus} /></td>
                      <td>{formatDate(item.lastMovedAt)}</td>
                      <td>{(item.lastRegisteredByName ?? item.lastPersonName) || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
