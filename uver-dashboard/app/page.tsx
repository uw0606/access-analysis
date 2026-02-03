"use client";
import React, { useEffect, useState } from "react";
// ↓ 修正: 共通設定ファイルをインポート
import { supabase } from "./supabase"; 
import { 
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

// ↓ 修正: 不要な直接定義を削除 (supabase.tsで一括管理するため)

const formatDate = (dateStr: string) => {
  if (!dateStr) return "---";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "---";
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const formatChartDate = (dateStr: string) => {
  const d = new Date(dateStr.replace(/\//g, '-'));
  return `${d.getMonth() + 1}/${d.getDate()}`;
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
  const [chartData, setChartData] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"top5" | "total" | "single">("top5");
  const [selectedSong, setSelectedSong] = useState<string>("");
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Supabase接続確認
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
            console.warn("Waiting for Environment Variables...");
        }

        const { data: stats } = await supabase
          .from("youtube_stats")
          .select("*")
          .order('created_at', { ascending: true });

        const { data: eventData } = await supabase.from("calendar_events").select("*");
        setEvents(eventData || []);

        if (stats && stats.length > 0) {
          const uniqueDates = Array.from(new Set(stats.map(s => formatDate(s.created_at)))).filter(d => d !== "---");
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
                publishedAt: s.published_at ? s.published_at.split('T')[0].replace(/-/g, '/') : "---",
                history: {} 
              };
            }
            songsMap[s.title].history[dateStr] = Number(s.views);
          });

          const tempChartData: any[] = uniqueDates.map(date => ({
            name: formatChartDate(date),
            fullDate: date,
            totalGrowth: 0
          }));

          uniqueDates.forEach((date, idx) => {
            const songsArray = Object.values(songsMap);
            const prevDate = uniqueDates[idx - 1];
            const chartIdx = tempChartData.findIndex(d => d.fullDate === date);

            songsArray.forEach((s: any) => {
              const currentViews = s.history[date] || 0;
              const prevViews = prevDate ? s.history[prevDate] : null;
              const inc = prevViews !== null ? currentViews - prevViews : 0;
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
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
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
    <main className="min-h-screen bg-black text-white p-4 md:p-12 font-sans text-[10px] relative">
      
      {selectedEvent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedEvent(null)} />
          <div className="relative bg-zinc-900 border border-zinc-700 w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <button onClick={() => setSelectedEvent(null)} className="absolute top-4 right-4 text-zinc-500 hover:text-white text-xl font-bold">×</button>
            <div className={`inline-block px-3 py-1 rounded-full text-[8px] font-black mb-4 ${selectedEvent.category === 'LIVE' ? 'bg-red-600 text-white' : 'bg-zinc-700 text-zinc-300'}`}>
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
        <header className="mb-12 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 border-b border-zinc-800 pb-8">
          <div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter">Video <span className="text-red-600">Analytics</span></h1>
            <p className="text-zinc-500 text-[9px] mt-1 uppercase tracking-[0.3em]">Performance tracker & Event Correlation</p>
          </div>
          <div className="flex gap-3">
            <a href="/calendar" className="text-[9px] bg-zinc-900 text-zinc-400 px-5 py-2 rounded-full hover:bg-zinc-800 transition-all font-bold uppercase tracking-widest border border-zinc-800">📅 Calendar</a>
            <a href="/sns" className="text-[9px] bg-white text-black px-5 py-2 rounded-full hover:bg-red-600 hover:text-white transition-all font-bold uppercase tracking-widest">SNS Stats →</a>
          </div>
        </header>

        <div className="mb-12 bg-zinc-900/40 p-6 rounded-2xl border border-zinc-800 shadow-2xl relative">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div className="flex items-center gap-4">
              <h2 className="text-zinc-500 uppercase text-[9px] tracking-widest font-black border-l-2 border-red-600 pl-3">Growth Analytics</h2>
              <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                {(['top5', 'total', 'single'] as const).map((mode) => (
                  <button key={mode} onClick={() => setViewMode(mode)} className={`px-4 py-1.5 rounded-md text-[8px] font-black transition-all uppercase ${viewMode === mode ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>
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

          <div className="h-[420px] w-full mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ bottom: 0, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                <XAxis dataKey="name" stroke="#52525b" fontSize={9} tickLine={false} axisLine={false} dy={5} height={100} />
                <YAxis stroke="#52525b" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(val) => val.toLocaleString()} />
                
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (!active || !payload) return null;
                    const dayEvents = events.filter(e => {
                      const d = new Date(e.event_date);
                      return `${d.getMonth() + 1}/${d.getDate()}` === label;
                    });
                    return (
                      <div className="bg-black/90 border border-zinc-800 p-3 rounded-lg text-[10px] shadow-2xl backdrop-blur-md">
                        <p className="text-zinc-500 mb-2 font-mono border-b border-zinc-800 pb-1">{label}</p>
                        {payload.filter(p => p.name !== "Events").map((p: any) => (
                          <div key={p.name} className="flex justify-between gap-6 py-0.5">
                            <span style={{ color: p.color }} className="font-bold">{p.name}</span>
                            <span className="font-mono text-zinc-300">+{p.value.toLocaleString()}</span>
                          </div>
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
                
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '9px', paddingBottom: '25px' }} />
                
                <Line
                  dataKey="totalGrowth" 
                  stroke="none"
                  name="Events"
                  isAnimationActive={false}
                  dot={(props) => {
                    const { cx, payload } = props;
                    if (!cx) return <React.Fragment key={Math.random()} />;
                    
                    const dayEvents = events.filter(e => {
                      const d = new Date(e.event_date);
                      return `${d.getMonth() + 1}/${d.getDate()}` === payload.name;
                    });
                    
                    const dotBaseY = 360; 
                    return (
                      <g key={`ev-group-${payload.name}`} style={{ overflow: 'visible' }}>
                        {dayEvents.map((ev, index) => {
                          const currentY = dotBaseY + (index * 13);
                          
                          let evColor = '#52525b';
                          if (ev.category === 'LIVE') evColor = '#ef4444';
                          if (ev.category === 'RELEASE') evColor = '#eab308';
                          if (ev.category === 'TV') evColor = '#10b981';
                          if (ev.category === 'OTHER') evColor = '#3b82f6';

                          return (
                            <g key={`${ev.id}-${index}`} onClick={() => setSelectedEvent(ev)} className="cursor-pointer">
                              <circle cx={cx} cy={currentY} r={5} fill={evColor} opacity={0.3} className="animate-ping" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
                              <circle cx={cx} cy={currentY} r={2.5} fill={evColor} />
                            </g>
                          );
                        })}
                      </g>
                    );
                  }}
                />

                {viewMode === "top5" && tableData.slice(0, 5).map((song, idx) => (
                  <Line key={song.title} type="monotone" dataKey={song.title} stroke={["#ef4444", "#f59e0b", "#3b82f6", "#10b981", "#a855f7"][idx]} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                ))}
                {viewMode === "total" && <Line type="monotone" dataKey="totalGrowth" name="UVERworld Total" stroke="#ffffff" strokeWidth={3} dot={{ r: 4 }} />}
                {viewMode === "single" && selectedSong && <Line type="monotone" dataKey={selectedSong} name={selectedSong} stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="overflow-x-auto bg-zinc-950 rounded-2xl border border-zinc-800 shadow-2xl">
          <table className="w-full text-left min-w-max border-separate border-spacing-0 text-[9px]">
            <thead>
              <tr className="bg-zinc-950 text-zinc-500 uppercase tracking-widest font-bold">
                <th className="p-4 sticky left-0 bg-zinc-950 z-30 border-b border-r border-zinc-800 text-[10px]">Artist</th>
                <th className="p-4 sticky left-[80px] bg-zinc-950 z-30 border-b border-r border-zinc-800 text-[10px]">Song Title</th>
                <th className="p-4 border-b border-r border-zinc-800 text-center">Released</th>
                {dates.map(date => (
                  <th key={date} colSpan={4} className="p-3 text-center border-b border-r border-zinc-800 bg-zinc-900/50 text-zinc-300 font-mono">{date}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((song) => {
                const isNew = isNewRelease(song.publishedAt);
                return (
                  <tr key={song.title} className={`border-b border-zinc-800/40 hover:bg-white/5 transition-colors group ${isNew ? 'bg-red-900/10' : ''}`}>
                    <td className="p-3 sticky left-0 bg-black z-10 border-r border-zinc-800 text-zinc-600 font-bold">{song.artist}</td>
                    <td className="p-3 sticky left-[80px] bg-black z-10 border-r border-zinc-800 font-black text-white">
                      <a href={`https://www.youtube.com/watch?v=${song.videoId}`} target="_blank" rel="noopener noreferrer" className="hover:text-red-500 transition-all flex items-center gap-2 underline underline-offset-4 decoration-zinc-800">
                        {song.title}
                        {isNew && <span className="text-[7px] bg-red-600 text-white px-1.5 py-0.5 rounded-full animate-pulse">NEW</span>}
                      </a>
                    </td>
                    <td className="p-3 border-r border-zinc-800 text-zinc-600 font-mono text-center text-[8px] italic">{song.publishedAt}</td>
                    {dates.map(date => (
                      <React.Fragment key={`${song.title}-${date}`}>
                        <td className="p-3 border-r border-zinc-800/10 text-right font-mono text-zinc-400">{(song.history[date] || 0).toLocaleString()}</td>
                        <td className="p-3 border-r border-zinc-800/10 text-right font-mono text-yellow-500 bg-yellow-500/5 font-black">
                          {song.history[`${date}_inc`] > 0 ? `+${song.history[`${date}_inc`].toLocaleString()}` : "-"}
                        </td>
                        <td className="p-3 border-r border-zinc-800/10 text-center font-mono text-zinc-600 text-[8px]">{song.history[`${date}_v_rank`] || "-"}</td>
                        <td className="p-3 border-r border-zinc-800 text-center font-black text-white">
                          <div className="flex items-center justify-center gap-1">
                            <RankIcon status={song.history[`${date}_diff`]} />
                            <span className="text-[9px]">{song.history[`${date}_g_rank`] || "-"}</span>
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