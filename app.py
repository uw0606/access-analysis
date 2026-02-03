import streamlit as st
import pandas as pd
from supabase import create_client
import os

# 1. ページ設定
st.set_page_config(page_title="UVERworld Analysis", layout="wide")
st.title("🛸 UVERworld Data Dashboard")

# 2. Supabase接続
try:
    url = st.secrets["SUPABASE_URL"]
    key = st.secrets["SUPABASE_KEY"]
except:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")

if not url or not key:
    st.error("Supabaseの接続情報が設定されていません。")
    st.stop()

supabase = create_client(url, key)

# 3. データの取得関数
@st.cache_data(ttl=600)
def load_data(table_name):
    try:
        res = supabase.table(table_name).select("*").execute()
        return pd.DataFrame(res.data)
    except Exception as e:
        st.error(f"データ取得エラー ({table_name}): {e}")
        return pd.DataFrame()

# 4. タブ切り替え（3つに増やしました）
tab1, tab2, tab3 = st.tabs(["📺 MV Ranking", "🗓 Schedule", "📱 SNS Followers"])

# --- タブ1: YouTube MVランキング ---
with tab1:
    st.header("YouTube MV再生数ランキング")
    yt_df = load_data("youtube_stats")
    
    if not yt_df.empty:
        # 重複を除去して最新の再生数を取得
        yt_latest = yt_df.sort_values('created_at', ascending=False).drop_duplicates('video_id')
        yt_latest = yt_latest.sort_values('views', ascending=False)
        
        st.subheader("Top 10 Views")
        st.bar_chart(data=yt_latest.head(10).set_index('title')['views'])
        
        st.subheader("全MV統計一覧")
        st.dataframe(
            yt_latest[['title', 'views', 'published_at']].rename(
                columns={'title': '曲名', 'views': '再生数', 'published_at': '公開日'}
            ),
            use_container_width=True
        )
    else:
        st.info("YouTubeのデータがまだありません。")

# --- タブ2: スケジュール ---
with tab2:
    st.header("公式スケジュール")
    sched_df = load_data("calendar_events") # テーブル名を修正
    
    if not sched_df.empty:
        # 日付順に並び替え（今日以降のものを優先表示）
        sched_df['event_date'] = pd.to_datetime(sched_df['event_date'])
        sched_display = sched_df.sort_values('event_date', ascending=True)
        
        # 見やすく整形
        st.dataframe(
            sched_display[['event_date', 'category', 'title']].rename(
                columns={'event_date': '日付', 'category': '種類', 'title': '内容'}
            ),
            use_container_width=True
        )
    else:
        st.info("スケジュールのデータがまだありません。")

# --- タブ3: SNSフォロワー数 ---
with tab3:
    st.header("SNSフォロワー統計")
    sns_df = load_data("sns_stats")
    
    if not sns_df.empty:
        sns_latest = sns_df.sort_values('created_at', ascending=False).drop_duplicates('platform')
        
        cols = st.columns(len(sns_latest))
        for i, row in enumerate(sns_latest.itertuples()):
            with cols[i]:
                st.metric(label=row.platform.upper(), value=f"{row.follower_count:,}")
        
        st.subheader("プラットフォーム別フォロワー数")
        st.bar_chart(sns_latest.set_index('platform')['follower_count'])
    else:
        st.info("SNSのデータがまだありません。")