import requests
from supabase import create_client

# --- 設定（ここはそのまま自分のものを入れてください） ---
SUPABASE_URL = "https://uuzytsezpxqtxxtvybhj.supabase.co"
SUPABASE_KEY = "sb_publishable_rOF6ggCSluOwQURMzWISAw_n473FelL"
YOUTUBE_API_KEY = "AIzaSyDYTlobSRUZ0TrjNliwBugz77VtpvQNDeA"
VIDEO_ID = 'XqZsoesa55w'

def run_sync():
    print("YouTube APIにアクセス中...")
    yt_url = f"https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id={VIDEO_ID}&key={YOUTUBE_API_KEY}"
    res = requests.get(yt_url).json()
    
    # ここで中身をチェック
    if 'error' in res:
        print("❌ YouTube APIエラーが発生しています:")
        print(res['error']['message'])
        return
        
    if not res.get('items'):
        print("❌ 動画が見つかりません。APIキーが有効か、または動画IDが正しいか確認してください。")
        print("APIからのレスポンス:", res) # 念のため中身を表示
        return

    # 正常な場合の処理
    item = res['items'][0]
    title = item['snippet']['title']
    views = int(item['statistics']['viewCount'])
    
    print(f"✅ 取得成功: {title} ({views}回)")
    
    # Supabase送信
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    supabase.table("youtube_stats").insert({"title": title, "views": views, "video_id": VIDEO_ID}).execute()
    print("✅ Supabaseに保存しました！")

if __name__ == "__main__":
    run_sync()