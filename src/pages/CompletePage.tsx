import { useLocation, Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { MOVEMENT_TYPE_LABEL } from '../types';
import type { MovementType } from '../types';
import { formatDateTime } from '../utils/date';

interface CompleteState {
  movementType: MovementType;
  itemId?: string;          // 物品詳細へ戻るリンク用(新規追加)
  itemName: string;
  managementNumber: string;
  fromLocationName: string;
  toLocationName: string;
  movedAt: string;
}

export function CompletePage() {
  const location = useLocation();
  const { profile } = useAuth();
  const state = location.state as CompleteState | null;
  const isEmployee = profile?.role === 'employee';

  if (!state) {
    return (
      <div className="app-shell">
        <Header title="登録完了" showBack={false} />
        <main className="page page--narrow">
          <div className="error-banner">完了情報が見つかりません。最初からやり直してください。</div>
          <Link to="/" className="btn btn--primary btn--block">ホームへ戻る</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Header title="登録完了" showBack={false} />
      <main className="page page--narrow page--with-bottom-bar">
        <div className="complete-wrap">
          <div className="complete-icon">✓</div>
          <p className="complete-title">{MOVEMENT_TYPE_LABEL[state.movementType]}を登録しました</p>
          <p style={{ color: 'var(--color-text-sub)', fontSize: 'var(--font-size-caption)', marginTop: 4 }}>
            現在地が更新されました
          </p>
        </div>

        <div className="info-block">
          <div className="info-row">
            <span className="info-row__label">物品名</span>
            <span className="info-row__value">{state.managementNumber} {state.itemName}</span>
          </div>
          <div className="info-row">
            <span className="info-row__label">移動元</span>
            <span className="info-row__value">{state.fromLocationName}</span>
          </div>
          <div className="info-row info-row--emphasis">
            <span className="info-row__label">移動先</span>
            <span className="info-row__value">{state.toLocationName}</span>
          </div>
          <div className="info-row">
            <span className="info-row__label">日時</span>
            <span className="info-row__value">{formatDateTime(state.movedAt)}</span>
          </div>
        </div>
      </main>

      <div className="bottom-actions">
        {/* 物品詳細へ戻るリンク (itemId が渡されている場合) */}
        {state.itemId ? (
          <Link to={`/items/${state.itemId}`} className="btn btn--primary btn--block">
            この物品を続けて操作する
          </Link>
        ) : (
          <Link to="/search" className="btn btn--primary btn--block">
            続けて登録する
          </Link>
        )}

        <div className="bottom-actions__row">
          {/* employee: ホームへ戻る / admin: 現在地確認+ホーム */}
          {isEmployee ? (
            <Link to="/" className="btn btn--secondary btn--block">ホームへ戻る</Link>
          ) : (
            <>
              <Link to="/current-locations" className="btn btn--secondary btn--block">現在地を確認</Link>
              <Link to="/" className="btn btn--secondary btn--block">ホームへ戻る</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
