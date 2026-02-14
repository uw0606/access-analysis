import pandas as pd
import re
import os
from supabase import create_client

# --- 設定 ---
SUPABASE_URL = "https://uuzytsezpxqtxxtvybhj.supabase.co"
# ※セキュリティのため、本番ではService Role Keyの使用を推奨しますが、現状のキーで進めます
SUPABASE_KEY = "sb_publishable_rOF6ggCSluOwQURMzWISAw_n473FelL"
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def import_survey(csv_path):
    # 1. calendar_eventsテーブルから直近のライブを取得
    try:
        res = supabase.table("calendar_events") \
            .select("id, event_date, title") \
            .eq("category", "LIVE") \
            .order("event_date", desc=True) \
            .limit(15) \
            .execute()
        
        events = res.data
        if not events:
            print("❌ カレンダーにライブ情報が見つかりません。")
            return

        print("\n📅 アンケートデータを紐付けるライブを選択してください:")
        for i, ev in enumerate(events):
            print(f"[{i}] {ev['event_date']} : {ev['title']}")
        
        choice = int(input("\n選択する番号を入力してください: "))
        target_event = events[choice]
        target_event_title = target_event['title']
        target_date = target_event['event_date']
        # 年度フィルター用に年を抽出 (例: "2026")
        target_year = target_date.split('-')[0]

    except Exception as e:
        print(f"❌ ライブ情報の取得に失敗しました: {e}")
        return

    # 会場タイプの選択（Webページのフィルターで必須のため追加）
    print("\n🏢 会場タイプを選択してください:")
    venue_types = ["LIVE HOUSE", "HALL", "ARENA", "FES", "OTHER"]
    for i, t in enumerate(venue_types):
        print(f"[{i}] {t}")
    v_choice = int(input("番号を入力してください: "))
    selected_venue_type = venue_types[v_choice]

    # 2. CSV読み込み
    print(f"📖 CSV '{csv_path}' を読み込み中...")
    # エンコーディングエラーが出る場合は encoding='shift_jis' を追加してください
    df = pd.read_csv(csv_path)
    
    def extract_number(text):
        if pd.isna(text): return "1"
        nums = re.findall(r'\d+', str(text))
        return nums[0] if nums else "1"

    records = []
    
    # 3. 1行ずつ整形（TSX側のフォーマットに完全一致させる）
    for _, row in df.iterrows():
        raw_song = str(row['曲名']) if pd.notna(row['曲名']) else "未回答"
        # 区切り文字で分割
        songs = re.split(r'[、,/／\s\n]+', raw_song)
        
        # TSX側と型を合わせる（数値も文字列として扱う）
        attendance = extract_number(row['項目2'])
        age_val = str(int(row['年齢'])) if pd.notna(row['年齢']) else "0"
        
        for s in songs:
            s = s.strip()
            if not s: continue
            
            records.append({
                "live_name":    target_event_title,  # Web表示に必須
                "venue_type":   selected_venue_type, # Webフィルターに必須
                "event_year":   target_year,         # 年度フィルターに必須
                "request_song": s,                   # キー名をTSXに合わせた
                "visits":       f"{attendance}回",    # 「1回」の形式に整形
                "prefecture":   str(row['都道府県名']) if pd.notna(row['都道府県名']) else "不明",
                "age":          f"{age_val}代",      # 「20代」の形式に整形
                "gender":       str(row['性別']) if pd.notna(row['性別']) else "不明",
                "created_at":   f"{target_date}T09:00:00Z" # 日付をライブ日に固定
            })

    # 4. Supabaseへ一括保存
    if records:
        print(f"🚀 {len(records)}件のデータを送信中...")
        try:
            # 既存の同一ライブ・同一日のデータを削除してから挿入（上書きロジック）
            supabase.table("survey_responses").delete() \
                .eq("live_name", target_event_title) \
                .gte("created_at", f"{target_date}T00:00:00Z") \
                .lte("created_at", f"{target_date}T23:59:59Z") \
                .execute()

            supabase.table("survey_responses").insert(records).execute()
            print(f"✨ 取り込み成功！ Webページで '{target_event_title}' を確認してください。")
        except Exception as e:
            print(f"❌ 保存エラー: {e}")
    else:
        print("⚠️ 登録するデータがありませんでした。")

if __name__ == "__main__":
    # 読み込みたいファイル名に変更してください
    import_survey('20260202.csv')