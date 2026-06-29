// =============================================================================
// QRコード発行ページ (admin 専用)
//
// QRコードには物品詳細の URL を埋め込む:
//   ${window.location.origin}/items/${item.id}
//
// スマホで読み取ると /items/:id に直接ジャンプする。
// =============================================================================
import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Header } from '../components/Header';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { useAppData } from '../hooks/useAppData';
import { searchItems } from '../repository/selectors';
import type { ItemWithRelations } from '../types';

export function QrIssuePage() {
  const { items, locations, categories, loading } = useAppData();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ItemWithRelations | null>(null);
  const [dataUrl, setDataUrl] = useState('');
  const [qrError, setQrError] = useState('');

  const results = useMemo(
    () => (query.trim() ? searchItems(items, locations, categories, query) : []),
    [items, locations, categories, query]
  );

  // QR に埋め込む URL: アプリの origin + /items/:itemId
  const qrUrl = selected ? `${window.location.origin}/items/${selected.id}` : '';

  useEffect(() => {
    if (!selected) { setDataUrl(''); setQrError(''); return; }
    let cancelled = false;
    setQrError('');
    QRCode.toDataURL(qrUrl, { width: 280, margin: 2, errorCorrectionLevel: 'M' })
      .then((url) => { if (!cancelled) setDataUrl(url); })
      .catch((e) => {
        console.error('QRコードの生成に失敗しました', e);
        if (!cancelled) setQrError('QRコードの生成に失敗しました。');
      });
    return () => { cancelled = true; };
  }, [selected, qrUrl]);

  function handlePrint() { window.print(); }

  return (
    <div className="app-shell">
      <Header title="QRコード発行" showNav />
      <main className="page page--narrow">
        {/* 画面説明 */}
        <p className="page-lead no-print">
          物品を検索してQRコードを発行します。発行されたQRコードを印刷して物品に貼付してください。
        </p>

        {/* 検索バー */}
        <div className="search-bar no-print">
          <input
            type="text"
            className="search-input"
            placeholder="管理番号・物品名・分類で検索"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
            autoFocus
          />
        </div>

        {/* 検索結果リスト */}
        {loading ? (
          <div className="empty-state no-print">読み込み中…</div>
        ) : !selected && query.trim() ? (
          results.length === 0 ? (
            <EmptyState message="該当する物品が見つかりません。" />
          ) : (
            <div className="list no-print">
              {results.map((item) => (
                <button key={item.id} type="button" className="list-row" onClick={() => setSelected(item)}>
                  <div className="list-row__main">
                    <span className="list-row__number">{item.managementNumber}</span>
                    <span className="list-row__name">{item.itemName}</span>
                    <span className="list-row__meta">{item.locationName}</span>
                  </div>
                  <div className="list-row__side">
                    <StatusBadge status={item.currentStatus} />
                  </div>
                </button>
              ))}
            </div>
          )
        ) : null}

        {/* QRコード表示 */}
        {selected ? (
          <div className="qr-issue-box">
            {/* 印刷時のラベル */}
            <div className="qr-label">
              <div className="qr-label__name">{selected.itemName}</div>
              <div className="qr-label__number">{selected.managementNumber}</div>
              {qrError ? (
                <div className="error-banner">{qrError}</div>
              ) : dataUrl ? (
                <img
                  className="qr-label__image"
                  src={dataUrl}
                  alt={`${selected.managementNumber} のQRコード`}
                  width={280}
                  height={280}
                />
              ) : (
                <div className="empty-state" style={{ minHeight: 280 }}>QRコード生成中…</div>
              )}
            </div>

            {/* 画面専用: 物品詳細情報・URLの表示・操作ボタン */}
            <div className="no-print" style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div className="info-block">
                <div className="info-row">
                  <span className="info-row__label">現在地</span>
                  <span className="info-row__value">{selected.locationName}</span>
                </div>
                <div className="info-row">
                  <span className="info-row__label">状態</span>
                  <span className="info-row__value"><StatusBadge status={selected.currentStatus} /></span>
                </div>
                <div className="info-row">
                  <span className="info-row__label">QR URL</span>
                  <span className="info-row__value" style={{ fontSize: 11, wordBreak: 'break-all', color: 'var(--color-text-sub)' }}>
                    {qrUrl}
                  </span>
                </div>
              </div>

              <button type="button" className="btn btn--primary btn--block" onClick={handlePrint}>
                印刷する
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--block"
                onClick={() => { setSelected(null); setQuery(''); }}
              >
                別の物品を選ぶ
              </button>
            </div>
          </div>
        ) : null}
      </main>

      {/* 印刷用スタイル */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .app-shell { display: block; }
          .header, .bottom-actions { display: none !important; }
          .qr-issue-box { margin: 0; }
          .qr-label { text-align: center; padding: 16px; }
          .qr-label__name { font-size: 20px; font-weight: bold; margin-bottom: 4px; }
          .qr-label__number { font-size: 14px; color: #666; margin-bottom: 12px; }
          .qr-label__image { display: block; margin: 0 auto; }
        }
      `}</style>
    </div>
  );
}
