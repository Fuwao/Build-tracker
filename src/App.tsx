// [調査メモ] 現状、ルート定義はフラットなリストで、認証状態やロールに基づく
// アクセス制御の仕組み(ProtectedRouteのようなラッパーやレイアウトルート)は
// 一切存在しない。admin/employeeの権限制御を導入する際は、ログイン状態を
// 確認するラッパーコンポーネントと、ロールごとに許可されたルートのみを
// 表示するガード処理をこのファイルに追加する必要がある。
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoadingScreen } from './components/LoadingScreen';
import { AuthErrorPage } from './components/AuthErrorPage';
import { LoginPage } from './pages/LoginPage';
import { PermissionDeniedPage } from './pages/PermissionDeniedPage';
import { HomePage } from './pages/HomePage';
import { EmployeeHomePage } from './pages/EmployeeHomePage';
import { SearchPage } from './pages/SearchPage';
import { QrScanPage } from './pages/QrScanPage';
import { ItemDetailPage } from './pages/ItemDetailPage';
import { OutboundPage } from './pages/OutboundPage';
import { InboundPage } from './pages/InboundPage';
import { TransferPage } from './pages/TransferPage';
import { CompletePage } from './pages/CompletePage';
import { LocationsOverviewPage } from './pages/LocationsOverviewPage';
import { HistoryPage } from './pages/HistoryPage';
import { SiteDetailPage } from './pages/SiteDetailPage';
import { ItemManagementPage } from './pages/ItemManagementPage';
import { LocationManagementPage } from './pages/LocationManagementPage';
import { QrIssuePage } from './pages/QrIssuePage';
import { SettingsPage } from './pages/SettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';
// 開発用: Supabase接続確認ページ (確認完了後に削除可能)
import { SupabaseCheckPage } from './pages/SupabaseCheckPage';

// ---------------------------------------------------------------------------
// 未認証時: 現在のパスを /login の state に保存してリダイレクト
// ログイン後に state.from を使って元のページへ戻る設計
// ---------------------------------------------------------------------------
function RedirectToLogin() {
  const location = useLocation();
  // /login 自体へのアクセスは from を保存しない(無限ループ防止)
  const from = location.pathname !== '/login' ? location.pathname + location.search : undefined;
  return <Navigate to="/login" state={from ? { from } : undefined} replace />;
}

// ログイン成功後: state.from があればそこへ、なければホームへ
function LoginRedirect() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  // 安全な遷移先かチェック: 外部URLや /login 自体は除外
  const dest = from && from.startsWith('/') && from !== '/login' ? from : '/';
  return <Navigate to={dest} replace />;
}

// ---------------------------------------------------------------------------
// 認証確認中のローディング画面。
// 5秒以上同じ画面が表示され続けた場合、「接続に時間がかかっています」と
// 補足メッセージ + 再読み込みボタンを表示する。
// 'checking' → 'loading_profile' のように authStatus が変化しても
// この LoadingScreen 自体は再マウントされないため、タイマーは
// 認証確認プロセス全体を通して1本だけ動く。
// ---------------------------------------------------------------------------
function AuthLoadingScreen({ message }: { message: string }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <LoadingScreen
      message={message}
      subMessage={slow ? '接続に時間がかかっています。\n通信環境を確認するか、ページを再読み込みしてください。' : undefined}
      showReload={slow}
    />
  );
}

// ---------------------------------------------------------------------------
// 認証状態に応じてルートを切り替えるコンポーネント
// ---------------------------------------------------------------------------
function AppRoutes() {
  const { authStatus } = useAuth();

  // ① 認証確認中 / profile取得中 → ローディング表示(5秒超で再読み込み案内)
  if (authStatus === 'checking' || authStatus === 'loading_profile') {
    return <AuthLoadingScreen message="ログイン状況の確認中…" />;
  }

  // ② profileエラー系 → エラー画面(ログアウトボタン付き)
  if (
    authStatus === 'profile_missing' ||
    authStatus === 'inactive' ||
    authStatus === 'profile_error'
  ) {
    return <AuthErrorPage status={authStatus} />;
  }

  // ③ 未ログイン → ログイン画面のみ表示
  //    現在のパスを state として /login に渡し、ログイン後に元のページへ戻れるようにする
  if (authStatus === 'unauthenticated') {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<RedirectToLogin />} />
      </Routes>
    );
  }

  // ④ ready → ロールに応じたルート表示
  //    /login へ来た場合は state.from があればそこへ、なければホームへリダイレクト
  const profile = useAuth().profile!;
  const isAdmin = profile.role === 'admin';

  return (
    <Routes>
      <Route path="/login" element={<LoginRedirect />} />

      {/* ホーム: ロールで分岐 */}
      <Route path="/" element={isAdmin ? <HomePage /> : <EmployeeHomePage />} />

      {/* 全ロール共通 */}
      <Route path="/search" element={<SearchPage />} />
      <Route path="/qr-scan" element={<QrScanPage />} />
      <Route path="/items/:itemId" element={<ItemDetailPage />} />
      <Route path="/items/:itemId/outbound" element={<OutboundPage />} />
      <Route path="/items/:itemId/inbound" element={<InboundPage />} />
      <Route path="/items/:itemId/transfer" element={<TransferPage />} />
      <Route path="/complete" element={<CompletePage />} />
      <Route path="/sites/:locationId" element={<SiteDetailPage />} />

      {/* admin 専用: employeeはPermissionDeniedPage */}
      <Route path="/current-locations" element={isAdmin ? <LocationsOverviewPage /> : <PermissionDeniedPage />} />
      <Route path="/history"           element={isAdmin ? <HistoryPage />            : <PermissionDeniedPage />} />
      <Route path="/items"             element={isAdmin ? <ItemManagementPage />      : <PermissionDeniedPage />} />
      <Route path="/locations"         element={isAdmin ? <LocationManagementPage />  : <PermissionDeniedPage />} />
      <Route path="/qr-issue"          element={isAdmin ? <QrIssuePage />             : <PermissionDeniedPage />} />
      <Route path="/settings"          element={isAdmin ? <SettingsPage />            : <PermissionDeniedPage />} />
      {/* 開発用: Supabase接続確認。確認完了後にこの行と上記importを削除可能 */}
      <Route path="/supabase-check"    element={isAdmin ? <SupabaseCheckPage />       : <PermissionDeniedPage />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

// ---------------------------------------------------------------------------
// ルートコンポーネント
// ---------------------------------------------------------------------------
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
