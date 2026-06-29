import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { repository } from '../repository';
import { useAppData } from '../hooks/useAppData';
import { getActiveCategories, getActiveLocations, getCategoryName, getLocationName } from '../repository/selectors';
import type { Item } from '../types';

interface ItemFormState {
  managementNumber: string;
  itemName: string;
  categoryId: string;
  manufacturer: string;
  modelNumber: string;
  serialNumber: string;
  currentLocationId: string;
  notes: string;
  isActive: boolean;
}

const EMPTY_FORM: ItemFormState = {
  managementNumber: '', itemName: '', categoryId: '',
  manufacturer: '', modelNumber: '', serialNumber: '',
  currentLocationId: '', notes: '', isActive: true,
};

export function ItemManagementPage() {
  const { items, locations, categories, loading, error, reload } = useAppData();

  const [showInactive, setShowInactive] = useState(false);
  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ItemFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const activeCategories = useMemo(() => getActiveCategories(categories), [categories]);
  const activeLocations = useMemo(() => getActiveLocations(locations), [locations]);

  const visibleItems = useMemo(
    () => items.filter((i) => showInactive || i.isActive),
    [items, showInactive]
  );

  function openNewForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, categoryId: activeCategories[0]?.id ?? '', currentLocationId: activeLocations[0]?.id ?? '' });
    setFormError('');
    setMode('form');
  }

  function openEditForm(item: Item) {
    setEditingId(item.id);
    setForm({
      managementNumber: item.managementNumber,
      itemName: item.itemName,
      categoryId: item.categoryId,
      manufacturer: item.manufacturer,
      modelNumber: item.modelNumber,
      serialNumber: item.serialNumber,
      currentLocationId: item.currentLocationId,
      notes: item.notes,
      isActive: item.isActive,
    });
    setFormError('');
    setMode('form');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');

    if (!form.managementNumber.trim()) { setFormError('管理番号を入力してください。'); return; }
    if (!form.itemName.trim()) { setFormError('物品名を入力してください。'); return; }
    if (!form.categoryId) { setFormError('分類を選択してください。'); return; }
    if (!form.currentLocationId) { setFormError('初期配置場所を選択してください。'); return; }

    setSubmitting(true);
    try {
      const dup = await repository.getItemByManagementNumber(form.managementNumber.trim());
      if (dup && dup.id !== editingId) {
        setFormError('同じ管理番号の物品が既に登録されています。');
        setSubmitting(false);
        return;
      }

      if (editingId) {
        await repository.updateItem(editingId, {
          managementNumber: form.managementNumber.trim(),
          itemName: form.itemName.trim(),
          categoryId: form.categoryId,
          manufacturer: form.manufacturer.trim(),
          modelNumber: form.modelNumber.trim(),
          serialNumber: form.serialNumber.trim(),
          currentLocationId: form.currentLocationId,
          notes: form.notes,
          isActive: form.isActive,
        });
      } else {
        await repository.createItem({
          managementNumber: form.managementNumber.trim(),
          itemName: form.itemName.trim(),
          categoryId: form.categoryId,
          manufacturer: form.manufacturer.trim(),
          modelNumber: form.modelNumber.trim(),
          serialNumber: form.serialNumber.trim(),
          currentLocationId: form.currentLocationId,
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

  async function toggleActive(item: Item) {
    try {
      await repository.updateItem(item.id, { isActive: !item.isActive });
      reload();
    } catch (err) {
      console.error('使用停止の変更に失敗しました', err);
    }
  }

  if (mode === 'form') {
    return (
      <div className="app-shell">
        <Header title={editingId ? '物品を編集' : '物品を新規登録'} />
        <main className="page page--narrow">
          <form className="form" onSubmit={handleSubmit}>
            {formError ? <div className="error-banner">{formError}</div> : null}

            <div className="form-group">
              <label className="form-label" htmlFor="managementNumber">管理番号<span className="form-label__required">必須</span></label>
              <input id="managementNumber" className="form-input" value={form.managementNumber} onChange={(e) => setForm({ ...form, managementNumber: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="itemName">物品名<span className="form-label__required">必須</span></label>
              <input id="itemName" className="form-input" value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="categoryId">分類<span className="form-label__required">必須</span></label>
              <select id="categoryId" className="form-select" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">選択してください</option>
                {activeCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="manufacturer">メーカー</label>
              <input id="manufacturer" className="form-input" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="modelNumber">型式</label>
              <input id="modelNumber" className="form-input" value={form.modelNumber} onChange={(e) => setForm({ ...form, modelNumber: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="serialNumber">シリアル番号</label>
              <input id="serialNumber" className="form-input" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="currentLocationId">
                {editingId ? '現在地' : '初期配置場所'}<span className="form-label__required">必須</span>
              </label>
              <select id="currentLocationId" className="form-select" value={form.currentLocationId} onChange={(e) => setForm({ ...form, currentLocationId: e.target.value })}>
                <option value="">選択してください</option>
                {activeLocations.map((l) => <option key={l.id} value={l.id}>{l.locationName}</option>)}
              </select>
              {editingId ? <p className="form-hint">この場所変更は移動履歴に記録されません。通常の出庫・入庫・移動は各操作画面から行ってください。</p> : null}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="notes">備考</label>
              <textarea id="notes" className="form-textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            {editingId ? (
              <div className="checkbox-row">
                <input id="isActive" type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                <label htmlFor="isActive">使用中</label>
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
        <Header title="物品管理" />
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
      <Header title="物品管理" />
      <main className="page page--narrow">
        <div className="toolbar">
          <label className="checkbox-row">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            使用停止中も表示
          </label>
          <button type="button" className="btn btn--primary" onClick={openNewForm}>+ 新規登録</button>
        </div>

        {loading ? (
          <div className="empty-state">読み込み中…</div>
        ) : visibleItems.length === 0 ? (
          <EmptyState message="登録されている物品がありません。" />
        ) : (
          <div className="list">
            {visibleItems.map((item) => (
              <div key={item.id} className="list-row" style={{ cursor: 'default' }}>
                <div className="list-row__main" onClick={() => openEditForm(item)} style={{ cursor: 'pointer' }}>
                  <span className="list-row__number">{item.managementNumber} ・ {getCategoryName(categories, item.categoryId)}</span>
                  <span className="list-row__name">{item.itemName}{!item.isActive ? '(使用停止)' : ''}</span>
                  <span className="list-row__meta">{getLocationName(locations, item.currentLocationId)}</span>
                </div>
                <div className="list-row__side">
                  <StatusBadge status={item.currentStatus} />
                  <button type="button" className="btn btn--ghost" style={{ minHeight: 'auto', padding: '2px 8px', fontSize: 12 }} onClick={() => { void toggleActive(item); }}>
                    {item.isActive ? '使用停止にする' : '使用中に戻す'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
