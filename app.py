import streamlit as st
import pandas as pd
from supabase import create_client
import os

# 1. ページ設定
st.set_page_config(page_title="UVERworld Dashboard", layout="wide")
st.title("🛸 UVERworld Data Dashboard")

# 2. Supabase接続
try:
    url = st.secrets["SUPABASE_URL"]
    key = st.secrets["SUPABASE_KEY"]
except:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")

supabase = create_client(url, key)

# 3. データの取得
@st.cache_data(ttl=3600) # 1時間はキャッシュを保持
def load_data(table_name):
    res = supabase.table(table_name).select("*").execute()
    return pd.DataFrame(res.data)

# 4. タブ切り替え
tab1, tab2, tab3 = st.tabs(["📺 YouTube Stats", "🗓 Schedule", "📝 Survey Analysis"])

with tab1:
    st.header("YouTube 再生数ランキング")
    yt_data = load_data("youtube_stats") # テーブル名は作成したものに合わせてください
    if not yt_data.empty:
        # 再生数でソートして表示
        yt_data['view_count'] = yt_data['view_count'].astype(int)
        st.dataframe(yt_data.sort_values("view_count", ascending=False))
        # 簡単な棒グラフ
        st.bar_chart(data=yt_data.set_index("title")["view_count"])

with tab2:
    st.header("今後のスケジュール")
    sched_data = load_data("uver_schedule") # テーブル名に合わせてください
    if not sched_data.empty:
        st.table(sched_data)

with tab3:
    st.header("アンケート集計（近日公開）")
    st.info("ここにCSVから取り込んだデータのランキングを表示します。")