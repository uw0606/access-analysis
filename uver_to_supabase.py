import requests
from supabase import create_client

# --- 設定（あなたの情報を入れてください） ---
SUPABASE_URL = "https://uuzytsezpxqtxxtvybhj.supabase.co"
SUPABASE_KEY = "sb_publishable_rOF6ggCSluOwQURMzWISAw_n473FelL"
YOUTUBE_API_KEY = "AIzaSyDYTlobSRUZ0TrjNliwBugz77VtpvQNDeA"

# UVERworldの解析したい曲リスト（動画ID）
SONG_LIST = {
    'BMVGeB_iCh0': "Eye's Sentry",
    '9KpAtOAohV8': "SHAMROCK",
    'IITjr6Ysh60': "D-tecnoLife",
    'hg4_hqIk8kA': "AVALANCHE"
}

def fetch_and_save():
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # 登録した曲を順番に処理
    for video_id, song_name in SONG_LIST.items():
        print(f"取得中: {song_name}...")
        
        yt_url = f"https://www.googleapis.com/youtube/v3/videos?part=statistics&id={video_id}&key={YOUTUBE_API_KEY}"
        res = requests.get(yt_url).json()
        
        if 'items' in res and len(res['items']) > 0:
            views = int(res['items'][0]['statistics']['viewCount'])
            
            # Supabaseに保存
            data = {
                "title": song_name,
                "views": views,
                "video_id": video_id
            }
            supabase.table("youtube_stats").insert(data).execute()
            print(f"✅ 保存完了: {views} 回")
        else:
            print(f"❌ {song_name} のデータが取得できませんでした")

if __name__ == "__main__":
    fetch_and_save()