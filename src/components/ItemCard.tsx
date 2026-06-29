import { useNavigate } from 'react-router-dom';
import type { ItemWithRelations } from '../types';
import { StatusBadge } from './StatusBadge';

export function ItemCard({ item }: { item: ItemWithRelations }) {
  const navigate = useNavigate();
  return (
    <button type="button" className="list-row" onClick={() => navigate(`/items/${item.id}`)}>
      <div className="list-row__main">
        <span className="list-row__number">{item.managementNumber}</span>
        <span className="list-row__name">{item.itemName}</span>
        <span className="list-row__meta">{item.locationName}</span>
      </div>
      <div className="list-row__side">
        <StatusBadge status={item.currentStatus} />
        <span className="list-row__chevron" aria-hidden>›</span>
      </div>
    </button>
  );
}
