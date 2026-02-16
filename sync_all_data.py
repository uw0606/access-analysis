import os
import requests
from bs4 import BeautifulSoup
from supabase import create_client
import re

# --- 設定 ---
# 環境変数が設定されていない場合は直接入力するか、.envファイル等を使用してください
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ エラー: SUPABASE_URL または SUPABASE_KEY が設定されていません。")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def scrape_uver_schedule():
    print("📅 UVERworld公式サイトから詳細スケジュールを同期中...")
    url = "https://www.uverworld.jp/schedule/list/"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    try:
        res = requests.get(url, headers=headers, timeout=15)
        res.encoding = res.apparent_encoding
        soup = BeautifulSoup(res.text, 'html.parser')

        # スケジュール項目を特定
        items = soup.find_all(['li', 'dl', 'div'], class_=re.compile(r'schedule|list|item'))
        if not items:
            items = soup.find_all('li')

        print(f"🔎 詳細解析中... 候補: {len(items)}件")

        count = 0
        for item in items:
            # 1. 日付の抽出 (202X.XX.XX)
            text_full = item.get_text(" ", strip=True)
            date_match = re.search(r'(\d{4})\.(\d{2})\.(\d{2})', text_full)
            if not date_match:
                continue
            
            # yyyy-mm-dd 形式に正規化
            event_date = f"{date_match.group(1)}-{date_match.group(2)}-{date_match.group(3)}"

            # 2. リンク内テキストを優先取得（タイトル抽出精度アップ）
            link_el = item.find('a')
            raw_title = link_el.get_text(" ", strip=True) if link_el else text_full

            # 3. カテゴリーの特定
            category = "OTHER"
            cat_text = "OTHER"
            # 公式の主要カテゴリーを検索
            cat_match = re.search(r'(TOUR|LIVE|EVENT|RELEASE|TV|RADIO|MAGAZINE|GOODS|TICKET|INFO)', raw_title.upper())
            
            if cat_match:
                cat_text = cat_match.group(1)
                if cat_text in ["TOUR", "LIVE", "EVENT"]: category = "LIVE"
                elif cat_text == "RELEASE": category = "RELEASE"
                elif cat_text in ["TV", "RADIO", "MAGAZINE"]: category = "TV"
            
            # 4. タイトルのクレンジング（強化版）
            # 日付部分 (2026.02.13等) を削除
            clean_title = raw_title.replace(date_match.group(0), "")
            
            # 曜日 [TUE] や (火) ［WED］ などを完全に除去
            clean_title = re.sub(r'[\[\(\（\［].*?[\]\)\）\］]', '', clean_title)
            
            # カテゴリーワード (TOUR等) が文頭にある場合に削除
            clean_title = re.sub(r'^(TOUR|LIVE|EVENT|RELEASE|TV|RADIO|MAGAZINE|GOODS|TICKET|INFO)\s*', '', clean_title, flags=re.IGNORECASE)
            
            # 残ってしまった記号（- や :）を掃除
            clean_title = clean_title.strip(" -:：")
            
            # 余分な空白を1つにまとめる
            clean_title = " ".join(clean_title.split()).strip()

            # 空になった場合の保険
            if not clean_title: 
                clean_title = f"{cat_text} (詳細不明)"

            # 5. 重複チェック（日付とタイトルで判定）
            existing = supabase.table("calendar_events") \
                .select("*") \
                .eq("event_date", event_date) \
                .eq("title", clean_title) \
                .execute()
            
            if not existing.data:
                supabase.table("calendar_events").insert({
                    "event_date": event_date,
                    "category": category,
                    "title": clean_title,
                    "description": f"Official Category: {cat_text}"
                }).execute()
                print(f"🆕 追加 [{category}]: {event_date} - {clean_title}")
                count += 1
            else:
                # 既に存在する場合のログ（デバッグ用）
                # print(f"⏩ スキップ: {event_date} - {clean_title}")
                pass

        print(f"\n✨ 同期完了！ 新規追加: {count} 件")

    except Exception as e:
        print(f"❌ エラーが発生しました: {e}")

if __name__ == "__main__":
    scrape_uver_schedule()