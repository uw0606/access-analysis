import pandas as pd
import re
from supabase import create_client

# --- 設定 ---
SUPABASE_URL = "https://uuzytsezpxqtxxtvybhj.supabase.co"
# クライアントサイドのキー（もし権限エラーが出る場合はService Role Keyへの変更を検討してください）
SUPABASE_KEY = "sb_publishable_rOF6ggCSluOwQURMzWISAw_n473FelL"
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def import_survey(csv_path):
    # 1. calendar_eventsテーブルからライブ情報を取得
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
        target_year = str(target_date.split('-')[0])

    except Exception as e:
        print(f"❌ ライブ情報の取得に失敗しました: {e}")
        return

    # 会場タイプの選択
    print("\n🏢 会場タイプを選択してください:")
    venue_types = ["LIVE HOUSE", "HALL", "ARENA", "FES", "OTHER"]
    for i, t in enumerate(venue_types):
        print(f"[{i}] {t}")
    v_choice = int(input("番号を入力してください: "))
    selected_venue_type = venue_types[v_choice]

    # 2. CSV読み込み
    print(f"📖 CSV '{csv_path}' を読み込み中...")
    try:
        df = pd.read_csv(csv_path, encoding='utf-8')
    except UnicodeDecodeError:
        df = pd.read_csv(csv_path, encoding='shift_jis')
    
    def extract_number(text):
        if pd.isna(text): return "1"
        nums = re.findall(r'\d+', str(text))
        return nums[0] if nums else "1"

    records = []
    
    # 3. 1行ずつ整形（Web側のフォーマットと一致させる）
    for _, row in df.iterrows():
        raw_song = str(row['曲名']) if pd.notna(row['曲名']) else "未回答"
        
        # 来場回数の整形
        attendance_num = extract_number(row['項目2'])
        visits_str = f"{attendance_num}回"
        
        # 年齢の整形（28歳 → 20代）
        if pd.notna(row['年齢']):
            # 数値を抽出して年代に変換
            nums = re.findall(r'\d+', str(row['年齢']))
            if nums:
                age_val = int(nums[0])
                age_display = f"{(age_val // 10) * 10}代" if age_val < 60 else "60代以上"
            else:
                age_display = "未回答"
        else:
            age_display = "未回答"

        records.append({
            "live_name":    target_event_title,
            "venue_type":   selected_venue_type,
            "event_year":   target_year,
            "request_song": raw_song.strip(),
            "visits":       visits_str,
            "prefecture":   str(row['都道府県名']) if pd.notna(row['都道府県名']) else "未回答",
            "age":          age_display,
            "gender":       str(row['性別']) if pd.notna(row['性別']) else "未回答",
            "created_at":   f"{target_date}T09:00:00Z" # 日付をライブ日に固定
        })

    # 4. Supabaseへ一括保存
    if records:
        print(f"🚀 {len(records)}件のデータを送信中...")
        try:
            # 【重要】ピンポイント削除ロジック
            # 日付範囲(gte/lte)ではなく、ライブ名と年度で完全に一致するものだけを削除
            supabase.table("survey_responses").delete() \
                .eq("live_name", target_event_title) \
                .eq("event_year", target_year) \
                .execute()

            # 挿入実行（念のため100件ずつ分割）
            chunk_size = 100
            for i in range(0, len(records), chunk_size):
                supabase.table("survey_responses").insert(records[i:i+chunk_size]).execute()
            
            print(f"✨ 取り込み成功！ Webページで '{target_event_title}' を確認してください。")
        except Exception as e:
            print(f"❌ 保存エラー: {e}")
    else:
        print("⚠️ 登録するデータがありませんでした。")

if __name__ == "__main__":
    # 実行時に読み込みたいファイル名に変更してください
    import_survey('20260202.csv')