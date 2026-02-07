import os
import requests
import re
import time
import argparse
from supabase import create_client

# --- 設定値 ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")

YOUTUBE_ID = "UCnziFQs4Ihms4UtxmVZP6cg"
TIKTOK_USERNAME = "uver_takuya8"
X_USERNAME = "UVERworld_dR2"

def get_tiktok_followers(username):
    """TikTokフォロワー数を外部軽量サイトから取得"""
    try:
        # TikTok専用の軽量カウンターサイトを狙う
        url = f"https://countik.com/user/@{username}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
        }
        response = requests.get(url, headers=headers, timeout=20)
        if response.status_code == 200:
            # countikのHTML構造からフォロワー数を探す
            match = re.search(r'followerCount\\":(\d+)', response.text)
            if not match:
                match = re.search(r'>([\d,.]+)([MKk]?) Followers<', response.text, re.IGNORECASE)
            
            if match:
                # 数字の抽出ロジック
                if match.group(0).startswith('followerCount'):
                    count = int(match.group(1))
                else:
                    raw_val = match.group(1).replace(',', '')
                    suffix = match.group(2).upper()
                    count = float(raw_val)
                    if suffix == 'M': count *= 1000000
                    elif suffix == 'K': count *= 1000
                print(f"✅ TikTok({username})成功: {int(count)}人")
                return int(count)
        print(f"⚠️ TikTok({username})取得失敗: HTTP {response.status_code}")
    except Exception as e:
        print(f"⚠️ TikTok({username})エラー: {e}")
    return None

def get_instagram_followers(username):
    """Instagramフォロワー数を別の統計ビューワーから取得"""
    try:
        time.sleep(7) # 待機時間を少し伸ばす
        # viewstatsがダメな場合、分析系サイトの public path を狙う
        url = f"https://www.picit.ai/instagram/user/{username}" 
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
        }
        response = requests.get(url, headers=headers, timeout=20)
        
        if response.status_code == 200:
            # より広範なパターンで検索
            match = re.search(r'([\d,.]+)([MKk]?)\s*Followers', response.text, re.IGNORECASE)
            if match:
                raw_val = match.group(1).replace(',', '')
                suffix = match.group(2).upper()
                count = float(raw_val)
                if suffix == 'M': count *= 1000000
                elif suffix == 'K': count *= 1000
                print(f"✅ Instagram({username})成功: {int(count)}人")
                return int(count)
        print(f"⚠️ Instagram({username})取得失敗: HTTP {response.status_code}")
    except Exception as e:
        print(f"⚠️ Instagram({username})エラー: {e}")
    return None

def get_x_followers(username):
    """Xのフォロワー数 (予備のJSONエンドポイント)"""
    try:
        url = f"https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names={username}"
        response = requests.get(url, timeout=15)
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                count = data[0].get("followers_count")
                print(f"✅ X({username})成功: {count}人")
                return count
        print(f"⚠️ X({username})取得失敗: HTTP {response.status_code}")
    except Exception as e:
        print(f"⚠️ X取得エラー: {e}")
    return None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--target', choices=['official', 'takuya'], help='Target mode')
    args = parser.parse_args()

    print(f"--- 🚀 SNS同期開始 (案Bモード) [Target: {args.target if args.target else 'ALL'}] ---")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 1. YouTube/X/TikTok
    if args.target in [None, 'official']:
        # YouTube (公式APIなのでここは安定)
        try:
            yt_url = "https://www.googleapis.com/youtube/v3/channels"
            yt_params = {"part": "statistics", "id": YOUTUBE_ID, "key": YOUTUBE_API_KEY}
            res = requests.get(yt_url, params=yt_params).json()
            if 'items' in res:
                yt_count = int(res['items'][0]['statistics']['subscriberCount'])
                print(f"✅ YouTube成功: {yt_count}人")
                supabase.table("sns_stats").insert({"platform": "youtube", "follower_count": yt_count}).execute()
        except Exception as e: print(f"❌ YouTubeエラー: {e}")

        # X
        x_count = get_x_followers(X_USERNAME)
        if x_count:
            supabase.table("sns_stats").insert({"platform": "x_official", "follower_count": x_count}).execute()
        
        # TikTok
        tk_count = get_tiktok_followers(TIKTOK_USERNAME)
        if tk_count:
            supabase.table("sns_stats").insert({"platform": "tiktok_takuya", "follower_count": tk_count}).execute()

    # 2. Instagram
    insta_targets = []
    if args.target == 'official':
        insta_targets = [("uverworld_official", "instagram_official")]
    elif args.target == 'takuya':
        insta_targets = [("takuya_world_official", "instagram_takuya")]
    else:
        insta_targets = [("uverworld_official", "instagram_official"), ("takuya_world_official", "instagram_takuya")]

    for username, platform_id in insta_targets:
        print(f"⏳ Instagram({username}) 取得中...")
        count = get_instagram_followers(username)
        if count:
            try:
                supabase.table("sns_stats").insert({"platform": platform_id, "follower_count": count}).execute()
            except Exception as e: print(f"❌ Instagram保存エラー: {e}")
        time.sleep(10)

    print("--- ✨ 処理完了 ---")

if __name__ == "__main__":
    main()