// utils/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 💡 null を返さないと TypeScript に保証する
export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey
);
