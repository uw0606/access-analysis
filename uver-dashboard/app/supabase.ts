import { createClient } from "@supabase/supabase-js";

// 環境変数から取得
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 環境変数が設定されていない場合に警告を出す（開発時のミス防止）
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "🚨 Supabaseの環境変数が読み込めていません。VercelのSettings > Environment Variables を確認してください。"
  );
}

// クライアントの作成（空文字を渡すとエラーになるので、安全に初期化）
export const supabase = createClient(
  supabaseUrl || "https://your-project.supabase.co", // ここに直接本物のURLを書いてもOKです
  supabaseAnonKey || ""
);