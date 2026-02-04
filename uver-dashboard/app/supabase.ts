import { createClient } from "@supabase/supabase-js";

// 環境変数が無い場合に備えて、空文字をデフォルトにする
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// クライアントの作成
// urlが空だとビルド時にエラーになるため、仮のURLではなく空文字を渡す
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);