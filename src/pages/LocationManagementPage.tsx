import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { EmptyState } from '../components/EmptyState';
import { repository } from '../repository';
import { useAppData } from '../hooks/useAppData';
import { todayDateInput } from '../utils/date';
import type { Location, LocationType } from '../types';
import { LOCATION_TYPE_LABEL } from '../types';

interface LocationFormState {
  locationName: string;
  locationType: LocationType;
  startDate: string;
  endDate: string;
  notes: string;
  isActive: boolean;
}

const EMPTY_FORM: LocationFormState = {
  locationName: '', locationType: 'site',
  startDate: todayDateInput(), endDate: '', notes: '', isActive: true,
};

const LOCATION_TYPE_OPTIONS: LocationType[] = ['storage', 'site', 'repair', 'other'];

export function LocationManagementPage() {
  const { locations, loading, error, reload } = useAppData();

  const [showInactive, setShowInactive] = useState(false);
  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LocationFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const visibleLocations = useMemo(
    () => locations.filter((l) => showInactive || l.isActive),
    [locations, showInactive]
  );

  function openNewForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setMode('form');
  }

  function openEditForm(loc: Location) {
    setEditingId(loc.id);
    setForm({
      locationName: loc.locationName,
      locationType: loc.locationType,
      startDate: loc.startDate ?? '',
      endDate: loc.endDate ?? '',
      notes: loc.notes,
      isActive: loc.isActive,
    });
    setFormError('');
    setMode('form');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');

    if (!form.locationName.trim()) { setFormError('場所名を入力してください。'); return; }
    if (!form.startDate) { setFormError('開始日を入力してください。'); return; }

    const dup = locations.find(
      (l) => l.locationName.trim().toLowerCase() === form.locationName.trim().toLowerCase() && l.id !== editingId
    );
    if (dup) { setFormError('同じ名前の場所が既に登録されています。'); return; }

    setSubmitting(true);
    try {
      if (editingId) {
        await repository.updateLocation(editingId, {
          locationName: form.locationName.trim(),
          locationType: form.locationType,
          startDate: form.startDate,
          endDate: form.endDate || null,
          notes: form.notes,
          isActive: form.isActive,
        });
      } else {
        await repository.createLocation({
          locationName: form.locationName.trim(),
          locationType: form.locationType,
          startDate: form.startDate,
          endDate: form.endDate || null,
          notes: form.notes,
          isActive: true,
        });
      }
      reload();
      setMode('list');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '保存に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(loc: Location) {
    try {
      await repository.updateLocation(loc.id, { isActive: !loc.isActive });
      reload();
    } catch (err) {
      console.error('使用停止の変更に失敗しました', err);
    }
  }

  if (mode === 'form') {
    return (
      <div className="app-shell">
        <Header title={editingId ? '場所を編集' : '場所を新規登録'} />
        <main className="page page--narrow">
          <form className="form" onSubmit={handleSubmit}>
            {formError ? <div className="error-banner">{formError}</div> : null}

            <div className="form-group">
              <label className="form-label" htmlFor="locationName">場所名<span className="form-label__required">必須</span></label>
              <input id="locationName" className="form-input" value={form.locationName} onChange={(e) => setForm({ ...form, locationName: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="locationType">種別</label>
              <select id="locationType" className="form-select" value={form.locationType} onChange={(e) => setForm({ ...form, locationType: e.target.value as LocationType })}>
                {LOCATION_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{LOCATION_TYPE_LABEL[t]}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="startDate">開始日<span className="form-label__required">必須</span></label>
              <input id="startDate" type="date" className="form-input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="endDate">終了日</label>
              <input id="endDate" type="date" className="form-input" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="notes">備考</label>
              <textarea id="notes" className="form-textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            {editingId ? (
              <div className="checkbox-row">
                <input id="isActive" type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                <label htmlFor="isActive">有効</label>
              </div>
            ) : null}

            <div className="bottom-actions__row">
              <button type="button" className="btn btn--secondary btn--block" onClick={() => setMode('list')}>キャンセル</button>
              <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
                {submitting ? '保存中…' : '保存する'}
              </button>
            </div>
          </form>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-shell">
        <Header title="場所・現場管理" />
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
      <Header title="場所・現場管理" />
      <main className="page page--narrow">
        <div className="toolbar">
          <label className="checkbox-row">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            終了済みも表示
          </label>
          <button type="button" className="btn btn--primary" onClick={openNewForm}>+ 新規登録</button>
        </div>

        {loading ? (
          <div className="empty-state">読み込み中…</div>
        ) : visibleLocations.length === 0 ? (
          <EmptyState message="登録されている場所がありません。" />
        ) : (
          <div className="list">
            {visibleLocations.map((loc) => (
              <div key={loc.id} className="list-row" style={{ cursor: 'default' }}>
                <div className="list-row__main" onClick={() => openEditForm(loc)} style={{ cursor: 'pointer' }}>
                  <span className="list-row__number">{LOCATION_TYPE_LABEL[loc.locationType]}</span>
                  <span className="list-row__name">{loc.locationName}{!loc.isActive ? '(終了済み)' : ''}</span>
                  <span className="list-row__meta">{loc.startDate || '-'}{loc.endDate ? ` 〜 ${loc.endDate}` : ''}</span>
                </div>
                <button
                  type="button"
                  className="btn btn--ghost"
                  style={{ minHeight: 'auto', padding: '2px 8px', fontSize: 12 }}
                  onClick={() => { void toggleActive(loc); }}
                >
                  {loc.isActive ? '終了にする' : '使用中に戻す'}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
