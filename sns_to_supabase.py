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

# ==========================================
# SNS取得関数（ロジック保持のため残していますが現在は呼び出していません）
# ==========================================

def get_tiktok_followers(username):
    """TikTokフォロワー数を外部軽量サイトから取得"""
    try:
        url = f"https://countik.com/user/@{username}"
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"}
        response = requests.get(url, headers=headers, timeout=20)
        if response.status_code == 200:
            match = re.search(r'followerCount\\":(\d+)', response.text)
            if not match:
                match = re.search(r'>([\d,.]+)([MKk]?) Followers<', response.text, re.IGNORECASE)
            if match:
                if match.group(0).startswith('followerCount'): count = int(match.group(1))
                else:
                    raw_val = match.group(1).replace(',', ''); suffix = match.group(2).upper()
                    count = float(raw_val)
                    if suffix == 'M': count *= 1000000
                    elif suffix == 'K': count *= 1000
                return int(count)
    except Exception: pass
    return None

def get_instagram_followers(username):
    """Instagramフォロワー数を別の統計ビューワーから取得"""
    try:
        url = f"https://www.picit.ai/instagram/user/{username}" 
        headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"}
        response = requests.get(url, headers=headers, timeout=20)
        if response.status_code == 200:
            match = re.search(r'([\d,.]+)([MKk]?)\s*Followers', response.text, re.IGNORECASE)
            if match:
                raw_val = match.group(1).replace(',', ''); suffix = match.group(2).upper()
                count = float(raw_val)
                if suffix == 'M': count *= 1000000
                elif suffix == 'K': count *= 1000
                return int(count)
    except Exception: pass
    return None

def get_x_followers(username):
    """Xのフォロワー数"""
    try:
        url = f"https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names={username}"
        response = requests.get(url, timeout=15)
        if response.status_code == 200:
            data = response.json()
            if data: return data[0].get("followers_count")
    except Exception: pass
    return None

# ==========================================
# メイン処理（YouTubeのみ実行し、SNSはスキップ）
# ==========================================

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--target', choices=['official', 'takuya'], help='Target mode')
    args = parser.parse_args()

    # TAKUYA∞用ジョブの場合はSNS取得のみが目的だったため、現在は何もしない
    if args.target == 'takuya':
        print("--- ℹ️ TAKUYA∞モード (SNS自動取得停止中のためスキップ) ---")
        return

    print(f"--- 🚀 YouTubeデータ同期開始 ---")
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ SUPABASE設定ミス")
        return
        
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # YouTube登録者数（公式APIなので安定して動作します）
    try:
        yt_url = "https://www.googleapis.com/youtube/v3/channels"
        yt_params = {"part": "statistics", "id": YOUTUBE_ID, "key": YOUTUBE_API_KEY}
        res = requests.get(yt_url, params=yt_params).json()
        if 'items' in res:
            yt_count = int(res['items'][0]['statistics']['subscriberCount'])
            print(f"✅ YouTube登録者数: {yt_count}人")
            supabase.table("sns_stats").insert({"platform": "youtube", "follower_count": yt_count}).execute()
            print("✅ Supabase保存完了")
    except Exception as e:
        print(f"❌ YouTube取得エラー: {e}")

    # SNSの自動取得は、以下のロジックが将来的に安定したサイトを見つけたら再開可能です
    # 現状はエラーによるActionsの停止を防ぐため、呼び出しを行いません。
    print("ℹ️ SNS(X, TikTok, Instagram)の自動取得は現在スキップされています。")
    print("--- ✨ 処理完了 ---")

if __name__ == "__main__":
    main()