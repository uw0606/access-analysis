"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase"; 
import { 
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

const SNS_LINKS: { [key: string]: string } = {
  youtube: "https://www.youtube.com/@uverworldSMEJ",
  x: "https://x.com/UVERworld_dR2",
  instagram: "https://www.instagram.com/uverworld_official/",
  instagram_takuya: "https://www.instagram.com/takuya_world_official/",
  tiktok_takuya: "https://www.tiktok.com/@uver_takuya8" 
};

// 日付を YYYY/MM/DD に固定する関数
const formatDate = (dateStr: string) => {
  if (!dateStr) return "---";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "---";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
};

// グラフ表示用の M/D 形式
const formatChartDate = (dateStr: string) => {
  const parts = dateStr.split('/');
  if (parts.length < 3) return dateStr;
  return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
};

export default function SnsStats() {
  const [data, setData] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputValues, setInputValues] = useState<{ [key: string]: string }>({});
  const [saveStatus, setSaveStatus] = useState<{ [key: string]: string }>({});
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: stats, error } = await supabase
        .from("sns_stats")
        .select("*")
        .order('created_at', { ascending: true });

      const { data: eventData } = await supabase.from("calendar_events").select("*");
      setEvents(eventData || []);

      if (error) {
        console.error("Supabase Error:", error.message);
      } else if (stats) {
        const map = new Map();
        stats.forEach(item => {
          const dateKey = formatDate(item.created_at);
          const compositeKey = `${item.platform}_${dateKey}`;
          map.set(compositeKey, { ...item, fullDate: dateKey });
        });

        const latestDailyStats = Array.from(map.values());

        const processed = latestDailyStats.map((item) => {
          const platformHistory = latestDailyStats
            .filter(s => s.platform === item.platform)
            .sort((a, b) => a.fullDate.localeCompare(b.fullDate));
          
          const currentIndex = platformHistory.findIndex(s => s.id === item.id);
          const prev = currentIndex > 0 ? platformHistory[currentIndex - 1] : null;
          
          return {
            ...item,
            date: formatChartDate(item.fullDate),
            diff: prev ? item.follower_count - prev.follower_count : 0
          };
        });

        setData(processed);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleQuickSave = async (platform: string) => {
    const count = parseInt(inputValues[platform]);
    if (isNaN(count)) return alert("数値を入力してください");
    setSaveStatus({ ...saveStatus, [platform]: "SAVING..." });
    const { error } = await supabase.from("sns_stats").insert([{ platform, follower_count: count }]);
    if (error) {
      setSaveStatus({ ...saveStatus, [platform]: "ERR" });
    } else {
      setSaveStatus({ ...saveStatus, [platform]: "OK!" });
      setInputValues({ ...inputValues, [platform]: "" });
      await fetchData(); 
      setTimeout(() => setSaveStatus({ ...saveStatus, [platform]: "" }), 2000);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("このデータを削除してもよろしいですか？")) return;
    const { error } = await supabase.from("sns_stats").delete().eq("id", id);
    if (!error) await fetchData(); 
  };

  const renderSnsSection = (title: string, platform: string, color: string) => {
    const platformData = data
      .filter(d => d.platform === platform)
      .sort((a, b) => a.fullDate.localeCompare(b.fullDate));
      
    const latest = platformData[platformData.length - 1];

    return (
      <div className="mb-12 bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: color }}></div>
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-zinc-500 uppercase text-[10px] tracking-[0.3em] font-black">{title}</h2>
              <a href={SNS_LINKS[platform]} target="_blank" rel="noopener noreferrer" className="text-[8px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded border border-zinc-700 hover:bg-zinc-700 hover:text-white transition-all flex items-center gap-1 uppercase tracking-tighter">Link ↗</a>
            </div>
            <div className="text-3xl font-mono font-bold">
              {latest?.follower_count?.toLocaleString() ?? "---"} 
              <span className="text-[10px] text-zinc-500 ml-2 uppercase font-normal tracking-widest">Total</span>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
            <input type="number" placeholder="Manual Update" className="bg-transparent border-none text-[11px] font-mono focus:outline-none w-28 px-3 py-1 text-white" value={inputValues[platform] || ""} onChange={(e) => setInputValues({ ...inputValues, [platform]: e.target.value })} />
            <button onClick={() => handleQuickSave(platform)} className="bg-white text-black text-[9px] font-black px-4 py-2 rounded hover:bg-red-600 hover:text-white transition-all uppercase">{saveStatus[platform] || "Save"}</button>
          </div>
        </div>
        <div className="h-[400px] w-full mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={platformData} margin={{ bottom: 30, top: 10 }}>
              <CartesianGrid stroke="#18181b" vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} dy={5} />
              <YAxis yAxisId="left" stroke="#52525b" fontSize={9} tickLine={false} axisLine={false} domain={['auto', 'auto']} tickFormatter={(v) => v.toLocaleString()} />
              <YAxis yAxisId="right" orientation="right" hide={true} domain={[0, (max: number) => max * 4]} />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (!active || !payload) return null;
                  const item = platformData.find(d => d.date === label);
                  if (!item) return null;
                  const currentFullDate = item.fullDate;
                  const dayEvents = events.filter(e => formatDate(e.event_date) === currentFullDate);
                  return (
                    <div className="bg-black/90 border border-zinc-800 p-3 rounded-lg text-[10px] shadow-2xl backdrop-blur-md">
                      <p className="text-zinc-500 mb-2 font-mono border-b border-zinc-800 pb-1">{label}</p>
                      {payload.map((p: any) => (
                        p.name !== "Events" && (
                          <div key={p.name} className="flex justify-between gap-6 py-0.5">
                            <span style={{ color: p.color }} className="font-bold">{p.name}</span>
                            <span className="font-mono text-zinc-300">{p.value?.toLocaleString()}</span>
                          </div>
                        )
                      ))}
                      {dayEvents.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-red-900/50">
                          <p className="text-red-500 font-black italic uppercase text-[7px] mb-1">★ {dayEvents.length} EVENTS</p>
                          {dayEvents.map((ev, i) => (
                            <p key={i} className="text-white font-bold leading-tight mb-1">・{ev.title}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '10px', paddingBottom: '25px' }} />
              
              <Bar yAxisId="right" dataKey="diff" name="Daily Growth" fill={color} opacity={0.3} radius={[4, 4, 0, 0]} barSize={20} />
              <Line yAxisId="left" type="monotone" dataKey="follower_count" name="Total Followers" stroke={color} strokeWidth={3} dot={{ r: 4, fill: color, strokeWidth: 0 }} />

              {/* 【修正箇所】イベント用ドットの追加 */}
              <Line
                yAxisId="left"
                dataKey="follower_count"
                stroke="none"
                name="Events"
                isAnimationActive={false}
                dot={(props) => {
                  const { cx, payload } = props;
                  if (!cx) return <React.Fragment key={Math.random()} />;
                  const dayEvents = events.filter(e => formatChartDate(formatDate(e.event_date)) === payload.date);
                  const dotBaseY = 340; 
                  return (
                    <g key={`ev-group-${payload.date}-${title}`} style={{ overflow: 'visible' }}>
                      {dayEvents.map((ev, index) => {
                        const currentY = dotBaseY + (index * 13);
                        let evColor = '#ef4444';
                        if (ev.category === 'RELEASE') evColor = '#eab308';
                        if (ev.category === 'TV') evColor = '#10b981';
                        return (
                          <g key={`${ev.id}-${index}`} onClick={() => setSelectedEvent(ev)} className="cursor-pointer">
                            <circle cx={cx} cy={currentY} r={5} fill={evColor} opacity={0.2} className="animate-pulse" />
                            <circle cx={cx} cy={currentY} r={2.5} fill={evColor} />
                          </g>
                        );
                      })}
                    </g>
                  );
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {/* ...（以下、履歴テーブル部分は変更なし） */}
        <div className="rounded-lg border border-zinc-800 bg-black/40 overflow-hidden">
          <div className="max-h-[200px] overflow-y-auto">
            <table className="w-full text-[10px] font-mono border-separate border-spacing-0">
              <thead className="sticky top-0 z-10 bg-zinc-950">
                <tr className="text-zinc-500 uppercase">
                  <th className="p-3 text-left border-b border-zinc-800">Date</th>
                  <th className="p-3 text-right border-b border-zinc-800">Total</th>
                  <th className="p-3 text-right border-b border-zinc-800">Growth</th>
                  <th className="p-3 text-center border-b border-zinc-800">Action</th>
                </tr>
              </thead>
              <tbody>
                {platformData.slice().reverse().map((item) => (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-3 text-zinc-400 font-bold border-b border-zinc-800/30">{item.fullDate}</td>
                    <td className="p-3 text-right font-bold border-b border-zinc-800/30">{item.follower_count?.toLocaleString()}</td>
                    <td className={`p-3 text-right font-bold border-b border-zinc-800/30 ${item.diff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {item.diff > 0 ? `+${item.diff.toLocaleString()}` : item.diff?.toLocaleString()}
                    </td>
                    <td className="p-3 text-center border-b border-zinc-800/30">
                      <button onClick={() => handleDelete(item.id)} className="text-zinc-700 hover:text-red-500 transition-colors uppercase text-[8px] font-black">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <div className="bg-black text-white min-h-screen flex items-center justify-center font-mono animate-pulse tracking-widest text-xs uppercase">Connecting SNS Data Matrix...</div>;

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-12 relative">
      {/* イベント詳細モーダル */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedEvent(null)} />
          <div className="relative bg-zinc-900 border border-zinc-700 w-full max-w-sm rounded-3xl p-8 shadow-2xl text-[11px]">
            <button onClick={() => setSelectedEvent(null)} className="absolute top-4 right-4 text-zinc-500 hover:text-white text-xl font-bold">×</button>
            <div className={`inline-block px-3 py-1 rounded-full text-[8px] font-black mb-4 ${selectedEvent.category === 'LIVE' ? 'bg-red-600 text-white' : 'bg-zinc-700 text-zinc-300'}`}>
              {selectedEvent.category}
            </div>
            <p className="text-zinc-500 font-mono mb-1">{selectedEvent.event_date}</p>
            <h2 className="text-xl font-black italic uppercase leading-tight mb-4 tracking-tighter text-white">{selectedEvent.title}</h2>
            <div className="bg-black/50 p-4 rounded-xl border border-zinc-800 text-zinc-400 leading-relaxed whitespace-pre-wrap">
              {selectedEvent.description || "詳細情報はありません。"}
            </div>
          </div>
        </div>
      )}

      <header className="mb-12 max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 border-b border-zinc-800 pb-8">
        <div>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter">SNS <span className="text-red-600">Analytics</span></h1>
          <p className="text-zinc-500 text-[9px] mt-1 uppercase tracking-[0.3em]">Follower Growth & Social Impact</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <a href="/calendar" className="text-[10px] bg-zinc-900 text-zinc-400 px-6 py-2 rounded-full hover:bg-zinc-800 transition-all font-bold uppercase tracking-widest border border-zinc-800">カレンダー</a>
          <a href="/" className="text-[10px] bg-zinc-900 text-zinc-400 px-6 py-2 rounded-full hover:bg-zinc-800 transition-all font-bold uppercase tracking-widest border border-zinc-800">YouTube動画アクセス解析</a>
          <a href="/analysis" className="text-[10px] bg-white text-black px-6 py-2 rounded-full hover:bg-red-600 hover:text-white transition-all font-bold uppercase tracking-widest">ライブアンケート解析 →</a>
        </div>
      </header>
      
      <div className="max-w-5xl mx-auto grid grid-cols-1 gap-12">
        {renderSnsSection("YouTube Channel", "youtube", "#ef4444")}
        {renderSnsSection("X / Twitter", "x", "#ffffff")}
        {renderSnsSection("Instagram (Official)", "instagram", "#e1306c")}
        {renderSnsSection("Instagram (TAKUYA∞)", "instagram_takuya", "#EAB308")}
        {renderSnsSection("TikTok (TAKUYA∞)", "tiktok_takuya", "#00f2ea")}
      </div>
    </main>
  );
}