import pandas as pd
import re
import os
from supabase import create_client

# --- 設定 ---
SUPABASE_URL = "https://uuzytsezpxqtxxtvybhj.supabase.co"
SUPABASE_KEY = "sb_publishable_rOF6ggCSluOwQURMzWISAw_n473FelL"
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def import_survey(csv_path):
    # 1. calendar_eventsテーブルから直近のライブを取得
    # カテゴリーが 'LIVE' のものを日付が新しい順に表示します
    try:
        res = supabase.table("calendar_events") \
            .select("id, event_date, title") \
            .eq("category", "LIVE") \
            .order("event_date", desc=True) \
            .limit(15) \
            .execute()
        
        events = res.data
        if not events:
            print("❌ カレンダーにライブ情報が見つかりません。先にスケジュール同期を実行してください。")
            return

        print("\n📅 アンケートデータを紐付けるライブを選択してください:")
        for i, ev in enumerate(events):
            print(f"[{i}] {ev['event_date']} : {ev['title']}")
        
        choice = int(input("\n選択する番号を入力してください: "))
        target_event_id = events[choice]['id']
        target_event_title = events[choice]['title']

    except Exception as e:
        print(f"❌ ライブ情報の取得に失敗しました: {e}")
        return

    # 2. CSV読み込み
    print(f"📖 CSV '{csv_path}' を読み込み中...")
    df = pd.read_csv(csv_path)
    
    # 参戦回数の数字抽出用
    def extract_number(text):
        if pd.isna(text): return 1
        nums = re.findall(r'\d+', str(text))
        return int(nums[0]) if nums else 1

    records = []
    
    # 3. 1行ずつ整形してリストに追加
    for _, row in df.iterrows():
        # 曲名の分割（「、」「/」「\n」などで区切られている場合に対応）
        raw_song = str(row['曲名']) if pd.notna(row['曲名']) else "未回答"
        songs = re.split(r'[、,/／\s\n]+', raw_song)
        
        # 数値のクレンジング
        attendance = extract_number(row['項目2'])
        age = int(row['年齢']) if pd.notna(row['年齢']) else 0
        
        for s in songs:
            s = s.strip()
            if not s: continue
            
            records.append({
                "event_id": target_event_id,
                "requested_song": s,
                "attendance_count": attendance,
                "prefecture": row['都道府県名'] if pd.notna(row['都道府県名']) else "不明",
                "age": age,
                "gender": row['性別'] if pd.notna(row['性別']) else "不明"
            })

    # 4. Supabaseへ一括保存
    if records:
        print(f"🚀 {len(records)}件のデータを送信中...")
        try:
            supabase.table("survey_responses").insert(records).execute()
            print(f"✨ 取り込み成功！ '{target_event_title}' に紐付けられました。")
        except Exception as e:
            print(f"❌ 保存エラー: {e}")
    else:
        print("⚠️ 登録するデータがありませんでした。")

if __name__ == "__main__":
    # アップロードしたファイル名に合わせてください
    import_survey('20260202.csv')