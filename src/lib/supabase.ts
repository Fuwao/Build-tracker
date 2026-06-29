// =============================================================================
// src/lib/supabase.ts
// Supabase クライアントの初期化
//
// 使い方:
//   import { supabase, supabaseConfigured } from '../lib/supabase'
//   if (!supabaseConfigured) { /* 環境変数未設定 */ return }
//   const { data, error } = await supabase!.from('items').select('*')
//
// 注意:
//   - 現在は localStorage 版と並走。既存の repository は変更していない。
//   - ログイン機能は未実装のため、未認証状態での接続のみ可能。
//   - RLSが有効なため、未ログインでは大半のデータが取得できない(想定内)。
// =============================================================================
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const rawUrl  = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const rawKey  = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** VITE_SUPABASE_URL が設定されているか */
export const hasSupabaseUrl  = Boolean(rawUrl  && rawUrl.trim().length > 0);

/** VITE_SUPABASE_ANON_KEY が設定されているか */
export const hasSupabaseKey  = Boolean(rawKey  && rawKey.trim().length > 0);

/** 両方の環境変数が設定されていれば true */
export const supabaseConfigured = hasSupabaseUrl && hasSupabaseKey;

/**
 * Supabase クライアント。
 * 環境変数が未設定の場合は null。
 * 呼び出し側は `supabase!` のように non-null アサーションする前に
 * `supabaseConfigured` を確認すること。
 */
export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(rawUrl!.trim(), rawKey!.trim())
  : null;
