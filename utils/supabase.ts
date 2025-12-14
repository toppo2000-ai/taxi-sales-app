// utils/supabase.ts
import { createClient } from '@supabase/supabase-js';

// next.config.ts で定義した環境変数を読み込む
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 環境変数が設定されていない場合のエラーチェック
if (!supabaseUrl || !supabaseAnonKey) {
  // 環境変数がない場合、このエラーでサーバーが停止するはずだが、
  // next.config.tsが不完全な場合は undefined のまま実行されるリスクがある
  throw new Error('Supabase URL or ANON Key is missing in next.config.ts');
}

// Supabaseクライアントの初期化とエクスポート
export const supabase = createClient(supabaseUrl, supabaseAnonKey);