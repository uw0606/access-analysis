import os
import requests
import re
import time
from supabase import create_client

# --- 設定値 ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")

YOUTUBE_ID = "UCnziFQs4Ihms4UtxmVZP6cg"
TIKTOK_USERNAME = "uver_takuya8"
X_USERNAME = "UVERworld_dR2"  # 公式アカウント

def get_x_followers(username):
    """Xのフォロワー数を取得（埋め込み用APIルートを使用）"""
    try:
        # X本体のページではなく、認証が緩い埋め込み用データ提供URLを使用
        url = f"https://syndication.twitter.com/settings/user?screen_name={username}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        }
        response = requests.get(url, headers=headers, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            # このURLが生きている場合、詳細な数値が返ってきます
            count = data.get("user", {}).get("followers_count")
            if count:
                print(f"✅ X({username})成功: {count}人")
                return count
        else:
            print(f"⚠️ X取得失敗: HTTP {response.status_code}")
    except Exception as e:
        print(f"⚠️ X取得エラー: {e}")
    return None

def get_tiktok_followers(username):
    """TikTokのフォロワー数を取得（詳細なstatsV2を優先）"""
    try:
        url = f"https://www.tiktok.com/@{username}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        }
        response = requests.get(url, headers=headers, timeout=15)
        match = re.search(r'statsV2":.*?followerCount":"(\d+)"', response.text)
        if not match:
            match = re.search(r'"followerCount":(\d+)', response.text)
        if match:
            return int(match.group(1))
    except Exception as e:
        print(f"⚠️ TikTok取得エラー: {e}")
    return None

def update_sns_data():
    print("--- 🚀 SNSデータ一括取得・更新開始 (YouTube, TikTok, X) ---")
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ エラー: SUPABASE の設定が見つかりません。")
        return
        
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # === 1. YouTube取得 ===
    try:
        yt_url = "https://www.googleapis.com/youtube/v3/channels"
        yt_params = {"part": "statistics", "id": YOUTUBE_ID, "key": YOUTUBE_API_KEY}
        response = requests.get(yt_url, params=yt_params)
        res = response.json()
        if response.status_code == 200 and 'items' in res:
            yt_count = int(res['items'][0]['statistics']['subscriberCount'])
            print(f"✅ YouTube成功: {yt_count}人")
            supabase.table("sns_stats").insert({"platform": "youtube", "follower_count": yt_count}).execute()
    except Exception as e:
        print(f"❌ YouTubeエラー: {e}")

    # === 2. X (Twitter) 取得 ===
    print(f"⏳ X({X_USERNAME}) 取得中...")
    x_count = get_x_followers(X_USERNAME)
    if x_count:
        try:
            supabase.table("sns_stats").insert({"platform": "x_official", "follower_count": x_count}).execute()
        except Exception as e:
            print(f"❌ X保存エラー: {e}")

    # === 3. TikTok取得 ===
    print(f"⏳ TikTok({TIKTOK_USERNAME}) 取得中...")
    tk_count = get_tiktok_followers(TIKTOK_USERNAME)
    if tk_count:
        try:
            print(f"✅ TikTok成功: {tk_count}人")
            supabase.table("sns_stats").insert({"platform": "tiktok_takuya", "follower_count": tk_count}).execute()
        except Exception as e:
            print(f"❌ TikTok保存エラー: {e}")

    print("--- ✨ 全ての処理が完了しました ---")

if __name__ == "__main__":
    update_sns_data()