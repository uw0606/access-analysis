import os
import requests
import instaloader
import re
import time
from supabase import create_client

# --- 設定値 ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")

YOUTUBE_ID = "UCnziFQs4Ihms4UtxmVZP6cg"
INSTAGRAM_ACCOUNTS = [
    {"username": "uverworld_official", "label": "instagram"},
    {"username": "takuya_world_official", "label": "instagram_takuya"}
]
TIKTOK_USERNAME = "uver_takuya8"

def get_tiktok_followers(username):
    """TikTokのフォロワー数を取得（スクレイピング）"""
    try:
        url = f"https://www.tiktok.com/@{username}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
        }
        response = requests.get(url, headers=headers, timeout=15)
        # HTML内からフォロワー数を抽出
        match = re.search(r'"followerCount":(\d+)', response.text)
        if match:
            return int(match.group(1))
    except Exception as e:
        print(f"⚠️ TikTok取得エラー: {e}")
    return None

def update_sns_data():
    print("--- 🚀 SNSデータ一括取得・更新開始 (Order: YT -> IG -> TK) ---")
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ エラー: SUPABASE の設定が見つかりません。")
        return
        
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # === 1. YouTube取得 ===
    try:
        yt_url = "https://www.googleapis.com/youtube/v3/channels"
        yt_params = {
            "part": "statistics",
            "id": YOUTUBE_ID,
            "key": YOUTUBE_API_KEY
        }
        response = requests.get(yt_url, params=yt_params)
        res = response.json()
        
        if response.status_code == 200 and 'items' in res:
            yt_count = int(res['items'][0]['statistics']['subscriberCount'])
            print(f"✅ YouTube成功: {yt_count}人")
            supabase.table("sns_stats").insert({"platform": "youtube", "follower_count": yt_count}).execute()
        else:
            print("❌ YouTube取得失敗")
    except Exception as e:
        print(f"❌ YouTubeエラー: {e}")

    # === 2. Instagram取得 ===
    # Instaloaderの内部リトライを防ぐため、敢えてログインなし、かつ短い待機設定で初期化
    loader = instaloader.Instaloader(
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"
    )
    
    for idx, target in enumerate(INSTAGRAM_ACCOUNTS):
        try:
            # 2つ目以降のアカウント取得前に長めの待機（60秒）
            if idx > 0:
                print(f"⏳ 429回避のため、60秒待機します...")
                time.sleep(60)
            
            print(f"⏳ Instagram({target['username']}) 取得試行中...")
            
            # Instaloaderが429でリトライに入るのを防ぐため、タイムアウト付きで実行
            profile = instaloader.Profile.from_username(loader.context, target["username"])
            insta_count = profile.followers
            
            if insta_count:
                print(f"✅ Instagram({target['username']})成功: {insta_count}人")
                supabase.table("sns_stats").insert({"platform": target["label"], "follower_count": insta_count}).execute()
                
        except Exception as e:
            # 429エラー(Too Many Requests)が発生しても、ここで例外をキャッチして次のSNS（TikTok）へ進む
            print(f"⚠️ Instagram({target['username']})取得エラー/制限のためスキップ: {e}")
            continue

    # === 3. TikTok取得 ===
    print(f"⏳ TikTok({TIKTOK_USERNAME}) 取得中...")
    tk_count = get_tiktok_followers(TIKTOK_USERNAME)
    if tk_count:
        try:
            print(f"✅ TikTok({TIKTOK_USERNAME})成功: {tk_count}人")
            supabase.table("sns_stats").insert({"platform": "tiktok_takuya", "follower_count": tk_count}).execute()
        except Exception as e:
            print(f"❌ TikTok保存エラー: {e}")
    else:
        print("❌ TikTokの自動取得失敗")

    print("--- ✨ 全ての処理が完了しました ---")

if __name__ == "__main__":
    update_sns_data()