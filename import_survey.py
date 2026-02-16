import pandas as pd
import re
from supabase import create_client

# --- 設定 ---
SUPABASE_URL = "https://uuzytsezpxqtxxtvybhj.supabase.co"
SUPABASE_KEY = "sb_publishable_rOF6ggCSluOwQURMzWISAw_n473FelL"
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def import_survey(csv_path):
    # 1. ライブ情報の取得
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
        # 重要: Web側のフィルタリングに必須の「年度」を文字列で抽出
        target_year = str(target_date.split('-')[0])

    except Exception as e:
        print(f"❌ ライブ情報の取得に失敗しました: {e}")
        return

    print("\n🏢 会場タイプを選択してください:")
    venue_types = ["LIVE HOUSE", "HALL", "ARENA", "FES", "OTHER"]
    for i, t in enumerate(venue_types):
        print(f"[{i}] {t}")
    v_choice = int(input("番号を入力してください: "))
    selected_venue_type = venue_types[v_choice]

    # 2. CSV読み込み
    print(f"📖 CSV '{csv_path}' を読み込み中...")
    # encodingはファイルに合わせて適宜変更してください
    try:
        df = pd.read_csv(csv_path, encoding='utf-8')
    except UnicodeDecodeError:
        df = pd.read_csv(csv_path, encoding='shift_jis')
    
    def extract_number(text):
        if pd.isna(text): return "1"
        nums = re.findall(r'\d+', str(text))
        return nums[0] if nums else "1"

    records = []
    
    # 3. 整形ロジックの修正
    for _, row in df.iterrows():
        # 曲名の取得
        raw_song = str(row['曲名']) if pd.notna(row['曲名']) else "未回答"
        
        # 来場回数（数値だけ抜き出して「〇回」にする）
        attendance_num = extract_number(row['項目2'])
        visits_str = f"{attendance_num}回"
        
        # 年齢（「20代」の形式にする。28歳なら20代）
        if pd.notna(row['年齢']):
            age_val = int(re.findall(r'\d+', str(row['年齢']))[0])
            age_display = f"{(age_val // 10) * 10}代" if age_val < 60 else "60代以上"
        else:
            age_display = "未回答"

        records.append({
            "live_name":    target_event_title,
            "venue_type":   selected_venue_type,
            "event_year":   target_year,
            "request_song": raw_song.strip(), # 分割はJS側でも行うため、ここでは1セル分を入れる
            "visits":       visits_str,
            "prefecture":   str(row['都道府県名']) if pd.notna(row['都道府県名']) else "未回答",
            "age":          age_display,
            "gender":       str(row['性別']) if pd.notna(row['性別']) else "未回答",
            "created_at":   f"{target_date}T09:00:00Z"
        })

    # 4. Supabaseへ送信
    if records:
        print(f"🚀 {len(records)}件のデータを送信中...")
        try:
            # 【重要】削除条件を「日付範囲」から「ライブ名と年度」に変更
            # これにより、似た日付の別データが消えるのを防ぎます
            supabase.table("survey_responses").delete() \
                .eq("live_name", target_event_title) \
                .eq("event_year", target_year) \
                .execute()

            # データ量が多い場合は小分けにする
            chunk_size = 100
            for i in range(0, len(records), chunk_size):
                supabase.table("survey_responses").insert(records[i:i+chunk_size]).execute()
            
            print(f"✨ 取り込み成功！")
            print(f"📊 設定: {target_year}年度 / {selected_venue_type} / {target_event_title}")
        except Exception as e:
            print(f"❌ 保存エラー: {e}")
    else:
        print("⚠️ 登録するデータがありませんでした。")

if __name__ == "__main__":
    import_survey('20260202.csv')