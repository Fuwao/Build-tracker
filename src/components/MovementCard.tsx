import type { MovementWithRelations } from '../types';
import { MovementBadge } from './MovementBadge';
import { formatDateTime } from '../utils/date';

/** 登録者名の表示用フォールバックチェーン: registeredByName → personName → '不明' */
function resolvePersonName(m: MovementWithRelations): string {
  return m.registeredByName ?? m.personName ?? '不明';
}

export function MovementCard({ movement }: { movement: MovementWithRelations }) {
  return (
    <div className="list-row" style={{ cursor: 'default' }}>
      <div className="list-row__main">
        <span className="list-row__number">{formatDateTime(movement.movedAt)} ・ {movement.managementNumber}</span>
        <span className="list-row__name">{movement.itemName}</span>
        <span className="list-row__meta">{movement.fromLocationName} → {movement.toLocationName}</span>
        <span className="list-row__meta">
          担当: {resolvePersonName(movement)}{movement.notes ? ` ・ ${movement.notes}` : ''}
        </span>
      </div>
      <div className="list-row__side">
        <MovementBadge type={movement.movementType} />
      </div>
    </div>
  );
}
