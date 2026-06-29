import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Category, Item, Location, MovementType } from '../types';
import { MOVEMENT_TYPE_LABEL } from '../types';
import { repository } from '../repository';
import { getCategoryName, getLocationName } from '../repository/selectors';
import { useAuth } from '../contexts/AuthContext';
import { StatusBadge } from './StatusBadge';
import { BottomActions } from './BottomActions';
import { dateInputToIso, todayDateInput } from '../utils/date';

interface MovementFormProps {
  item: Item;
  locations: Location[];
  categories: Category[];
  movementType: MovementType;
  destinationLabel: string;
  destinationLocations: Location[];
  submitLabel: string;
  emptyDestinationMessage: string;
}

export function MovementForm({
  item,
  locations,
  categories,
  movementType,
  destinationLabel,
  destinationLocations,
  submitLabel,
  emptyDestinationMessage,
}: MovementFormProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [toLocationId, setToLocationId] = useState('');
  const [movedAtInput, setMovedAtInput] = useState(todayDateInput());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fromLocationName = getLocationName(locations, item.currentLocationId);

  // 登録者表示名: display_name → email → '名前未設定' の順でフォールバック
  const registeredByName = profile
    ? (profile.display_name || profile.email || '名前未設定')
    : '(ログイン情報なし)';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    // profile が取れていない場合は登録させない
    if (!profile) {
      setError('ログイン情報を取得できません。再ログインしてください。');
      return;
    }

    if (!toLocationId) {
      setError(`${destinationLabel}を選択してください。`);
      return;
    }
    if (!movedAtInput) {
      setError('日付を入力してください。');
      return;
    }

    setSubmitting(true);
    try {
      const { item: updatedItem, movement } = await repository.registerMovement(movementType, {
        itemId: item.id,
        toLocationId,
        movedAt: dateInputToIso(movedAtInput),
        registeredByUserId: profile.id,
        registeredByName: registeredByName,
        notes,
      });
      navigate('/complete', {
        state: {
          movementType,
          itemId: item.id,
          itemName: updatedItem.itemName,
          managementNumber: updatedItem.managementNumber,
          fromLocationName: getLocationName(locations, movement.fromLocationId),
          toLocationName: getLocationName(locations, movement.toLocationId),
          movedAt: movement.movedAt,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '登録に失敗しました。');
      setSubmitting(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      {/* 対象物品・現在地の表示(読み取り専用) */}
      <div className="info-block">
        <div className="info-row">
          <span className="info-row__label">対象物品</span>
          <span className="info-row__value">{item.managementNumber} {item.itemName}</span>
        </div>
        <div className="info-row info-row--emphasis">
          <span className="info-row__label">現在地</span>
          <span className="info-row__value">{fromLocationName}</span>
        </div>
        <div className="info-row">
          <span className="info-row__label">分類</span>
          <span className="info-row__value">{getCategoryName(categories, item.categoryId)}</span>
        </div>
        <div className="info-row">
          <span className="info-row__label">現在の状態</span>
          <span className="info-row__value"><StatusBadge status={item.currentStatus} /></span>
        </div>
        {/* 登録者(自動): 手入力欄を廃止し、ログインユーザーを自動表示 */}
        <div className="info-row">
          <span className="info-row__label">登録者</span>
          <span className="info-row__value" style={{ color: 'var(--color-accent)', fontWeight: 700 }}>
            {registeredByName}
          </span>
        </div>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      {destinationLocations.length === 0 ? (
        <div className="error-banner">{emptyDestinationMessage}</div>
      ) : (
        <div className="form-group">
          <label className="form-label" htmlFor="toLocationId">
            {destinationLabel}<span className="form-label__required">必須</span>
          </label>
          <select
            id="toLocationId"
            className="form-select"
            value={toLocationId}
            onChange={(e) => setToLocationId(e.target.value)}
          >
            <option value="">選択してください</option>
            {destinationLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.locationName}</option>
            ))}
          </select>
        </div>
      )}

      <div className="form-group">
        <label className="form-label" htmlFor="movedAt">
          {MOVEMENT_TYPE_LABEL[movementType]}日<span className="form-label__required">必須</span>
        </label>
        <input
          id="movedAt"
          type="date"
          className="form-input"
          value={movedAtInput}
          onChange={(e) => setMovedAtInput(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="notes">備考</label>
        <textarea
          id="notes"
          className="form-textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <BottomActions>
        <button
          type="submit"
          className="btn btn--primary btn--block"
          disabled={submitting || destinationLocations.length === 0 || !profile}
        >
          {submitting ? '登録中…' : submitLabel}
        </button>
      </BottomActions>
    </form>
  );
}
