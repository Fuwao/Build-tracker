// Repository のエントリポイント。
// 全ページ・コンポーネントはここからインポートする。
//
// 現在の保存先: Supabase
// localStorageRepository は旧ローカル版として参照・比較用に残しています。
//
// localStorage 版に戻す場合:
//   export { repository } from './localStorageRepository';
//
export { supabaseRepository as repository } from './supabaseRepository';
