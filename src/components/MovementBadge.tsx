import type { MovementType } from '../types';
import { MOVEMENT_TYPE_LABEL } from '../types';

export function MovementBadge({ type }: { type: MovementType }) {
  return <span className={`movement-badge movement-badge--${type}`}>{MOVEMENT_TYPE_LABEL[type]}</span>;
}
