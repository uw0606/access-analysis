"use client";
import React, { useState, useEffect } from "react";
import { supabase } from "../supabase"; 
import Link from "next/link";

export default function CalendarPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("LIVE");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => { fetchEvents(); }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .order("event_date", { ascending: false });
      
      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'LIVE': return 'bg-red-600 text-white';
      case 'RELEASE': return 'bg-yellow-500 text-black'; 
      case 'TV': return 'bg-emerald-500 text-white';
      case 'OTHER': return 'bg-blue-600 text-white';
      default: return 'bg-zinc-700 text-zinc-300';
    }
  };

  const handleSave = async () => {
    if (!date || !title) return alert("日付とタイトルを入力してください");
    
    try {
      if (editingId) {
        const { error } = await supabase
          .from("calendar_events")
          .update({ event_date: date, title, category, description })
          .eq("id", editingId);
        if (!error) {
          setEditingId(null);
          alert("更新しました");
        }
      } else {
        const { error } = await supabase
          .from("calendar_events")
          .insert([{ event_date: date, title, category, description }]);
        if (!error) alert("登録しました");
      }

      setTitle("");
      setDescription("");
      setDate("");
      fetchEvents();
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  const handleEdit = (event: any) => {
    setEditingId(event.id);
    setDate(event.event_date);
    setTitle(event.title);
    setCategory(event.category);
    setDescription(event.description || "");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このイベントを削除しますか？")) return;
    await supabase.from("calendar_events").delete().eq("id", id);
    fetchEvents();
  };

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 bg-zinc-900/10 border border-zinc-800/20"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayEvents = events.filter(e => e.event_date === dateStr);
      const isSelected = date === dateStr;

      days.push(
        <div 
          key={d} 
          onClick={() => setDate(dateStr)}
          className={`h-24 p-1 border border-zinc-800 transition-all cursor-pointer overflow-hidden ${isSelected ? 'bg-zinc-800/40 border-zinc-400' : 'bg-zinc-900/20 hover:bg-zinc-800/50'}`}
        >
          <span className={`text-[10px] font-mono ${isSelected ? 'text-white font-bold' : 'text-zinc-600'}`}>{d}</span>
          <div className="flex flex-col gap-1 mt-1">
            {dayEvents.map(e => (
              <div 
                key={e.id} 
                onClick={(ev) => { ev.stopPropagation(); handleEdit(e); }}
                className={`text-[7px] p-1 rounded-sm truncate font-black uppercase shadow-sm ${getCategoryColor(e.category)}`}
              >
                {e.title}
              </div>
            ))}
          </div>
        </div>
      );
    }
    return days;
  };

  return (
    <main className="min-h-screen bg-black text-white p-6 md:p-12 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-center mb-12 border-b border-zinc-800 pb-8 gap-6">
          <div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter">Event <span className="text-red-600">Scheduler</span></h1>
            <p className="text-zinc-500 text-[9px] mt-1 uppercase tracking-[0.3em]">Timeline & Promotion Management</p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/" className="text-[10px] bg-zinc-900 text-zinc-400 px-6 py-2 rounded-full hover:bg-zinc-800 transition-all font-bold uppercase tracking-widest border border-zinc-800">
              YouTube動画アクセス解析
            </Link>
            <Link href="/sns" className="text-[10px] bg-zinc-900 text-zinc-400 px-6 py-2 rounded-full hover:bg-zinc-800 transition-all font-bold uppercase tracking-widest border border-zinc-800">
              SNSアクセス解析
            </Link>
            <Link href="/analysis" className="text-[10px] bg-white text-black px-6 py-2 rounded-full hover:bg-red-600 hover:text-white transition-all font-bold uppercase tracking-widest">
              ライブアンケート解析 →
            </Link>
          </div>
        </header>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800 shadow-2xl sticky top-8">
              <h2 className="text-[9px] font-black uppercase text-zinc-500 mb-6 tracking-widest border-l-2 border-red-600 pl-3">
                {editingId ? "Edit Matrix Entry" : "Create New Matrix Entry"}
              </h2>
              
              <div className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="calendar-date" className="text-[8px] text-zinc-600 uppercase ml-2">Target Date</label>
                  <input 
                    id="calendar-date"
                    name="calendar-date"
                    type="date" 
                    className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-sm outline-none focus:border-red-600 transition-colors text-white" 
                    value={date} 
                    onChange={(e) => setDate(e.target.value)} 
                  />
                </div>
                
                <div className="space-y-1">
                  <label htmlFor="calendar-category" className="text-[8px] text-zinc-600 uppercase ml-2">Category</label>
                  <div className="relative">
                    <select 
                      id="calendar-category"
                      name="calendar-category"
                      className={`w-full bg-black border border-zinc-800 p-3 rounded-xl text-sm outline-none focus:border-white transition-colors appearance-none font-bold ${getCategoryColor(category)}`}
                      value={category} 
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="LIVE">LIVE / TOUR</option>
                      <option value="RELEASE">NEW RELEASE</option>
                      <option value="TV">TV / MEDIA</option>
                      <option value="OTHER">OTHERS</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[8px] opacity-50">▼</div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="calendar-title" className="text-[8px] text-zinc-600 uppercase ml-2">Event Title</label>
                  <input 
                    id="calendar-title"
                    name="calendar-title"
                    type="text" 
                    placeholder="e.g., ARENA TOUR 2026" 
                    className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-sm outline-none focus:border-red-600 transition-colors font-bold" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)} 
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="calendar-description" className="text-[8px] text-zinc-600 uppercase ml-2">Notes</label>
                  <textarea 
                    id="calendar-description"
                    name="calendar-description"
                    placeholder="Description..." 
                    className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-sm h-24 outline-none focus:border-red-600 transition-colors resize-none" 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                  />
                </div>
                
                <div className="flex gap-2 pt-4">
                  <button onClick={handleSave} className="flex-1 bg-white text-black font-black py-3 rounded-xl uppercase italic hover:bg-red-600 hover:text-white transition-all transform active:scale-95 shadow-lg">
                    {editingId ? "Update Entry" : "Save to Matrix"}
                  </button>
                  {editingId && (
                    <button onClick={() => { setEditingId(null); setTitle(""); setDate(""); setDescription(""); }} className="bg-zinc-800 text-zinc-400 px-4 rounded-xl text-[8px] font-black uppercase hover:bg-zinc-700">Cancel</button>
                  )}
                </div>
                {editingId && (
                  <button onClick={() => handleDelete(editingId)} className="w-full text-zinc-600 text-[8px] font-black mt-4 hover:text-red-500 transition-colors tracking-tighter uppercase">× Delete from Database</button>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-zinc-900/20 rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="text-zinc-500 hover:text-white transition-all px-4 font-black text-xs uppercase tracking-widest">Prev</button>
                <h2 className="font-black italic uppercase tracking-[0.2em] text-sm text-white">
                  {currentMonth.getFullYear()} <span className="text-red-600">/</span> {String(currentMonth.getMonth() + 1).padStart(2, '0')}
                </h2>
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="text-zinc-500 hover:text-white transition-all px-4 font-black text-xs uppercase tracking-widest">Next</button>
              </div>
              
              <div className="grid grid-cols-7 text-center border-b border-zinc-800 bg-zinc-900/30">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="py-3 text-[8px] font-black text-zinc-600 uppercase tracking-widest border-r border-zinc-800/50 last:border-r-0">{d}</div>
                ))}
              </div>
              
              <div className="grid grid-cols-7 bg-zinc-950/20">
                {renderCalendar()}
              </div>
            </div>

            <div className="mt-8 p-6 bg-zinc-900/20 rounded-2xl border border-zinc-800">
              <h3 className="text-[9px] font-black uppercase text-zinc-500 mb-4 tracking-widest">Legend</h3>
              <div className="flex flex-wrap gap-4">
                {[
                  { label: 'Live / Tour', color: 'bg-red-600' },
                  { label: 'New Release', color: 'bg-yellow-500' },
                  { label: 'TV / Media', color: 'bg-emerald-500' },
                  { label: 'Others', color: 'bg-blue-600' }
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${item.color}`}></div>
                    <span className="text-[8px] font-bold uppercase text-zinc-400">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}