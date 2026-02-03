import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// クライアントを1つだけ作って使い回す（ビルドエラー防止）
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co", 
  supabaseAnonKey || "placeholder"
);
