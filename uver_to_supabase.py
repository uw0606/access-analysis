import os
import requests
from supabase import create_client

# --- 1. 設定値の取得 ---
# GitHub Secrets または環境変数から直接取得します
# ローカルで動かす場合は、ターミナルで export SUPABASE_URL=... と設定するか、直接書き込んでください
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")

# --- 2. 起動チェック ---
def check_config():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ エラー: SUPABASE の設定が見つかりません。")
        print(f"DEBUG: URL設定={bool(SUPABASE_URL)}, KEY設定={bool(SUPABASE_KEY)}")
        return False
    
    if not YOUTUBE_API_KEY:
        print("⚠️ 警告: YOUTUBE_API_KEY が設定されていません。YouTubeデータの取得に失敗します。")
    return True

# 曲名リスト（video_id: 表示名）
SONG_LIST = {
    'ukyRC_fNEP0': "『THE OVER』",
    'F4GAkjShwjE': "『Don't Think.Feel』",
    'rF7WJmrLL-g': "『REVERSI』",
    'uap5DiPM0vY': "『Fight For Liberty version 1』",
    'EBwx7GBy2oM': "『ナノ・セカンド』",
    '2uPzLcizRZ8': "『THE SONG』",
    '4Hh43kQ43uE': "『endscape』",
    '5BuDHbIe4pg': "『激動』",
    '7zQ3CjvCa0U': "『ゼロの答』",
    '9KpAtOAohV8': "『SHAMROCK』",
    'FAU7NyiqwQY': "『7th Trigger』",
    'IITjr6Ysh60': "『D-tecnoLife』",
    'LXJSNjQOPks': "『99/100騙しの哲』",
    'SPQY3BmKfXo': "『NO.1』",
    'VvCuJRKj32E': "『AWAYOKUBA-斬る』",
    'WAvV0H5kY_o': "『CHANCE!』",
    'ZIEQDjrAdwE': "『儚くも永久のカナシ』",
    'ZqXmntTj33U': "『Roots』",
    '_F6iL239Sac': "『君の好きなうた』",
    'gErh5d3gpVk': "『Colors of the Heart』",
    'hC8v7N721c4': "『just Melody』",
    'hLtLjhV7PR0': "『クオリア』",
    'iv9FzgXAX5Y': "『KINJITO/BABY BORN ＆ GO』",
    'k9muunDqI5A': "『MONDO PIECE』",
    'kDtnoLeJMdw': "『GOLD』",
    'kk9djuXCmCY': "『シャカビーチ～Laka Laka La～』",
    'xgjBA231Gzw': "『浮世CROSSING』",
    'zRPPIuCBEjw': "『Just break the limit!』",
    '-RmW6tf2PSE': "『恋いしくて』",
    'IDuEih3KUUM': "『GO-ON』",
    'LaKp04a7hAM': "『哀しみはきっと』",
    'qOO_VdPS0xQ': "『バーベル～皇帝の新しい服ver.～』",
    'baJhnSJMZ98': "『7日目の決意 vol.02』",
    'zsdAN_vjMIg': "『IMPACT』",
    'MYaVtNmYfuU': "『誰が言った』",
    'zw5wH_Tr21U': "『僕の言葉ではない これは僕達の言葉』",
    'OG5DpaNU_X8': "『言わなくても伝わる あれは少し嘘だ』",
    'Pwht_zL3_go': "『I LOVE THE WORLD』",
    'icpc0UVUZgM': "『PRAYING RUN』",
    'eDOG59BEcg0': "『WE ARE GO』",
    'bhT6YTXehwc': "『DIS is TEKI』",
    '7wKjv4eLQ7s': "『一滴の影響 -ダブル・ライフ-』",
    'nDaVvnbVIkw': "『DECIDED』Short Ver.",
    'MkQctn0ktow': "『SHOUT LOVE』",
    'co3pUvgQ_Kk': "『PLOT』",
    '0zLxFAlS29A': "『ODD FUTURE』",
    'quvZfdiEwPA': "『GOOD and EVIL』Short Ver.",
    '6uoXYHV_P7Q': "『EDENへ』Short Ver.",
    'FHDMSpwz4jw': "『Touch off』Short Ver.",
    '4Tb6kB2lJ2s': "『ConneQt』Short Ver.",
    'vG4aY5ocnlg': "『ROB THE FRONTIER』",
    'x5j0jMcjues': "『Making it Drive』Short Ver.",
    'Cm4u7hPyZaQ': "『AS ONE』Music Video",
    'xFjaDb8xx3I': "『Teenage Love』Short ver.",
    'RUtntvZmeec': "『HOURGLASS』Short ver.",
    '-5qJjGtUvwk': "『NAMELY』Short ver.",
    'TedAu40FyCE': "『来鳥江』feat. 山田孝之 / 愛笑む Short ver.",
    'ZCOa3YY1MLc': "『SOUL』feat. 青山テルマ / 愛笑む Short ver.",
    'hg4_hqIk8kA': "『AVALANCHE』",
    '0VMCMf0SCJM': "『EN』",
    'wcbp6bmxSSs': "『One stroke for freedom』",
    'o-p_k3yDJlo': "『えくぼ』",
    'fWHnghPgg4Q': "『OXYMORON』",
    'KDJ9fv9EQys': "『ENCORE AGAIN (feat.SHUNTO from BE:FIRST)』",
    'lJ8njmZjTMU': "『VICTOSPIN』",
    'q3tvnCbFbo8': "『FINALIST (feat.ANARCHY)』",
    'BMVGeB_iCh0': "『Eye's Sentry』",
    'mvBCb7J8Dy0': "『PHOENIX』(Official Music Video)",
    'ccXoPztZbrw': "『MMH』(Official Music Video)",
    'bYcYko_g97k': "『Bye-Bye to you』(Official Music Video)",
    'prjI8z56xQQ': "『NO MAP』(Official Music Video)"
}

def fetch_and_save():
    if not check_config():
        exit(1)

    print("--- 📺 YouTube動画統計データ取得開始 ---")
    
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    for video_id, song_name in SONG_LIST.items():
        yt_url = f"https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id={video_id}&key={YOUTUBE_API_KEY}"
        try:
            res = requests.get(yt_url).json()
            
            if 'items' in res and len(res['items']) > 0:
                item = res['items'][0]
                views = int(item['statistics']['viewCount'])
                published_at = item['snippet']['publishedAt'][:10]
                
                data = {
                    "title": song_name,
                    "views": views,
                    "video_id": video_id,
                    "published_at": published_at 
                }
                
                supabase.table("youtube_stats").insert(data).execute()
                print(f"✅ {song_name}: {views:,} views")
            else:
                print(f"⚠️ {song_name}: データが見つかりませんでした (ID: {video_id})")
        
        except Exception as e:
            print(f"❌ {song_name} 処理エラー: {e}")

    print("--- ✨ 全データの更新が完了しました ---")

if __name__ == "__main__":
    fetch_and_save()