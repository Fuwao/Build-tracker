// =============================================================================
// src/contexts/AuthContext.tsx
// 認証状態管理コンテキスト
//
// 管理する状態:
//   checking        - 起動時のセッション確認中
//   unauthenticated - 未ログイン
//   loading_profile - ログイン済み、profileテーブル取得中
//   profile_missing - profileレコードが存在しない(またはRLSで非表示)
//   inactive        - profile取得済み、is_active=false
//   profile_error   - profile取得時にエラー発生
//   ready           - すべて正常、アプリ使用可能
//
// 【RLSに関する既知の制限】
// 現在の profiles_select_own ポリシーは is_active_user() を使用しているため、
// is_active=false のユーザーは自分のprofileを取得できない。
// そのため profile_missing と inactive を区別できないケースがある。
// この問題を解消するには SQL の profiles_select_own ポリシーから
// is_active_user() を除去する必要がある(次フェーズで対応予定)。
// =============================================================================
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from '../lib/supabase';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------
export type AuthStatus =
  | 'checking'         // 初期確認中
  | 'unauthenticated'  // 未ログイン
  | 'loading_profile'  // profile取得中
  | 'profile_missing'  // profileなし(またはRLSで非表示)
  | 'inactive'         // is_active=false
  | 'profile_error'    // profile取得エラー
  | 'ready';           // 正常使用可能

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  role: 'admin' | 'employee';
  is_active: boolean;
}

interface AuthContextValue {
  authStatus: AuthStatus;
  session: Session | null;
  profile: UserProfile | null;
  signOut: () => Promise<void>;
  retryProfile: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth は AuthProvider の内側で使用してください');
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function AuthProvider({ children }: { children: ReactNode }) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const retryCountRef = useRef(0);

  // profileテーブルからログイン中ユーザー情報を取得する。
  // 成功・失敗どちらの場合も必ず authStatus を 'loading_profile' から
  // 別の状態へ進める(finally で保証する)。
  const fetchProfile = useCallback(async (userId: string) => {
    setAuthStatus('loading_profile');
    setProfile(null);

    if (!supabase) {
      setAuthStatus('profile_error');
      return;
    }

    let nextStatus: AuthStatus = 'profile_error';
    let nextProfile: UserProfile | null = null;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, display_name, role, is_active')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('[AuthContext] profile fetch error:', error);
        nextStatus = 'profile_error';
      } else if (!data) {
        // 行が見つからない = profileが未登録 または is_active=false でRLSに除外された
        // (RLSポリシーの制限により両者を区別できない。次フェーズでSQL修正予定)
        nextStatus = 'profile_missing';
      } else if (!data.is_active) {
        // is_active=false → 利用不可 (現在はRLSで除外されるためここには到達しにくい)
        nextProfile = data as UserProfile;
        nextStatus = 'inactive';
      } else {
        nextProfile = data as UserProfile;
        nextStatus = 'ready';
      }
    } catch (e) {
      console.error('[AuthContext] unexpected error in fetchProfile:', e);
      nextStatus = 'profile_error';
    } finally {
      // 成功・失敗いずれの経路でも必ずここで loading_profile から抜ける
      setProfile(nextProfile);
      setAuthStatus(nextStatus);
    }
  }, []);

  // profile取得を再試行する(profile_error 状態から呼ぶ)
  const retryProfile = useCallback(() => {
    retryCountRef.current += 1;
    if (session?.user.id) {
      void fetchProfile(session.user.id);
    }
  }, [session, fetchProfile]);

  // ---------------------------------------------------------------------
  // セッション監視の設定
  //
  // [修正前の問題]
  // 以前は onAuthStateChange() の初回発火(INITIAL_SESSION イベント)のみで
  // 初期セッションを判定していた。しかし Supabase クライアントは内部で
  // ロック取得・localStorage 読み込みを経て非同期にこのイベントを発火するため、
  // 初回アクセス(コールドスタート)ではこの発火が数秒〜十数秒遅れることがあり、
  // 「ログイン状況の確認中」が長時間残る原因になっていた。
  // リロード時に速いのは、ブラウザ・Supabaseクライアント内部の状態が
  // 既に温まっているため発火が速くなるからで、根本原因は解消されていなかった。
  //
  // [修正後]
  // 1. まず supabase.auth.getSession() を明示的に呼び、現在のセッションを取得する。
  //    これは Supabase 公式が推奨する初期化パターンであり、内部ロックの完了を
  //    確実に待ってから結果を返すため、不確定な遅延発火に依存しない。
  // 2. getSession() の結果を try/catch/finally で確実に処理し、
  //    成功・失敗どちらの場合も authStatus を 'checking' から進める。
  // 3. onAuthStateChange() は以後の変化(ログイン・ログアウト・トークン更新)の
  //    監視にのみ使用する。INITIAL_SESSION イベントは上記1で処理済みのため
  //    重複処理を避けるためスキップする。
  // ---------------------------------------------------------------------
  useEffect(() => {
    // Supabase が設定されていない場合は即座に未ログイン状態へ(loading を残さない)
    if (!supabase || !supabaseConfigured) {
      setAuthStatus('unauthenticated');
      return;
    }

    let mounted = true;
    const sb = supabase;

    async function initAuth() {
      try {
        const { data, error } = await sb.auth.getSession();
        if (!mounted) return;

        if (error) {
          console.error('[AuthContext] getSession error:', error);
          // セッション取得自体に失敗した場合は未ログイン扱いにし、
          // ログイン画面から再試行できるようにする(loadingを残さない)
          setAuthStatus('unauthenticated');
          return;
        }

        const currentSession = data.session;
        if (!currentSession) {
          setSession(null);
          setAuthStatus('unauthenticated');
          return;
        }

        setSession(currentSession);
        await fetchProfile(currentSession.user.id); // 内部で必ず authStatus を確定させる
      } catch (e) {
        console.error('[AuthContext] initAuth unexpected error:', e);
        if (mounted) setAuthStatus('unauthenticated');
      }
    }

    void initAuth();

    // 以後のログイン・ログアウト・トークン更新を監視する。
    // INITIAL_SESSION は initAuth() 側で処理済みなのでここではスキップする。
    const { data: { subscription } } = sb.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      if (event === 'INITIAL_SESSION') return;

      if (!newSession) {
        // サインアウト / セッション切れ
        setSession(null);
        setProfile(null);
        setAuthStatus('unauthenticated');
        return;
      }

      // ログイン / トークン更新
      setSession(newSession);
      void fetchProfile(newSession.user.id);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // サインアウト
  const signOut = useCallback(async () => {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('[AuthContext] signOut error:', e);
      // エラーが発生しても状態をリセットしてログイン画面へ
      setSession(null);
      setProfile(null);
      setAuthStatus('unauthenticated');
    }
  }, []);

  return (
    <AuthContext.Provider value={{ authStatus, session, profile, signOut, retryProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
