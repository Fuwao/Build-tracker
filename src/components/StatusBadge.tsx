import type { ItemStatus } from '../types';
import { STATUS_LABEL } from '../types';

export function StatusBadge({ status }: { status: ItemStatus }) {
  return <span className={`status-badge status-badge--${status}`}>{STATUS_LABEL[status]}</span>;
}
