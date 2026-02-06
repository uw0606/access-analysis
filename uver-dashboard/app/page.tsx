"use client";

// クライアントコンポーネントで動的レンダリングを強制する設定
export const dynamic = "force-dynamic";

import React, { useEffect, useState } from "react";
import { supabase } from "./supabase"; 
import { 
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

// チャートデータの型定義
type ChartPoint = {
  name: string;
  fullDate: string;
  totalGrowth: number;
  [key: string]: any; 
};

// イベントカテゴリに応じた色を返す関数
const getEventColor = (category: string) => {
  switch (category) {
    case 'LIVE': return '#dc2626';
    case 'RELEASE': return '#eab308';
    case 'TV': return '#10b981';
    case 'OTHER': return '#2563eb';
    default: return '#52525b';
  }
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "---";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "---";
  const jstDate = new Date(d.getTime() + (9 * 60 * 60 * 1000));
  const y = jstDate.getUTCFullYear();
  const m = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstDate.getUTCDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
};

const formatChartDate = (dateStr: string) => {
  const parts = dateStr.split('/');
  if (parts.length < 3) return dateStr;
  return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
};

const isNewRelease = (publishedAt: string) => {
  if (!publishedAt || publishedAt === "---") return false;
  const pubDate = new Date(publishedAt.replace(/\//g, '-'));
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - pubDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= 30;
};

export default function Home() {
  const [tableData, setTableData] = useState<any[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [events, setEvents] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"top5" | "total" | "single">("top5");
  const [selectedSong, setSelectedSong] = useState<string>("");
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: stats, error: statsError } = await supabase
        .from("youtube_stats")
        .select("*")
        .order('created_at', { ascending: true })
        .limit(4000); 

      const { data: eventData } = await supabase.from("calendar_events").select("*");
      setEvents(eventData || []);

      if (statsError) throw statsError;

      if (stats && stats.length > 0) {
        const dateSet = new Set<string>();
        stats.forEach(s => {
          const d = formatDate(s.created_at);
          if (d !== "---") dateSet.add(d);
        });
        const uniqueDates = Array.from(dateSet).sort();
        setDates(uniqueDates);

        const songsMap: { [key: string]: any } = {};
        
        stats.forEach(s => {
          const dateStr = formatDate(s.created_at);
          if (dateStr === "---") return;
          if (!songsMap[s.title]) {
            songsMap[s.title] = {
              artist: "UVERworld",
              title: s.title,
              videoId: s.video_id,
              publishedAt: s.published_at ? s.published_at.replace(/-/g, '/') : "---",
              history: {} 
            };
          }
          songsMap[s.title].history[dateStr] = Number(s.views);
        });

        const tempChartData: ChartPoint[] = uniqueDates.map(date => ({
          name: formatChartDate(date),
          fullDate: date,
          totalGrowth: 0
        }));

        const songsArray = Object.values(songsMap);

        uniqueDates.forEach((date, idx) => {
          const prevDate = uniqueDates[idx - 1];
          const chartIdx = tempChartData.findIndex(d => d.fullDate === date);

          songsArray.forEach((s: any) => {
            const currentViews = s.history[date] || 0;
            const prevViews = prevDate ? s.history[prevDate] : null;
            let inc = 0;
            if (prevViews !== null && currentViews > 0) {
              inc = currentViews - prevViews;
              if (inc < 0) inc = 0; 
            }
            s.history[`${date}_inc`] = inc;
            if (chartIdx !== -1) {
              tempChartData[chartIdx][s.title] = inc;
              tempChartData[chartIdx].totalGrowth += inc;
            }
          });

          const viewsList = [...songsArray].sort((a, b) => (b.history[date] || 0) - (a.history[date] || 0));
          viewsList.forEach((s, rIdx) => { s.history[`${date}_v_rank`] = rIdx + 1; });

          const growthList = [...songsArray].sort((a, b) => (b.history[`${date}_inc`] || 0) - (a.history[`${date}_inc`] || 0));
          growthList.forEach((s, rIdx) => {
            const currentGRank = rIdx + 1;
            const prevGRank = prevDate ? s.history[`${prevDate}_g_rank`] : null;
            s.history[`${date}_g_rank`] = currentGRank;
            if (!prevGRank) s.history[`${date}_diff`] = "new";
            else if (currentGRank < prevGRank) s.history[`${date}_diff`] = "up";
            else if (currentGRank > prevGRank) s.history[`${date}_diff`] = "down";
            else s.history[`${date}_diff`] = "keep";
          });
        });

        const lastDate = uniqueDates[uniqueDates.length - 1];
        const sortedResult = Object.values(songsMap).sort((a: any, b: any) => 
          (b.history[`${lastDate}_inc`] || 0) - (a.history[`${lastDate}_inc`] || 0)
        );
        
        setTableData(sortedResult);
        setChartData(tempChartData);
        if (sortedResult.length > 0) setSelectedSong(sortedResult[0].title);
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

  const RankIcon = ({ status }: { status: string }) => {
    if (status === "up") return <span className="text-red-500 mr-0.5 text-[7px]">▲</span>;
    if (status === "down") return <span className="text-blue-500 mr-0.5 text-[7px]">▼</span>;
    if (status === "keep") return <span className="text-zinc-600 mr-0.5 text-[7px]">-</span>;
    return <span className="text-zinc-400 mr-0.5 text-[6px]">new</span>;
  };

  if (loading) return <div className="bg-black text-white min-h-screen flex items-center justify-center font-mono animate-pulse tracking-widest text-xs uppercase">Connecting Data Matrix...</div>;

  return (
    <main className="min-h-screen bg-black text-white p-2 md:p-12 font-sans text-[10px] relative">
      {selectedEvent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedEvent(null)} />
          <div className="relative bg-zinc-900 border border-zinc-700 w-full max-w-sm rounded-3xl p-8 shadow-2xl">
            <button onClick={() => setSelectedEvent(null)} className="absolute top-4 right-4 text-zinc-500 hover:text-white text-xl font-bold">×</button>
            <div className={`inline-block px-3 py-1 rounded-full text-[8px] font-black mb-4 text-white`} style={{ backgroundColor: getEventColor(selectedEvent.category) }}>
              {selectedEvent.category}
            </div>
            <p className="text-zinc-500 font-mono text-[9px] mb-1">{selectedEvent.event_date}</p>
            <h2 className="text-xl font-black italic uppercase leading-tight mb-4 tracking-tighter">{selectedEvent.title}</h2>
            <div className="bg-black/50 p-4 rounded-xl border border-zinc-800">
              <p className="text-zinc-400 text-[11px] leading-relaxed whitespace-pre-wrap">{selectedEvent.description || "詳細情報はありません。"}</p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[100vw] mx-auto">
        <header className="mb-8 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter">Video <span className="text-red-600">Analytics</span></h1>
            <p className="text-zinc-500 text-[8px] md:text-[9px] mt-1 uppercase tracking-[0.3em]">Performance tracker & Event Correlation</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <a href="/calendar" className="text-[8px] md:text-[9px] bg-zinc-900 text-zinc-400 px-3 py-2 rounded-full hover:bg-zinc-800 transition-all font-bold uppercase tracking-widest border border-zinc-800">カレンダー</a>
            <a href="/sns" className="text-[8px] md:text-[9px] bg-zinc-900 text-zinc-400 px-3 py-2 rounded-full hover:bg-zinc-800 transition-all font-bold uppercase tracking-widest border border-zinc-800">SNS解析</a>
            <a href="/analysis" className="text-[8px] md:text-[9px] bg-white text-black px-4 py-2 rounded-full hover:bg-red-600 hover:text-white transition-all font-bold uppercase tracking-widest">解析 →</a>
          </div>
        </header>

        <div className="mb-8 bg-zinc-900/40 p-4 md:p-6 rounded-2xl border border-zinc-800 shadow-2xl relative">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div className="flex items-center gap-4">
              <h2 className="text-zinc-500 uppercase text-[9px] tracking-widest font-black border-l-2 border-red-600 pl-3">Growth Analytics</h2>
              <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                {(['top5', 'total', 'single'] as const).map((mode) => (
                  <button key={mode} onClick={() => setViewMode(mode)} className={`px-2 md:px-4 py-1.5 rounded-md text-[8px] font-black transition-all uppercase ${viewMode === mode ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    {mode}
                  </button>
                ))}
              </div>
            </div>
            {viewMode === "single" && (
              <select className="bg-zinc-950 text-zinc-300 border border-zinc-800 rounded-lg px-3 py-1.5 text-[9px] outline-none" value={selectedSong} onChange={(e) => setSelectedSong(e.target.value)}>
                {tableData.map(s => <option key={s.title} value={s.title}>{s.title}</option>)}
              </select>
            )}
          </div>

          <div className="h-[320px] md:h-[420px] w-full mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ bottom: 0, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                <XAxis dataKey="name" stroke="#52525b" fontSize={8} tickLine={false} axisLine={false} dy={5} />
                <YAxis stroke="#52525b" fontSize={8} tickLine={false} axisLine={false} tickFormatter={(val) => val.toLocaleString()} />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (!active || !payload) return null;
                    return (
                      <div className="bg-black/90 border border-zinc-800 p-2 rounded-lg text-[9px] shadow-2xl backdrop-blur-md">
                        <p className="text-zinc-500 mb-2 font-mono border-b border-zinc-800 pb-1">{label}</p>
                        {payload.filter(p => p.name !== "Events").map((p: any) => (
                          <div key={p.name} className="flex justify-between gap-4">
                            <span style={{ color: p.color }} className="font-bold">{p.name}</span>
                            <span className="font-mono text-zinc-300">+{p.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '8px' }} />
                {viewMode === "top5" && tableData.slice(0, 5).map((song, idx) => (
                  <Line key={song.title} type="monotone" dataKey={song.title} stroke={["#ef4444", "#f59e0b", "#3b82f6", "#10b981", "#a855f7"][idx]} strokeWidth={2} dot={false} />
                ))}
                {viewMode === "total" && <Line type="monotone" dataKey="totalGrowth" name="UVERworld Total" stroke="#ffffff" strokeWidth={3} dot={false} />}
                {viewMode === "single" && selectedSong && <Line type="monotone" dataKey={selectedSong} name={selectedSong} stroke="#ef4444" strokeWidth={3} dot={false} />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* テーブルセクション: スマホ極限最適化 */}
        <div className="overflow-x-auto bg-zinc-950 rounded-2xl border border-zinc-800 shadow-2xl">
          <table className="w-full text-left min-w-max border-separate border-spacing-0 text-[7px] md:text-[9px]">
            <thead>
              <tr className="bg-zinc-950 text-zinc-500 uppercase font-bold">
                {/* 固定列: アーティスト名 (スマホ幅 40px) */}
                <th className="p-2 sticky left-0 bg-zinc-950 z-40 border-b border-r border-zinc-800 w-[40px]">Artist</th>
                {/* 固定列: 曲名 (スマホ幅 85px) */}
                <th className="p-2 sticky left-[40px] bg-zinc-950 z-40 border-b border-r border-zinc-800 w-[85px] md:w-[200px]">Song</th>
                {/* 公開日: スマホでは非表示 */}
                <th className="p-2 border-b border-r border-zinc-800 text-center hidden md:table-cell">Released</th>
                {dates.map(date => (
                  <th key={date} colSpan={4} className="p-1.5 text-center border-b border-r border-zinc-800 bg-zinc-900/50 text-zinc-300 font-mono text-[7px] md:text-[9px]">
                    {date.split('/').slice(1).join('/')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((song) => {
                const isNew = isNewRelease(song.publishedAt);
                return (
                  <tr key={song.title} className={`border-b border-zinc-800/40 hover:bg-white/5 transition-colors group ${isNew ? 'bg-red-900/10' : ''}`}>
                    <td className="p-2 sticky left-0 bg-black z-30 border-r border-zinc-800 text-zinc-600 font-bold w-[40px] truncate text-[6px] md:text-[9px]">
                      {song.artist.slice(0,4)}
                    </td>
                    <td className="p-2 sticky left-[40px] bg-black z-30 border-r border-zinc-800 font-black text-white w-[85px] md:w-[200px]">
                      <a href={`https://www.youtube.com/watch?v=${song.videoId}`} target="_blank" rel="noopener noreferrer" 
                         className="flex items-center gap-1 truncate block">
                        <span className="truncate">{song.title}</span>
                        {isNew && <span className="text-[5px] bg-red-600 text-white px-0.5 rounded-full flex-shrink-0 animate-pulse">N</span>}
                      </a>
                    </td>
                    <td className="p-2 border-r border-zinc-800 text-zinc-600 font-mono text-center hidden md:table-cell italic">{song.publishedAt}</td>
                    {dates.map(date => (
                      <React.Fragment key={`${song.title}-${date}`}>
                        <td className="p-1.5 border-r border-zinc-800/10 text-right font-mono text-zinc-400">{(song.history[date] || 0).toLocaleString()}</td>
                        <td className="p-1.5 border-r border-zinc-800/10 text-right font-mono text-yellow-500 bg-yellow-500/5 font-black">
                          {song.history[`${date}_inc`] > 0 ? `+${song.history[`${date}_inc`].toLocaleString()}` : "-"}
                        </td>
                        <td className="p-1 border-r border-zinc-800/10 text-center font-mono text-zinc-600 text-[6px] hidden sm:table-cell">{song.history[`${date}_v_rank`] || "-"}</td>
                        <td className="p-1.5 border-r border-zinc-800 text-center font-black text-white">
                          <div className="flex items-center justify-center gap-0.5">
                            <RankIcon status={song.history[`${date}_diff`]} />
                            <span className="text-[7px] md:text-[9px]">{song.history[`${date}_g_rank`] || "-"}</span>
                          </div>
                        </td>
                      </React.Fragment>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}