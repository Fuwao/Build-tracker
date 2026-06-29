import { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { MovementCard } from '../components/MovementCard';
import { EmptyState } from '../components/EmptyState';
import { useAppData } from '../hooks/useAppData';
import { getMovementsWithRelations } from '../repository/selectors';
import { downloadCsv } from '../utils/csv';
import { formatDateTime, dateOnlyOf, yearMonthOf } from '../utils/date';
import { MOVEMENT_TYPE_LABEL } from '../types';
import type { MovementType, MovementWithRelations } from '../types';

type ViewMode = 'list' | 'byDate' | 'byMonth' | 'bySite';

function groupBy(movements: MovementWithRelations[], keyFn: (m: MovementWithRelations) => string): [string, MovementWithRelations[]][] {
  const map = new Map<string, MovementWithRelations[]>();
  for (const m of movements) {
    const key = keyFn(m);
    const list = map.get(key) ?? [];
    list.push(m);
    map.set(key, list);
  }
  return Array.from(map.entries());
}

export function HistoryPage() {
  const navigate = useNavigate();
  const { items, locations, movements, loading, error, reload } = useAppData();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [keyword, setKeyword] = useState('');
  const [movementType, setMovementType] = useState<MovementType | ''>('');

  const all = useMemo(
    () => getMovementsWithRelations(movements, items, locations),
    [movements, items, locations]
  );

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return all.filter((m) => {
      if (kw && !(m.managementNumber.toLowerCase().includes(kw) || m.itemName.toLowerCase().includes(kw))) return false;
      if (movementType && m.movementType !== movementType) return false;
      return true;
    });
  }, [all, keyword, movementType]);

  function handleExport() {
    if (filtered.length === 0) {
      window.alert('出力できるデータがありません。絞り込み条件を見直してください。');
      return;
    }
    downloadCsv(
      `履歴_${new Date().toISOString().slice(0, 10)}.csv`,
      ['日時', '管理番号', '物品名', '操作種別', '移動元', '移動先', '担当者', '備考'],
      filtered.map((m) => [
        formatDateTime(m.movedAt), m.managementNumber, m.itemName,
        MOVEMENT_TYPE_LABEL[m.movementType], m.fromLocationName, m.toLocationName,
        (m.registeredByName ?? m.personName) || '', m.notes,
      ])
    );
  }

  const groups = useMemo(() => {
    if (viewMode === 'byDate') return groupBy(filtered, (m) => dateOnlyOf(m.movedAt));
    if (viewMode === 'byMonth') return groupBy(filtered, (m) => yearMonthOf(m.movedAt));
    if (viewMode === 'bySite') return groupBy(filtered, (m) => m.siteLocationName);
    return [];
  }, [viewMode, filtered]);

  if (error) {
    return (
      <div className="app-shell">
        <Header title="履歴を確認" />
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
      <Header title="履歴を確認" />
      <main className="page">
        <div className="tabs">
          {(['list', 'byDate', 'byMonth', 'bySite'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`tab ${viewMode === mode ? 'tab--active' : ''}`}
              onClick={() => setViewMode(mode)}
            >
              {mode === 'list' ? '一覧' : mode === 'byDate' ? '日別' : mode === 'byMonth' ? '月別' : '現場別'}
            </button>
          ))}
        </div>

        <div className="search-bar">
          <input
            type="text"
            className="search-input"
            placeholder="管理番号・物品名で検索"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>

        <div className="filter-panel">
          <select className="form-select" value={movementType} onChange={(e) => setMovementType(e.target.value as MovementType | '')}>
            <option value="">操作種別:すべて</option>
            <option value="outbound">出庫</option>
            <option value="inbound">入庫</option>
            <option value="transfer">移動</option>
          </select>
        </div>

        <div className="toolbar">
          <span className="result-count">{loading ? '読み込み中…' : `${filtered.length}件`}</span>
          <button type="button" className="btn btn--secondary" onClick={handleExport} disabled={loading}>CSV出力</button>
        </div>

        {loading ? (
          <div className="empty-state">読み込み中…</div>
        ) : filtered.length === 0 ? (
          <EmptyState message="該当する履歴がありません。" />
        ) : viewMode === 'list' ? (
          <div className="list">
            {filtered.map((m, idx) => {
              const dateKey = dateOnlyOf(m.movedAt);
              const showDivider = idx === 0 || dateKey !== dateOnlyOf(filtered[idx - 1].movedAt);
              return (
                <div key={m.id}>
                  {showDivider ? <div className="date-divider">{dateKey}</div> : null}
                  <MovementCard movement={m} />
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'var(--space-2)' }}>
            {groups.map(([groupKey, list]) => (
              <details key={groupKey} className="history-group" open={groups.length <= 3}>
                <summary className="history-group-summary">
                  <span className="history-group-summary__label">{groupKey} ({list.length}件)</span>
                  {viewMode === 'bySite' ? (
                    <button
                      type="button"
                      className="btn btn--ghost"
                      style={{ minHeight: 'auto', padding: '2px 8px', fontSize: 12 }}
                      onClick={(e) => { e.preventDefault(); navigate(`/sites/${list[0].siteLocationId}`); }}
                    >
                      現場別確認へ
                    </button>
                  ) : null}
                </summary>
                <div className="list">
                  {list.map((m) => <MovementCard key={m.id} movement={m} />)}
                </div>
              </details>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
