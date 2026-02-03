import streamlit as st
import pandas as pd
from supabase import create_client
import os

# 1. ページ設定（スマホで見やすいよう、少し広めに設定）
st.set_page_config(page_title="UVERworld Dashboard", layout="wide")
st.title("🛸 UVERworld Data Dashboard")

# 2. Supabase接続設定
try:
    url = st.secrets["SUPABASE_URL"]
    key = st.secrets["SUPABASE_KEY"]
except:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")

if not url or not key:
    st.error("Supabaseの接続情報が見つかりません。Secretsの設定を確認してください。")
    st.stop()

supabase = create_client(url, key)

# 3. データの取得（1時間はキャッシュして高速化）
@st.cache_data(ttl=3600)
def load_data(table_name):
    try:
        res = supabase.table(table_name).select("*").execute()
        return pd.DataFrame(res.data)
    except Exception as e:
        st.error(f"テーブル '{table_name}' の読み込みに失敗しました。")
        return pd.DataFrame()

# 4. タブ切り替え（YouTubeとスケジュールに絞りました）
tab1, tab2 = st.tabs(["📺 YouTube Stats", "🗓 Schedule"])

with tab1:
    st.header("YouTube 再生数ランキング")
    # ※ Supabaseの実際のテーブル名が異なる場合はここを書き換えてください
    yt_data = load_data("youtube_stats") 
    
    if not yt_data.empty:
        # view_countを数値型に変換（エラー回避）
        yt_data['view_count'] = pd.to_numeric(yt_data['view_count'], errors='coerce')
        # 並び替え
        yt_display = yt_data.sort_values("view_count", ascending=False)
        
        # グラフ表示
        st.subheader("再生数チャート")
        st.bar_chart(data=yt_display.set_index("title")["view_count"])
        
        # テーブル表示
        st.subheader("詳細データ")
        st.dataframe(yt_display[['title', 'view_count', 'last_updated']])
    else:
        st.warning("YouTubeのデータがまだありません。")

with tab2:
    st.header("今後のスケジュール")
    # ※ Supabaseの実際のテーブル名が異なる場合はここを書き換えてください
    sched_data = load_data("uver_schedule")
    
    if not sched_data.empty:
        # テーブル形式で表示
        st.dataframe(sched_data, use_container_width=True)
    else:
        st.warning("スケジュールのデータがまだありません。")

---
# ℹ️ 運用メモ
# データが更新されない場合は、GitHub Actionsの成功を確認してください。
# また、URLをスマホのブラウザで開いた後「ホーム画面に追加」すると便利です。