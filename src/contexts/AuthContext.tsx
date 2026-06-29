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

  // profileテーブルからログイン中ユーザー情報を取得する
  const fetchProfile = useCallback(async (userId: string) => {
    setAuthStatus('loading_profile');
    setProfile(null);

    if (!supabase) {
      setAuthStatus('profile_error');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, display_name, role, is_active')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('[AuthContext] profile fetch error:', error);
        setAuthStatus('profile_error');
        return;
      }

      if (!data) {
        // 行が見つからない = profileが未登録 または is_active=false でRLSに除外された
        // (RLSポリシーの制限により両者を区別できない。次フェーズでSQL修正予定)
        setAuthStatus('profile_missing');
        return;
      }

      if (!data.is_active) {
        // is_active=false → 利用不可 (現在はRLSで除外されるためここには到達しにくい)
        setProfile(data as UserProfile);
        setAuthStatus('inactive');
        return;
      }

      setProfile(data as UserProfile);
      setAuthStatus('ready');
    } catch (e) {
      console.error('[AuthContext] unexpected error in fetchProfile:', e);
      setAuthStatus('profile_error');
    }
  }, []);

  // profile取得を再試行する(profile_error 状態から呼ぶ)
  const retryProfile = useCallback(() => {
    retryCountRef.current += 1;
    if (session?.user.id) {
      void fetchProfile(session.user.id);
    }
  }, [session, fetchProfile]);

  // セッション監視の設定
  useEffect(() => {
    // Supabaseが設定されていない場合は即座に未ログイン状態へ
    if (!supabase || !supabaseConfigured) {
      setAuthStatus('unauthenticated');
      return;
    }

    let mounted = true;

    // onAuthStateChange は初回マウント時にも現在のセッションで発火する
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return;

        if (!newSession) {
          // サインアウト / セッション切れ
          setSession(null);
          setProfile(null);
          setAuthStatus('unauthenticated');
          return;
        }

        // ログイン / セッション更新
        setSession(newSession);
        await fetchProfile(newSession.user.id);
      }
    );

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
