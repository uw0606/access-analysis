import os
import requests
import re
import time
from supabase import create_client
from dotenv import load_dotenv

# .env.localから環境変数を読み込む
load_dotenv(".env.local")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# --- 【最新版】取得したCookieをセット ---
# Instagram用：TAKUYA∞さんのページから取得した最新の認証情報
INSTA_COOKIE = 'datr=6wLtZ8J775mMFSsxYfzS_kNC; ig_did=9F7D1CAF-8CBD-4F52-B714-79157FE52D8C; ig_nrcb=1; ps_l=1; ps_n=1; mid=aWKEQAAEAAF9vsKo0uiWw6b7mx0A; fbm_124024574287414=base_domain=.instagram.com; csrftoken=Ps46yuKJ33b131XwtP2j73ZNAr2nwdaj; ds_user_id=4244271179; dpr=1; sessionid=4244271179%3A2kUB2XPmpn2S0c%3A13%3AAYgVhlPDLAx0cXXjzoFaH3aomIFgU9JwHpA8aK0zjg; wd=455x747; rur="CCO\0544244271179\0541802109139:01fe40beb1348d81c6e767350dc81bd42419756f57e978c31b776950cf14f4347b4536e4"'

# TikTok用：先日成功した認証情報
TIKTOK_COOKIE = 'tt_csrf_token=mTnhscn8-sCFI9hTAG6LvBRg5hg41GS2Qac8; sid_tt=a0fd06ef604ee0eebd0d36554af36442; sessionid=a0fd06ef604ee0eebd0d36554af36442; ttwid=1%7CTDsxaGrDtnxLX_nE2i2GI_7PXf5eW7Cn_S8zFNPcJI0%7C1770572299%7C60f34e779161ec21ab541685f7241784dabda9687f476e146735f6f59949d4fb;'

def get_insta_count(username):
    # パラメータを追加してデータの確実性を向上
    url = f"https://www.instagram.com/{username}/?__a=1&__d=dis"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Cookie": INSTA_COOKIE,
        "Accept": "*/*"
    }
    try:
        res = requests.get(url, headers=headers, timeout=15)
        # ログイン済みデータからフォロワー数を抽出
        match = re.search(r'"edge_followed_by":\{"count":(\d+)\}', res.text)
        if match:
            return int(match.group(1))
        
        # 予備の検索パターン
        match_alt = re.search(r'"edge_followed_by":\s?\{"count":\s?(\d+)\}', res.text)
        if match_alt:
            return int(match_alt.group(1))
            
    except Exception as e:
        print(f"❌ {username} エラー: {e}")
    return None

def get_tiktok_count(username):
    url = f"https://www.tiktok.com/@{username}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Cookie": TIKTOK_COOKIE
    }
    try:
        res = requests.get(url, headers=headers, timeout=15)
        match = re.search(r'followerCount":(\d+)', res.text)
        return int(match.group(1)) if match else None
    except: return None

def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ 環境変数が設定されていません。.env.localを確認してください。")
        return
    
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # 取得対象リスト
    targets = [
        ("instagram_official", "uverworld_official", "insta"),
        ("instagram_takuya", "takuya_world_official", "insta"),
        ("tiktok_takuya", "uver_takuya8", "tiktok")
    ]

    print("--- ⚔️ UVERworld SNS 同期ミッション開始 ---")

    for platform_id, username, sns_type in targets:
        print(f"⏳ {username} ({sns_type}) を解析中...")
        
        if sns_type == "insta":
            count = get_insta_count(username)
        else:
            count = get_tiktok_count(username)
            
        if count:
            try:
                supabase.table("sns_stats").insert({
                    "platform": platform_id,
                    "follower_count": count
                }).execute()
                print(f"✅ {platform_id}: {count:,}人 保存成功")
            except Exception as e:
                print(f"❌ 保存失敗: {e}")
        else:
            print(f"⚠️ {username} の取得に失敗しました。Cookieが切れている可能性があります。")
        
        time.sleep(7) # 連続アクセスを避けるための安全時間

    print("\n✨ すべての任務が完了しました！")

if __name__ == "__main__":
    main()