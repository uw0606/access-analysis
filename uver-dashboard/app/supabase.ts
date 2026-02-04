import { createClient } from "@supabase/supabase-js";

// 環境変数を取得（! をつけることで、TypeScriptに「絶対にあるから大丈夫」と伝えます）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 万が一、環境変数が設定されていない場合でもビルドを落とさないための防御策
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || ""
);