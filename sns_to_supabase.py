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

def get_instagram_followers(username):
    """Instagramのフォロワー数を中継サイトから取得（検知回避のため待機を入れる）"""
    try:
        # 実行前に少し待機して人間らしさを出す
        time.sleep(5)
        # 直接Instagramを叩かず、外部の統計確認用ページを利用
        url = f"https://www.viewstats.com/instagram/user/{username}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        }
        response = requests.get(url, headers=headers, timeout=20)
        
        if response.status_code == 200:
            # 「1.2M Followers」や「450,000 Followers」などのパターンを抽出
            match = re.search(r'([\d,.]+)([MKk]?)\s*Followers', response.text, re.IGNORECASE)
            if match:
                raw_val = match.group(1).replace(',', '')
                suffix = match.group(2).upper()
                count = float(raw_val)
                if suffix == 'M': count *= 1000000
                elif suffix == 'K': count *= 1000
                return int(count)
        print(f"⚠️ Instagram({username})取得失敗: HTTP {response.status_code}")
    except Exception as e:
        print(f"⚠️ Instagram({username})取得エラー: {e}")
    return None

def get_x_followers(username):
    """Xのフォロワー数を取得"""
    try:
        url = f"https://syndication.twitter.com/settings/user?screen_name={username}"
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(url, headers=headers, timeout=15)
        if response.status_code == 200:
            count = response.json().get("user", {}).get("followers_count")
            if count:
                print(f"✅ X({username})成功: {count}人")
                return count
    except Exception as e:
        print(f"⚠️ X取得エラー: {e}")
    return None

def get_tiktok_followers(username):
    """TikTokのフォロワー数を取得"""
    try:
        url = f"https://www.tiktok.com/@{username}"
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(url, headers=headers, timeout=15)
        match = re.search(r'"followerCount":(\d+)', response.text)
        if match:
            count = int(match.group(1))
            print(f"✅ TikTok({username})成功: {count}人")
            return count
    except Exception as e:
        print(f"⚠️ TikTok取得エラー: {e}")
    return None

def main():
    # 引数処理の設定
    parser = argparse.ArgumentParser()
    parser.add_argument('--target', choices=['official', 'takuya'], help='Target Instagram account')
    args = parser.parse_args()

    print(f"--- 🚀 SNSデータ同期開始 [Target: {args.target if args.target else 'ALL'}] ---")
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ エラー: SUPABASE の設定が見つかりません。")
        return
        
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 1. YouTube取得 (引数なし、またはofficialの時のみ実行)
    if args.target in [None, 'official']:
        try:
            yt_url = "https://www.googleapis.com/youtube/v3/channels"
            yt_params = {"part": "statistics", "id": YOUTUBE_ID, "key": YOUTUBE_API_KEY}
            res = requests.get(yt_url, params=yt_params).json()
            if 'items' in res:
                yt_count = int(res['items'][0]['statistics']['subscriberCount'])
                print(f"✅ YouTube成功: {yt_count}人")
                supabase.table("sns_stats").insert({"platform": "youtube", "follower_count": yt_count}).execute()
        except Exception as e: print(f"❌ YouTubeエラー: {e}")

    # 2. X / TikTok取得 (officialの時のみ、またはALLの時のみ実行)
    if args.target in [None, 'official']:
        x_count = get_x_followers(X_USERNAME)
        if x_count:
            supabase.table("sns_stats").insert({"platform": "x_official", "follower_count": x_count}).execute()
        
        tk_count = get_tiktok_followers(TIKTOK_USERNAME)
        if tk_count:
            supabase.table("sns_stats").insert({"platform": "tiktok_takuya", "follower_count": tk_count}).execute()

    # 3. Instagram取得 (時間差運用のメイン)
    insta_targets = []
    if args.target == 'official':
        insta_targets = [("uverworld_official", "instagram_official")]
    elif args.target == 'takuya':
        insta_targets = [("takuya_world_official", "instagram_takuya")]
    else:
        # 手動実行用（両方）
        insta_targets = [("uverworld_official", "instagram_official"), ("takuya_world_official", "instagram_takuya")]

    for username, platform_id in insta_targets:
        print(f"⏳ Instagram({username}) 取得中...")
        count = get_instagram_followers(username)
        if count:
            try:
                supabase.table("sns_stats").insert({"platform": platform_id, "follower_count": count}).execute()
                print(f"✅ Instagram({username})保存完了: {count}人")
            except Exception as e: print(f"❌ Instagram保存エラー: {e}")
        
        if len(insta_targets) > 1:
            time.sleep(30) # 連続実行時の安全策

    print("--- ✨ 処理完了 ---")

if __name__ == "__main__":
    main()