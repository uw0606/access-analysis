import requests
from bs4 import BeautifulSoup
import csv

def scrape_uver_live():
    # 2025年のライブ一覧を取得してみる
    year = "2025"
    url = f"https://www.uverworld.jp/live/?year={year}"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    response = requests.get(url, headers=headers)
    response.encoding = response.apparent_encoding # 文字化け防止
    
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # UVERworld公式サイトの構造に合わせて抽出
    # クラス名はサイト改修で変わることがあるので、その場合は修正が必要です
    live_items = soup.select('ul.live-list li.live-list__item')
    
    if not live_items:
        print("ライブ情報が見つかりませんでした。サイトの構造を確認してください。")
        return

    # CSVファイルに保存
    with open('uver_lives.csv', mode='w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['日付', 'タイトル', '会場'])
        
        for item in live_items:
            date = item.select_one('.live-list__date').text.strip()
            title = item.select_one('.live-list__title').text.strip()
            # 会場名はタイトルの中に含まれることが多いですが、あれば抽出
            print(f"取得中: {date} | {title}")
            writer.writerow([date, title, ""])

    print(f"\n成功！ {len(live_items)} 件のライブ情報を uver_lives.csv に保存しました。")

if __name__ == "__main__":
    scrape_uver_live()