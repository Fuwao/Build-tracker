// =============================================================================
// QRコード発行ページ (admin 専用)
//
// QRコードには物品詳細の URL を埋め込む:
//   ${window.location.origin}/items/${item.id}
//
// スマホで読み取ると /items/:id に直接ジャンプする。
//
// ラベルサイズ:
//   小(45mm) … 工具向け    / QR 28mm / 管理番号・物品名のみ
//   中(65mm) … ケース向け  / QR 40mm / +状態
//   大(95mm) … 掲示向け    / QR 65mm / +現在地・状態・URL
// =============================================================================
import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Header } from '../components/Header';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { useAppData } from '../hooks/useAppData';
import { searchItems } from '../repository/selectors';
import type { ItemWithRelations } from '../types';

type LabelSize = 'small' | 'medium' | 'large';

interface SizePreset {
  label: string;
  hint: string;
  qrPx: number;           // 画面プレビュー/QR生成時のピクセルサイズ(高解像度を確保)
  showLocation: boolean;  // 現在地を表示するか
  showStatus: boolean;    // 状態を表示するか
  showUrl: boolean;       // QR URLを表示するか
}

const SIZE_PRESETS: Record<LabelSize, SizePreset> = {
  small:  { label: '小：工具向け',   hint: '約45mm幅 / QR約28mm', qrPx: 240, showLocation: false, showStatus: false, showUrl: false },
  medium: { label: '中：ケース向け', hint: '約65mm幅 / QR約40mm', qrPx: 320, showLocation: false, showStatus: true,  showUrl: false },
  large:  { label: '大：掲示向け',   hint: '約95mm幅 / QR約65mm', qrPx: 480, showLocation: true,  showStatus: true,  showUrl: true  },
};

export function QrIssuePage() {
  const { items, locations, categories, loading } = useAppData();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ItemWithRelations | null>(null);
  const [size, setSize] = useState<LabelSize>('medium');
  const [dataUrl, setDataUrl] = useState('');
  const [qrError, setQrError] = useState('');

  const preset = SIZE_PRESETS[size];

  const results = useMemo(
    () => (query.trim() ? searchItems(items, locations, categories, query) : []),
    [items, locations, categories, query]
  );

  // QR に埋め込む URL: アプリの origin + /items/:itemId (サイズに関わらず仕様は不変)
  const qrUrl = selected ? `${window.location.origin}/items/${selected.id}` : '';

  // QRコードはサイズプリセットに応じた解像度で都度再生成する
  // (印刷時に小さくつぶれないよう、画面表示サイズより高めの px で生成しCSS側で実寸に縮小する)
  useEffect(() => {
    if (!selected) { setDataUrl(''); setQrError(''); return; }
    let cancelled = false;
    setQrError('');
    QRCode.toDataURL(qrUrl, { width: preset.qrPx, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => { if (!cancelled) setDataUrl(url); })
      .catch((e) => {
        console.error('QRコードの生成に失敗しました', e);
        if (!cancelled) setQrError('QRコードの生成に失敗しました。');
      });
    return () => { cancelled = true; };
  }, [selected, qrUrl, preset.qrPx]);

  function handlePrint() { window.print(); }

  return (
    <div className="app-shell">
      <Header title="QRコード発行" showNav />
      <main className="page page--narrow">
        {/* 画面説明 */}
        <p className="page-lead no-print">
          物品を検索してQRコードを発行します。ラベルサイズを選んで印刷し、物品に貼付してください。
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
          <>
            {/* ラベルサイズ選択(画面専用) */}
            <div className="no-print" style={{ marginTop: 'var(--space-3)' }}>
              <p className="section-title" style={{ marginTop: 0 }}>ラベルサイズ</p>
              <div className="qr-size-picker">
                {(Object.keys(SIZE_PRESETS) as LabelSize[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`qr-size-picker__btn ${size === key ? 'qr-size-picker__btn--active' : ''}`}
                    onClick={() => setSize(key)}
                  >
                    {SIZE_PRESETS[key].label}
                    <small>{SIZE_PRESETS[key].hint}</small>
                  </button>
                ))}
              </div>
              {size === 'small' ? (
                <p className="form-hint" style={{ marginTop: 'var(--space-2)' }}>
                  ⚠️ 小サイズは工具向けです。印刷後、必ずスマホでQRが読み取れるか確認してください。
                </p>
              ) : null}
            </div>

            <div className="qr-issue-box">
              {/* 印刷対象のラベル本体 */}
              <div className={`qr-label qr-label--${size}`}>
                <div className="qr-label__name">{selected.itemName}</div>
                <div className="qr-label__number">{selected.managementNumber}</div>

                {qrError ? (
                  <div className="error-banner">{qrError}</div>
                ) : dataUrl ? (
                  <img
                    className="qr-label__image"
                    src={dataUrl}
                    alt={`${selected.managementNumber} のQRコード`}
                  />
                ) : (
                  <div className="empty-state" style={{ minHeight: 80 }}>QRコード生成中…</div>
                )}

                {/* サイズプリセットに応じた補足情報 */}
                {preset.showLocation || preset.showStatus ? (
                  <div className="qr-label__sub">
                    {preset.showLocation ? <div>現在地: {selected.locationName}</div> : null}
                    {preset.showStatus ? <div>状態: {selected.currentStatus === 'storage' ? '置場' : selected.currentStatus === 'site' || selected.currentStatus === 'onsite' ? '現場' : selected.currentStatus === 'repair' ? '修理中' : '所在不明'}</div> : null}
                  </div>
                ) : null}
                {preset.showUrl ? <div className="qr-label__url">{qrUrl}</div> : null}
              </div>

              {/* 画面専用: 物品詳細情報・URLの表示・操作ボタン */}
              <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
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
                  印刷する({preset.label})
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
          </>
        ) : null}
      </main>
    </div>
  );
}
