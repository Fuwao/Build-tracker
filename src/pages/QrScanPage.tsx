// =============================================================================
// QRコード読み取りページ
//
// 対応QR形式:
//   1. URL形式 (新): https://<host>/items/<uuid>  ← QrIssuePage が発行する形式
//   2. ITEM形式 (旧): ITEM:<managementNumber>     ← 旧バージョンのQRとの後方互換
//
// カメラ (getUserMedia) は HTTPS または localhost 環境が必要。
// http://192.168.x.x:5173 等ではカメラが使えないため案内を表示する。
// =============================================================================
import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import jsQR from 'jsqr';
import { Header } from '../components/Header';
import { repository } from '../repository';

type ScanState = 'https-warning' | 'starting' | 'scanning' | 'denied' | 'unsupported' | 'not-found' | 'invalid';

const LEGACY_PREFIX = 'ITEM:';

/** /items/:id または /item-detail/:id 形式の URL から itemId を抽出 */
function extractItemIdFromUrl(raw: string): string | null {
  try {
    // URL かどうか判定
    const url = new URL(raw);
    const match = url.pathname.match(/\/items?(?:-detail)?\/([a-zA-Z0-9_-]{8,})/);
    return match?.[1] ?? null;
  } catch {
    // URL でない場合は null
    return null;
  }
}

export function QrScanPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  // HTTPS でない環境ではカメラが使えない
  const isHttps = window.isSecureContext;

  const [state, setState] = useState<ScanState>(isHttps ? 'starting' : 'https-warning');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isHttps) return; // HTTPS 警告画面を表示するだけ

    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setState('unsupported');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setState('scanning');
        tick();
      } catch {
        setState('denied');
      }
    }

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) { rafRef.current = requestAnimationFrame(tick); return; }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data) {
        if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        void handleDetected(code.data);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    async function handleDetected(raw: string) {
      const text = raw.trim();

      // ---- 1. 新形式: URL に /items/:id が含まれる ----
      const itemIdFromUrl = extractItemIdFromUrl(text);
      if (itemIdFromUrl) {
        try {
          const item = await repository.getItemById(itemIdFromUrl);
          if (item) {
            stopCamera();
            navigate(`/items/${item.id}`);
            return;
          }
          setState('not-found');
          setMessage(`物品が見つかりません (ID: ${itemIdFromUrl.slice(0, 8)}…)`);
          return;
        } catch {
          setState('not-found');
          setMessage('物品情報の取得に失敗しました。再試行してください。');
          return;
        }
      }

      // ---- 2. 旧形式: ITEM:<管理番号> ----
      if (text.startsWith(LEGACY_PREFIX)) {
        const managementNumber = text.slice(LEGACY_PREFIX.length).trim();
        try {
          const item = managementNumber ? await repository.getItemByManagementNumber(managementNumber) : undefined;
          if (item) {
            stopCamera();
            navigate(`/items/${item.id}`);
            return;
          }
          setState('not-found');
          setMessage(`管理番号「${managementNumber}」の物品が見つかりません。`);
          return;
        } catch {
          setState('not-found');
          setMessage('物品情報の取得に失敗しました。再試行してください。');
          return;
        }
      }

      // ---- 3. 未対応形式 ----
      setState('invalid');
      setMessage('対応していないQRコードです。物品管理システムが発行したQRコードを読み取ってください。');
    }

    start();
    return () => { cancelled = true; stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopCamera() {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  }

  function retryScan() {
    setState('starting');
    setMessage('');
    window.location.reload();
  }

  return (
    <div className="app-shell">
      <Header title="QRコード読取" />
      <main className="page page--narrow page--with-bottom-bar">

        {/* HTTPS 環境でない場合 */}
        {state === 'https-warning' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div className="error-banner">
              <strong>QR読み取りはHTTPS環境でのみ動作します</strong><br />
              ローカル開発中(http://192.168.x.x など)では、スマホカメラへのアクセスが制限されます。<br />
              手入力登録をご利用ください。
            </div>
            <div className="panel">
              <p className="section-title">ローカルでの確認方法</p>
              <p className="form-hint">
                PC の Chrome など localhost 環境では動作します。<br />
                本番環境(Vercel / Netlify 等の HTTPS URL)ではスマホでもカメラが使えます。
              </p>
            </div>
          </div>
        ) : null}

        {/* カメラ映像 */}
        {(state === 'scanning' || state === 'starting') ? (
          <div className="qr-frame">
            <video ref={videoRef} muted playsInline style={{ width: '100%', maxHeight: '60dvh', objectFit: 'cover' }} />
            <div className="qr-frame__guide" />
            <div className="qr-frame__status">
              {state === 'starting' ? 'カメラを起動しています…' : 'QRコードを枠内に合わせてください'}
            </div>
          </div>
        ) : null}

        {/* エラーメッセージ */}
        {state === 'denied' ? (
          <div className="error-banner">
            カメラを利用できませんでした。ブラウザのカメラ許可を確認してから「再試行」を押してください。
          </div>
        ) : null}
        {state === 'unsupported' ? (
          <div className="error-banner">
            このブラウザではカメラ読み取りに対応していません。手入力で検索してください。
          </div>
        ) : null}
        {(state === 'invalid' || state === 'not-found') ? (
          <div className="error-banner">{message}</div>
        ) : null}

        <canvas ref={canvasRef} style={{ display: 'none' }} aria-hidden="true" />
      </main>

      {/* 下部アクション */}
      <div className="bottom-actions">
        {(state === 'denied' || state === 'invalid' || state === 'not-found') ? (
          <button type="button" className="btn btn--primary btn--block" onClick={retryScan}>
            再試行
          </button>
        ) : null}
        <Link to="/search" className="btn btn--secondary btn--block">
          手入力で検索する
        </Link>
      </div>
    </div>
  );
}
