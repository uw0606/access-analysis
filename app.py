import streamlit as st
import pandas as pd
from supabase import create_client
import os

# ページ設定
st.set_page_config(page_title="UVERworld Analysis", layout="wide")
st.title("📊 UVERworld ライブアンケート分析")

# Supabase接続設定
# ローカルでテストする際は st.secrets を使いますが、まずはコード内に直接書くか環境変数から読み込みます
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

# タブ作成
tab1, tab2 = st.tabs(["📊 集計グラフ", "📥 データ登録"])

with tab2:
    st.header("アンケートCSVアップロード")
    uploaded_file = st.file_uploader("CSVファイルを選択してください (20260202.csvなど)", type="csv")

    if uploaded_file:
        # データの読み込み
        df = pd.read_csv(uploaded_file)
        
        # 列名をSupabaseのテーブル定義に合わせる（もしCSVと名前が違う場合）
        # 例: CSVが「曲名, 項目2, 都道府県名...」となっている場合
        df.columns = ['song_name', 'count_text', 'prefecture', 'age', 'gender']
        
        st.subheader("取り込みデータのプレビュー")
        st.write(df.head()) # 最初の数行を表示

        # 【サブミットボタン】
        if st.button("この内容でSupabaseへ送信（サブミット）"):
            with st.spinner('データを送信中...'):
                try:
                    # データを辞書形式のリストに変換
                    data_dict = df.to_dict(orient='records')
                    
                    # Supabaseの「live_surveys」テーブルに挿入
                    response = supabase.table("live_surveys").insert(data_dict).execute()
                    
                    st.success(f"✅ 正常に送信されました！ ({len(data_dict)}件のデータ)")
                    st.balloons() # お祝いの風船を飛ばす
                except Exception as e:
                    st.error(f"エラーが発生しました: {e}")

with tab1:
    st.header("現在の集計状況")
    # ここに後でグラフを表示するコードを書きます
    st.info("データが送信されると、ここに自動でランキングなどが表示されるようになります。")