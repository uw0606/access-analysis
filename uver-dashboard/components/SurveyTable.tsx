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

/**
 * 日付を YYYY-MM-DD に変換
 */
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
      const { data: responses, error } = await supabase.from("survey_responses").select("*").order('created_at', { ascending: false });
      if (error) console.error("Fetch Error:", error);
      setTableData(responses || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, []);

  useEffect(() => { 
    fetchData(); 
  }, [fetchData]);

  useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setChartWidth(width - 48); 
      } else {
        setChartWidth(Math.min(width * 0.55, 700));
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    const timer = setTimeout(() => setIsReady(true), 300);
    return () => {
      window.removeEventListener('resize', updateSize);
      clearTimeout(timer);
    };
  }, [activeTab]);

  const registeredSet = useMemo(() => {
    return new Set(tableData.map(d => {
      const datePart = normalizeDate(d.created_at);
      return `${datePart}_${d.live_name}`;
    }));
  }, [tableData]);

  const registeredLiveOptions = useMemo(() => {
    const map = new Map();
    tableData.forEach(d => {
      const matchY = anaYear === "All" || String(d.event_year) === anaYear;
      const matchT = anaType === "All" || d.venue_type === anaType;
      if (matchY && matchT) {
        const datePart = normalizeDate(d.created_at || "Unknown");
        const key = `${datePart}_${d.live_name}`;
        if (!map.has(key)) map.set(key, { key, date: datePart, name: d.live_name });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [tableData, anaYear, anaType]);

  const processFile = async (file: File) => {
    if (!selectedLiveForImport || !selectedTypeForImport) {
      alert("会場タイプを先に選択してください");
      return;
    }

    const targetDate = normalizeDate(selectedLiveForImport.event_date);
    const liveName = selectedLiveForImport.title;
    const key = `${targetDate}_${liveName}`;
    
    if (registeredSet.has(key)) {
      const confirmOverwrite = window.confirm(`既にデータがあります。上書きしますか？`);
      if (!confirmOverwrite) return;
    }

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
          return {
            request_song: String(row[0] || "").trim(),
            visits:       String(row[1] || "").includes("回") ? String(row[1]).trim() : `${row[1]}回`,
            prefecture:   String(row[2] || "").trim(),
            age:          String(row[3] || "").includes("代") ? String(row[3]).trim() : `${row[3]}代`,
            gender:       String(row[4] || "").trim(),
            live_name:    liveName,
            venue_type:   selectedTypeForImport,
            event_year:   currentEventYear,
            created_at:   targetDate, // Pythonスクリプトに合わせ時刻なし形式で保存
          };
        }).filter(Boolean);

        // 重複削除
        await supabase.from("survey_responses").delete().eq("live_name", liveName).eq("created_at", targetDate);

        // 新規挿入
        const { error: insError } = await supabase.from("survey_responses").insert(formattedData);
        if (insError) throw insError;
        
        alert(`成功: ${formattedData.length}件登録しました`);
        await fetchData();
        setView('analytics');
      } catch (err: any) { 
        alert("インポート失敗: " + err.message); 
      } finally { 
        setUploading(false); 
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => { setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) processFile(files[0]);
  };

  const filteredData = useMemo(() => {
    return tableData.filter(d => {
      const datePart = normalizeDate(d.created_at);
      const currentKey = `${datePart}_${d.live_name}`;
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
      } else if (rawVal !== "" && rawVal !== "未回答") {
        counts[rawVal] = (counts[rawVal] || 0) + 1;
      }
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData, activeTab]);

  const ageGroupData = useMemo(() => {
    if (activeTab !== 'age') return [];
    const groups: { [key: string]: number } = { "10代": 0, "20代": 0, "30代": 0, "40代": 0, "50代": 0, "60代以上": 0 };
    filteredData.forEach(item => {
      const rawAge = String(item.age || "").trim();
      const numMatch = rawAge.match(/\d+/);
      if (numMatch) {
        const val = parseInt(numMatch[0]);
        if (val < 20) groups["10代"]++;
        else if (val < 30) groups["20代"]++;
        else if (val < 40) groups["30代"]++;
        else if (val < 50) groups["40代"]++;
        else if (val < 60) groups["50代"]++;
        else groups["60代以上"]++;
      }
    });
    return Object.entries(groups).map(([name, value]) => ({ name, value })).filter(item => item.value > 0);
  }, [filteredData, activeTab]);

  const totalValue = useMemo(() => (activeTab === 'age' ? ageGroupData : chartData).reduce((acc, curr) => acc + curr.value, 0), [chartData, ageGroupData, activeTab]);

  const getItemColor = (name: string, index: number) => {
    if (activeTab === 'gender' && GENDER_COLORS[name]) return GENDER_COLORS[name];
    return COLORS[index % COLORS.length];
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-zinc-900 border border-zinc-700 p-3 rounded-lg shadow-2xl">
          <p className="text-white font-black text-[11px] mb-1">{data.name}</p>
          <p className="text-red-500 font-mono text-[10px]">COUNT: {data.value}</p>
        </div>
      );
    }
    return null;
  };

  if (loading) return <div className="fixed inset-0 bg-black text-white flex items-center justify-center font-mono">LOADING...</div>;

  return (
    <main className="min-h-screen w-full bg-black text-white p-4 md:p-12 font-sans text-[10px]">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-none">LIVE <span className="text-red-600">Analytics</span></h1>
            <p className="text-zinc-600 font-mono mt-2 tracking-[0.2em] text-[7px]">SURVEY ANALYSIS SYSTEM V4.1</p>
          </div>
          <button onClick={() => setView(view === 'analytics' ? 'import' : 'analytics')} className="bg-white text-black px-8 py-3 rounded-full font-black uppercase text-[9px] hover:bg-red-600 hover:text-white transition-all">
            {view === 'analytics' ? '＋ データを登録する' : '← 分析に戻る'}
          </button>
        </header>

        {view === 'import' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-800 h-[500px] overflow-y-auto custom-scrollbar">
              <h2 className="text-zinc-500 font-black uppercase text-[10px] mb-4 border-l-2 border-red-600 pl-3">1. Select Live Event</h2>
              {liveEvents.map(ev => (
                <button key={ev.id} onClick={() => setSelectedLiveForImport(ev)} 
                  className={`w-full text-left p-4 rounded-xl border mb-2 transition-all ${selectedLiveForImport?.id === ev.id ? 'border-red-600 bg-red-600/10' : 'border-zinc-800 bg-zinc-900/30'}`}>
                  <div className="flex justify-between items-center text-[8px] font-mono text-zinc-500">
                    <span>{ev.event_date}</span>
                    {registeredSet.has(`${normalizeDate(ev.event_date)}_${ev.title}`) && <span className="text-red-500 font-black">Registered</span>}
                  </div>
                  <div className="font-bold text-[11px] mt-1">{ev.title}</div>
                </button>
              ))}
            </div>
            {selectedLiveForImport && (
              <div className="space-y-6">
                <div className="bg-zinc-900/50 p-8 rounded-[40px] border border-red-600/30 space-y-8">
                  <h3 className="text-2xl font-black italic text-red-600 leading-none">{selectedLiveForImport.title}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {VENUE_TYPES.map(type => (
                      <button key={type} onClick={() => setSelectedTypeForImport(type)} className={`py-3 rounded-xl font-black text-[9px] border ${selectedTypeForImport === type ? 'bg-white text-black' : 'bg-zinc-950 text-zinc-500'}`}>{type}</button>
                    ))}
                  </div>
                  {selectedTypeForImport && (
                    <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className="pt-12 pb-12 border-2 border-dashed border-zinc-700 rounded-3xl flex flex-col items-center justify-center gap-4">
                      <p className="text-white font-black uppercase text-[12px]">{uploading ? "UPLOADING..." : "Drop File"}</p>
                      <input type="file" className="hidden" id="f-up" onChange={(e) => e.target.files && processFile(e.target.files[0])} />
                      <label htmlFor="f-up" className="bg-white text-black px-6 py-2 rounded-full font-black uppercase text-[9px] cursor-pointer">SELECT</label>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 bg-zinc-950 p-6 rounded-3xl border border-zinc-800">
              <select value={anaYear} onChange={(e) => { setAnaYear(e.target.value); setAnaLiveKey("All"); }} className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl font-bold text-white"><option value="All">All Years</option><option value="2026">2026</option></select>
              <select value={anaType} onChange={(e) => { setAnaType(e.target.value); setAnaLiveKey("All"); }} className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl font-bold text-white"><option value="All">All Types</option>{VENUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
              <select value={anaLiveKey} onChange={(e) => setAnaLiveKey(e.target.value)} className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl font-bold text-white">
                <option value="All">All Registered Live</option>
                {registeredLiveOptions.map(opt => <option key={opt.key} value={opt.key}>{opt.date} | {opt.name}</option>)}
              </select>
            </div>

            <nav className="flex gap-2 mb-10 overflow-x-auto pb-4 no-scrollbar">
              {ANALYSIS_TARGETS.map((t) => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-6 py-2 rounded-full text-[9px] font-black uppercase border ${activeTab === t.id ? 'bg-red-600 border-red-600' : 'border-zinc-800 text-zinc-500'}`}>{t.label}</button>
              ))}
            </nav>

            {filteredData.length === 0 ? (
              <div className="h-64 flex items-center justify-center bg-zinc-950 rounded-[40px] border border-zinc-900 text-zinc-700 font-black uppercase">NO DATA</div>
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
                  <thead className="bg-zinc-900 text-zinc-500 uppercase text-[7px] border-b border-zinc-800">
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
                <div className="lg:col-span-2 bg-zinc-950 p-8 rounded-[40px] border border-zinc-800 flex justify-center items-center overflow-hidden">
                  {!isReady ? (
                    <div className="h-[400px] flex items-center justify-center font-mono text-zinc-800">LOADING CHART...</div>
                  ) : activeTab === 'gender' || activeTab === 'visits' || activeTab === 'age' ? (
                    <PieChart width={chartWidth} height={380}>
                      <Pie data={activeTab === 'age' ? ageGroupData : chartData} innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value" nameKey="name" stroke="none" isAnimationActive={false}>
                        {(activeTab === 'age' ? ageGroupData : chartData).map((entry, i) => <Cell key={`cell-${i}`} fill={getItemColor(entry.name, i)} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  ) : (
                    <BarChart width={chartWidth} height={400} data={chartData} layout={activeTab === 'prefecture' ? 'vertical' : 'horizontal'}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                      <XAxis dataKey="name" stroke="#52525b" fontSize={9} hide={activeTab === 'prefecture'} />
                      <YAxis stroke="#52525b" fontSize={9} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                    </BarChart>
                  )}
                </div>
                <div className="bg-zinc-900/30 p-8 rounded-[40px] border border-zinc-800 overflow-y-auto max-h-[500px]">
                  <h4 className="text-zinc-500 text-[9px] font-black uppercase mb-8 border-l-2 border-red-600 pl-4">Summary</h4>
                  <div className="space-y-4">
                    {(activeTab === 'age' ? ageGroupData : chartData).map((item, i) => (
                      <div key={i} className="flex justify-between items-center border-b border-zinc-800/50 pb-4">
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: getItemColor(item.name, i) }}></div><span className="text-zinc-300 font-bold">{item.name}</span></div>
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