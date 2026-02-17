"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/app/supabase"; 
import * as XLSX from 'xlsx';
import { 
  PieChart, Pie, Cell, Tooltip, 
  BarChart, Bar, XAxis, YAxis, Legend, CartesianGrid 
} from 'recharts';

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', 
  '#06b6d4', '#f43f5e', '#84cc16', '#a855f7', '#64748b',
  '#fb7185', '#38bdf8', '#fbbf24', '#a78bfa', '#4ade80'
];

const GENDER_COLORS: { [key: string]: string } = {
  "女性": "#ef4444",
  "男性": "#3b82f6",
  "回答しない": "#52525b",
  "未回答": "#27272a"
};

const VENUE_TYPES = ["LIVE HOUSE", "HALL", "ARENA", "FES", "OTHER"];

const ANALYSIS_TARGETS = [
  { id: 'song', label: 'Songs', title: '聴きたい曲名', key: 'request_song' },
  { id: 'visits', label: 'Attendance', title: '来場予定回数', key: 'visits' },
  { id: 'prefecture', label: 'Region', title: '来場地域', key: 'prefecture' },
  { id: 'age', label: 'Age', title: '年齢', key: 'age' },
  { id: 'gender', label: 'Gender', title: '男女比', key: 'gender' },
  { id: 'list', label: 'Raw Data', title: '全回答リスト', key: '' },
];

const normalizeDate = (dateStr: string) => {
  if (!dateStr) return "";
  let pureDate = dateStr.split('T')[0];
  pureDate = pureDate.replace(/\//g, '-');
  const parts = pureDate.split('-');
  if (parts.length !== 3) return pureDate;
  const y = parts[0];
  const m = parts[1].padStart(2, '0');
  const d = parts[2].padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function SurveyTable() {
  const [view, setView] = useState<'analytics' | 'import'>('analytics');
  const [tableData, setTableData] = useState<any[]>([]);
  const [liveEvents, setLiveEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [anaYear, setAnaYear] = useState("All");
  const [anaType, setAnaType] = useState("All");
  const [anaLiveKey, setAnaLiveKey] = useState("All");
  const [selectedLiveForImport, setSelectedLiveForImport] = useState<any>(null);
  const [selectedTypeForImport, setSelectedTypeForImport] = useState("");
  const [activeTab, setActiveTab] = useState('song');
  
  const [isDragging, setIsDragging] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [chartWidth, setChartWidth] = useState(320);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: events } = await supabase.from("calendar_events").select("*").eq("category", "LIVE").order("event_date", { ascending: false });
      setLiveEvents(events || []);
      
      // 【修正点】取得上限を10000件に拡大
      const { data: responses, error } = await supabase
        .from("survey_responses")
        .select("*")
        .order('created_at', { ascending: false })
        .limit(10000); 

      if (error) console.error("Fetch Error:", error);
      setTableData(responses || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth;
      setChartWidth(width < 768 ? width - 48 : Math.min(width * 0.55, 700));
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    const timer = setTimeout(() => setIsReady(true), 300);
    return () => { window.removeEventListener('resize', updateSize); clearTimeout(timer); };
  }, [activeTab]);

  const generateKey = (date: string, name: string) => `${normalizeDate(date)}_${String(name || "").trim()}`;

  const registeredSet = useMemo(() => new Set(tableData.map(d => generateKey(d.created_at, d.live_name))), [tableData]);

  const registeredLiveOptions = useMemo(() => {
    const map = new Map();
    tableData.forEach(d => {
      const matchY = anaYear === "All" || String(d.event_year) === anaYear;
      const matchT = anaType === "All" || d.venue_type === anaType;
      if (matchY && matchT) {
        const key = generateKey(d.created_at, d.live_name);
        if (!map.has(key)) map.set(key, { key, date: normalizeDate(d.created_at), name: d.live_name });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [tableData, anaYear, anaType]);

  const processFile = async (file: File) => {
    if (!selectedLiveForImport || !selectedTypeForImport) {
      alert("公演と会場タイプを選択してください");
      return;
    }

    const targetDate = normalizeDate(selectedLiveForImport.event_date);
    const liveTitle = String(selectedLiveForImport.title || "").trim();
    const isAlreadyRegistered = registeredSet.has(generateKey(targetDate, liveTitle));
    
    if (isAlreadyRegistered && !window.confirm(`既にデータがあります。上書きしますか？`)) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) return;
        const workbook = XLSX.read(data, { type: 'binary', codepage: 932 });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
        
        if (!rows || rows.length < 2) throw new Error("データが空です");

        const currentEventYear = targetDate.split('-')[0];
        const formattedData = rows.slice(1).map((row) => {
          if (!row[0] && !row[1]) return null;
          const rawVisits = String(row[1] || "").trim();
          const visitsDisplay = rawVisits.includes("回") ? rawVisits : `${rawVisits}回`;
          const rawAge = String(row[3] || "").trim();
          const ageDisplay = rawAge.includes("代") ? rawAge : `${rawAge}代`;

          return {
            request_song: String(row[0] || "").trim(),
            visits:       visitsDisplay,
            prefecture:   String(row[2] || "").trim(),
            age:          ageDisplay,
            gender:       String(row[4] || "").trim(),
            live_name:    liveTitle,
            venue_type:   selectedTypeForImport,
            event_year:   currentEventYear,
            created_at:   new Date(`${targetDate}T09:00:00Z`).toISOString(), 
          };
        }).filter(Boolean);

        // 既存削除
        await supabase.from("survey_responses")
          .delete()
          .eq("live_name", liveTitle)
          .gte("created_at", `${targetDate}T00:00:00Z`)
          .lte("created_at", `${targetDate}T23:59:59Z`);

        // 【修正点】分割挿入（チャンク処理）: 500件ずつループで回す
        const chunkSize = 500;
        for (let i = 0; i < formattedData.length; i += chunkSize) {
          const chunk = formattedData.slice(i, i + chunkSize);
          const { error: insError } = await supabase.from("survey_responses").insert(chunk);
          if (insError) throw insError;
        }
        
        alert(`成功: ${formattedData.length}件登録しました`);
        await fetchData();
        setView('analytics');
      } catch (err: any) { 
        alert("インポート失敗: " + err.message); 
      } finally { setUploading(false); }
    };
    reader.readAsBinaryString(file);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => { setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
  };

  const filteredData = useMemo(() => {
    return tableData.filter(d => {
      const currentKey = generateKey(d.created_at, d.live_name);
      const matchY = anaYear === "All" || String(d.event_year) === anaYear;
      const matchT = anaType === "All" || d.venue_type === anaType;
      const matchL = anaLiveKey === "All" || currentKey === anaLiveKey;
      return matchY && matchT && matchL;
    });
  }, [tableData, anaYear, anaType, anaLiveKey]);

  const chartData = useMemo(() => {
    const target = ANALYSIS_TARGETS.find(t => t.id === activeTab);
    const key = target?.key;
    if (!key || filteredData.length === 0) return [];
    const counts: { [key: string]: number } = {};
    filteredData.forEach(item => {
      let rawVal = item[key] ? String(item[key]).trim() : "未回答";
      if (activeTab === 'song' && rawVal !== "未回答") {
        const splitSongs = rawVal.split(/[/,、&／＆・\n]+/);
        splitSongs.forEach(song => {
          let cleanSong = song.replace(/[（(].*?[）)]/g, '').replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, '').replace(/！/g, '!').trim();
          if (["ハイ、問題作!", "ハイ問題作", "ハイ!問題作"].includes(cleanSong)) cleanSong = "ハイ!問題作";
          if (cleanSong) counts[cleanSong] = (counts[cleanSong] || 0) + 1;
        });
      } else if (activeTab === 'visits' && rawVal !== "未回答") {
        const numMatch = rawVal.match(/\d+/);
        if (numMatch) {
          const formatted = `${numMatch[0]}回`;
          counts[formatted] = (counts[formatted] || 0) + 1;
        }
      } else if (rawVal !== "回" && rawVal !== "未回答" && rawVal !== "") {
        counts[rawVal] = (counts[rawVal] || 0) + 1;
      }
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
      .sort((a, b) => activeTab === 'visits' ? (parseInt(a.name) || 0) - (parseInt(b.name) || 0) : b.value - a.value);
  }, [filteredData, activeTab]);

  const ageGroupData = useMemo(() => {
    if (activeTab !== 'age') return [];
    const groupOrder = ["10代", "20代", "30代", "40代", "50代", "60代以上"];
    const groups: { [key: string]: number } = { "10代": 0, "20代": 0, "30代": 0, "40代": 0, "50代": 0, "60代以上": 0 };
    filteredData.forEach(item => {
      const rawAge = String(item.age || "").trim();
      const numMatch = rawAge.match(/\d+/);
      if (numMatch) {
        const val = parseInt(numMatch[0]);
        if (val >= 10 && val < 20) groups["10代"]++;
        else if (val >= 20 && val < 30) groups["20代"]++;
        else if (val >= 30 && val < 40) groups["30代"]++;
        else if (val >= 40 && val < 50) groups["40代"]++;
        else if (val >= 50 && val < 60) groups["50代"]++;
        else if (val >= 60 || val > 1900) groups["60代以上"]++;
      }
    });
    return groupOrder.map(name => ({ name, value: groups[name] })).filter(item => item.value > 0);
  }, [filteredData, activeTab]);

  const totalValue = useMemo(() => (activeTab === 'age' ? ageGroupData : chartData).reduce((acc, curr) => acc + curr.value, 0), [chartData, ageGroupData, activeTab]);

  const getItemColor = (name: string, index: number) => {
    if (activeTab === 'gender' && GENDER_COLORS[name]) return GENDER_COLORS[name];
    return activeTab === 'prefecture' ? '#ef4444' : COLORS[index % COLORS.length];
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.[0]) {
      const data = payload[0].payload;
      return (
        <div className="bg-zinc-900 border border-zinc-700 p-3 rounded-lg shadow-2xl">
          <p className="text-white font-black text-[11px] mb-1">{data.name}</p>
          <p className="text-red-500 font-mono text-[10px]">COUNT: {data.value}</p>
          <p className="text-zinc-400 font-mono text-[10px]">RATIO: {((data.value / totalValue) * 100).toFixed(1)}%</p>
        </div>
      );
    }
    return null;
  };

  const renderChartContent = () => {
    if (!isReady) return <div className="h-[400px] flex items-center justify-center font-mono text-zinc-800 uppercase tracking-widest">Connect...</div>;
    if (['gender', 'visits', 'age'].includes(activeTab)) {
      const data = activeTab === 'age' ? ageGroupData : chartData;
      return (
        <div className="flex justify-center items-center w-full min-h-[400px]">
          <PieChart width={chartWidth} height={380} key={`pie-${chartWidth}`}>
            <Pie data={data} innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value" nameKey="name" stroke="none" isAnimationActive={false}>
              {data.map((entry, i) => <Cell key={`cell-${i}`} fill={getItemColor(entry.name, i)} />)}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '9px', paddingTop: '20px' }} />
          </PieChart>
        </div>
      );
    } else {
      const dynamicHeight = activeTab === 'prefecture' ? Math.max(chartData.length * 35, 500) : 400;
      return (
        <div className="flex justify-center w-full" style={{ minHeight: dynamicHeight }}>
          <BarChart key={`bar-${activeTab}-${chartWidth}`} width={chartWidth} height={dynamicHeight} data={chartData} layout={activeTab === 'prefecture' ? 'vertical' : 'horizontal'} margin={{ left: 5, right: 30, top: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
            {activeTab === 'prefecture' ? (
              <>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="#a1a1aa" fontSize={10} width={80} interval={0} tick={{ fill: '#a1a1aa' }} />
              </>
            ) : (
              <>
                <XAxis dataKey="name" stroke="#52525b" fontSize={9} interval={0} />
                <YAxis stroke="#52525b" fontSize={9} />
              </>
            )}
            <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={activeTab === 'prefecture' ? 20 : 15} isAnimationActive={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
          </BarChart>
        </div>
      );
    }
  };

  if (loading) return <div className="fixed inset-0 bg-black text-white flex items-center justify-center font-mono text-xs">LOADING SYSTEM...</div>;

  return (
    <main className="min-h-screen w-full bg-black text-white p-4 md:p-12 font-sans text-[10px]">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-none">LIVE <span className="text-red-600">Analytics</span></h1>
            <p className="text-zinc-600 font-mono mt-2 tracking-[0.2em] text-[7px]">SURVEY ANALYSIS SYSTEM V3.6 (Quota Optimized)</p>
          </div>
          <div className="flex gap-2">
            <a href="https://uw0606.github.io/setlist/" target="_blank" rel="noopener noreferrer" className="bg-zinc-900 text-white border border-zinc-700 px-6 py-3 rounded-full font-black uppercase text-[9px] hover:bg-zinc-800 transition-all flex items-center">セットリスト制作</a>
            <button onClick={() => setView(view === 'analytics' ? 'import' : 'analytics')} className="bg-white text-black px-8 py-3 rounded-full font-black uppercase text-[9px] hover:bg-red-600 hover:text-white transition-all">
              {view === 'analytics' ? '＋ データを登録する' : '← 分析に戻る'}
            </button>
          </div>
        </header>

        <div className="flex flex-wrap gap-2 mb-10 overflow-x-auto pb-4 border-t border-zinc-900 pt-6">
          <a href="/calendar" className="px-5 py-2 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-full text-[9px] font-bold hover:bg-zinc-800 hover:text-white transition-all whitespace-nowrap uppercase tracking-widest">カレンダー</a>
          <a href="/" className="px-5 py-2 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-full text-[9px] font-bold hover:bg-zinc-800 hover:text-white transition-all whitespace-nowrap uppercase tracking-widest">YouTube動画解析</a>
          <a href="/sns" className="px-5 py-2 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-full text-[9px] font-bold hover:bg-zinc-800 hover:text-white transition-all whitespace-nowrap uppercase tracking-widest">SNS解析</a>
        </div>

        {view === 'import' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-800">
              <h2 className="text-zinc-500 font-black uppercase text-[10px] mb-4 border-l-2 border-red-600 pl-3">1. Select Live Event</h2>
              <div className="space-y-2 h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {liveEvents.map(ev => {
                  const isRegistered = registeredSet.has(generateKey(ev.event_date, ev.title));
                  return (
                    <button key={ev.id} onClick={() => setSelectedLiveForImport(ev)} 
                      className={`w-full text-left p-4 rounded-xl border transition-all ${selectedLiveForImport?.id === ev.id ? 'border-red-600 bg-red-600/10' : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-500'}`}>
                      <div className="flex justify-between items-center text-[8px] font-mono text-zinc-500">
                        <span>{ev.event_date}</span>
                        {isRegistered && <span className="text-red-500 uppercase font-black">Registered</span>}
                      </div>
                      <div className="font-bold text-[11px] mt-1">{ev.title}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-6">
              {selectedLiveForImport && (
                <div className="bg-zinc-900/50 p-8 rounded-[40px] border border-red-600/30 space-y-8">
                  <h3 className="text-2xl font-black italic text-red-600 leading-none">{selectedLiveForImport.title}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {VENUE_TYPES.map(type => (
                      <button key={type} onClick={() => setSelectedTypeForImport(type)} className={`py-3 rounded-xl font-black text-[9px] uppercase border transition-all ${selectedTypeForImport === type ? 'bg-white text-black border-white' : 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:border-zinc-400'}`}>{type}</button>
                    ))}
                  </div>
                  {selectedTypeForImport && (
                    <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className={`relative pt-12 pb-12 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-4 transition-all duration-300 ${isDragging ? 'border-red-500 bg-red-500/10 scale-[1.02]' : 'border-zinc-700 bg-zinc-950/50 hover:border-zinc-500'}`}>
                      <p className="text-white font-black uppercase text-[12px]">{uploading ? "UPLOADING..." : isDragging ? "DROP NOW" : "Drop File or Browse"}</p>
                      <input type="file" className="hidden" id="file-upload" accept=".csv,.xlsx" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
                      <label htmlFor="file-upload" className="bg-white text-black px-6 py-2 rounded-full font-black uppercase text-[9px] cursor-pointer hover:bg-red-600 hover:text-white transition-all">SELECT</label>
                      <p className="text-zinc-600 text-[8px] font-mono mt-2 uppercase tracking-widest">Supports .csv, .xlsx</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 bg-zinc-950 p-6 rounded-3xl border border-zinc-800">
              <div className="flex flex-col gap-2"><span className="text-zinc-600 font-black text-[8px] uppercase">1. Year</span>
                <select value={anaYear} onChange={(e) => { setAnaYear(e.target.value); setAnaLiveKey("All"); }} className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl font-bold font-mono text-white outline-none">
                  <option value="All">All Years</option>
                  {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2"><span className="text-zinc-600 font-black text-[8px] uppercase">2. Venue Type</span>
                <select value={anaType} onChange={(e) => { setAnaType(e.target.value); setAnaLiveKey("All"); }} className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl font-bold font-mono text-white outline-none">
                  <option value="All">All Types</option>{VENUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2"><span className="text-zinc-600 font-black text-[8px] uppercase">3. Registered Live</span>
                <select value={anaLiveKey} onChange={(e) => setAnaLiveKey(e.target.value)} className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl font-bold font-mono text-white outline-none">
                  <option value="All">All Matches</option>
                  {registeredLiveOptions.map(opt => <option key={opt.key} value={opt.key}>{opt.date} | {opt.name}</option>)}
                </select>
              </div>
            </div>

            <nav className="flex gap-2 mb-10 overflow-x-auto pb-4 no-scrollbar">
              {ANALYSIS_TARGETS.map((target) => (
                <button key={target.id} onClick={() => setActiveTab(target.id)} className={`px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${activeTab === target.id ? 'bg-red-600 border-red-600 text-white' : 'border-zinc-800 text-zinc-500 hover:border-zinc-400'}`}>{target.label}</button>
              ))}
            </nav>

            {filteredData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center bg-zinc-950 rounded-[40px] border border-zinc-900 text-zinc-700 font-black tracking-widest uppercase">NO DATA</div>
            ) : activeTab === 'song' ? (
              <div className="bg-zinc-950 p-8 rounded-[40px] border border-zinc-800">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-4">
                  {chartData.map((item, i) => (
                    <div key={i} className="flex justify-between items-center border-b border-zinc-900 pb-2">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span className="text-[9px] font-mono text-zinc-600 w-6">{(i+1).toString().padStart(2, '0')}</span>
                        <span className="text-white font-bold truncate">{item.name}</span>
                      </div>
                      <span className="text-red-600 font-mono text-lg font-black">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : activeTab === 'list' ? (
              <div className="overflow-x-auto bg-zinc-950 rounded-3xl border border-zinc-800">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead className="bg-zinc-900 text-zinc-500 uppercase text-[7px] font-bold tracking-widest border-b border-zinc-800">
                    <tr><th className="p-4">Date</th><th className="p-4">Live</th><th className="p-4">Song</th><th className="p-4">Visits</th><th className="p-4">Region</th><th className="p-4">Age</th><th className="p-4">Gender</th></tr>
                  </thead>
                  <tbody className="text-[9px]">
                    {filteredData.map((row, idx) => (
                      <tr key={idx} className="border-b border-zinc-900">
                        <td className="p-4 text-zinc-600 font-mono">{normalizeDate(row.created_at)}</td>
                        <td className="p-4 text-zinc-500">{row.live_name}</td>
                        <td className="p-4 text-white font-bold">{row.request_song}</td>
                        <td className="p-4 text-zinc-400">{row.visits}</td>
                        <td className="p-4 text-zinc-400">{row.prefecture}</td>
                        <td className="p-4 text-zinc-400">{row.age}</td>
                        <td className="p-4 text-zinc-400">{row.gender}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-zinc-950 p-4 md:p-8 rounded-[40px] border border-zinc-800 overflow-hidden flex justify-center items-center">
                   {renderChartContent()}
                </div>
                <div className={`bg-zinc-900/30 p-8 rounded-[40px] border border-zinc-800 overflow-y-auto ${activeTab === 'prefecture' ? 'h-auto max-h-[1000px]' : 'max-h-[450px]'}`}>
                  <h4 className="text-zinc-500 text-[9px] font-black uppercase mb-8 border-l-2 border-red-600 pl-4">Summary</h4>
                  <div className="space-y-4">
                    {(activeTab === 'age' ? ageGroupData : chartData).map((item, i) => (
                      <div key={i} className="flex justify-between items-center border-b border-zinc-800/50 pb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getItemColor(item.name, i) }}></div>
                          <span className="text-zinc-300 font-bold">{item.name}</span>
                        </div>
                        <div className="text-red-500 font-mono text-xl font-black">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}