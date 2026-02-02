"use client";
import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

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
    const { data } = await supabase.from("calendar_events").select("*").order("event_date", { ascending: false });
    setEvents(data || []);
  };

  // カテゴリーに応じた色を返す関数
  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'LIVE': return 'bg-red-600 text-white';
      case 'RELEASE': return 'bg-yellow-500 text-black'; // 黄色は黒文字の方が見やすい
      case 'TV': return 'bg-emerald-500 text-white';
      case 'OTHER': return 'bg-blue-600 text-white';
      default: return 'bg-zinc-700 text-zinc-300';
    }
  };

  const handleSave = async () => {
    if (!date || !title) return alert("日付とタイトルを入力してください");
    
    if (editingId) {
      const { error } = await supabase.from("calendar_events").update({ event_date: date, title, category, description }).eq("id", editingId);
      if (!error) {
        setEditingId(null);
        alert("更新しました");
      }
    } else {
      const { error } = await supabase.from("calendar_events").insert([{ event_date: date, title, category, description }]);
      if (!error) alert("登録しました");
    }

    setTitle("");
    setDescription("");
    fetchEvents();
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
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-black italic uppercase tracking-tighter">Event <span className="text-red-600">Scheduler</span></h1>
          <Link href="/" className="text-[10px] text-zinc-500 hover:text-white border border-zinc-800 px-4 py-2 rounded-full transition-all uppercase font-bold">← Back to Chart</Link>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800 shadow-2xl sticky top-8">
              <h2 className="text-xs font-black uppercase text-zinc-500 mb-4">{editingId ? "Edit Event" : "New Event"}</h2>
              
              <div className="space-y-4">
                <input type="date" className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-sm outline-none focus:border-red-600 transition-colors" value={date} onChange={(e) => setDate(e.target.value)} />
                
                <div className="relative">
                  <select 
                    className={`w-full bg-black border border-zinc-800 p-3 rounded-xl text-sm outline-none focus:border-white transition-colors appearance-none font-bold ${getCategoryColor(category)}`}
                    value={category} 
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="LIVE" className="bg-black text-white">LIVE / TOUR</option>
                    <option value="RELEASE" className="bg-black text-white">NEW RELEASE</option>
                    <option value="TV" className="bg-black text-white">TV / MEDIA</option>
                    <option value="OTHER" className="bg-black text-white">OTHERS</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[8px]">▼</div>
                </div>

                <input type="text" placeholder="Event Title" className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-sm outline-none focus:border-red-600 transition-colors font-bold" value={title} onChange={(e) => setTitle(e.target.value)} />
                <textarea placeholder="Details..." className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-sm h-24 outline-none focus:border-red-600 transition-colors resize-none" value={description} onChange={(e) => setDescription(e.target.value)} />
                
                <div className="flex gap-2">
                  <button onClick={handleSave} className="flex-1 bg-white text-black font-black py-3 rounded-xl uppercase italic hover:bg-red-600 hover:text-white transition-all transform active:scale-95">
                    {editingId ? "Update" : "Save"}
                  </button>
                  {editingId && (
                    <button onClick={() => { setEditingId(null); setTitle(""); setDate(""); setDescription(""); }} className="bg-zinc-800 text-zinc-400 px-4 rounded-xl text-[10px] font-bold">CANCEL</button>
                  )}
                </div>
                {editingId && (
                  <button onClick={() => handleDelete(editingId)} className="w-full text-red-600 text-[10px] font-black mt-2 hover:underline">DELETE THIS EVENT</button>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-zinc-900/20 rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="text-zinc-500 hover:text-white transition-all px-2 font-bold">PREV</button>
                <h2 className="font-black italic uppercase tracking-widest text-sm text-red-600">
                  {currentMonth.getFullYear()} . {String(currentMonth.getMonth() + 1).padStart(2, '0')}
                </h2>
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="text-zinc-500 hover:text-white transition-all px-2 font-bold">NEXT</button>
              </div>
              
              <div className="grid grid-cols-7 text-center border-b border-zinc-800 bg-zinc-900/30">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="py-2 text-[8px] font-black text-zinc-600 uppercase tracking-widest">{d}</div>
                ))}
              </div>
              
              <div className="grid grid-cols-7">
                {renderCalendar()}
              </div>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}