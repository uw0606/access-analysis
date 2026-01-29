import requests
import csv
from datetime import datetime
import os

API_KEY = 'AIzaSyDYTlobSRUZ0TrjNliwBugz77VtpvQNDeA'
TARGET_VIDEOS = {
    'Eye\'s Sentry': 'Fm7E5qS6u0A',
    'PRAYING RUN': '689_y9Yf9z4',
    'SHAMROCK': 'yXvH9P_vU0o'
}

def save_to_csv():
    ids = ','.join(TARGET_VIDEOS.values())
    url = f"https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id={ids}&key={API_KEY}"
    
    response = requests.get(url).json()
    
    # 今日の日付
    today = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    # ファイルがなければヘッダー（項目名）を作る
    file_exists = os.path.isfile('uver_stats.csv')
    
    with open('uver_stats.csv', mode='a', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(['日時', '曲名', '再生数'])
        
        for item in response['items']:
            title = item['snippet']['title']
            views = item['statistics']['viewCount']
            writer.writerow([today, title, views])
            
    print(f"{today} のデータを記録しました！")

if __name__ == "__main__":
    save_to_csv()