"use client";
import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

const PLATFORMS = [
  { id: "x", name: "X (Twitter)", color: "border-white" },
  { id: "instagram", name: "Instagram", color: "border-[#e1306c]" },
  { id: "tiktok", name: "TikTok", color: "border-[#00f2ea]" },
];

export default function AdminPage() {
  const [counts, setCounts] = useState<{ [key: string]: string }>({});
  const [status, setStatus] = useState("");

  const handleSave = async (platform: string) => {
    const count = parseInt(counts[platform]);
    if (isNaN(count)) return alert("数字を入力してください");

    setStatus(`Saving ${platform}...`);
    const { error } = await supabase
      .from("sns_stats")
      .insert([{ platform, follower_count: count }]);

    if (error) {
      setStatus("Error: " + error.message);
    } else {
      setStatus(`✅ ${platform.toUpperCase()} を保存しました！`);
      setCounts({ ...counts, [platform]: "" }); // 入力欄をリセット
      setTimeout(() => setStatus(""), 3000);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white p-8 font-sans">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-black italic mb-2 uppercase">SNS <span className="text-red-600">Manual Update</span></h1>
        <p className="text-zinc-500 text-[10px] mb-8 tracking-widest">現在のフォロワー数を手動で入力</p>

        {status && (
          <div className="mb-6 p-3 bg-zinc-900 border border-zinc-700 text-[10px] font-bold text-center">
            {status}
          </div>
        )}

        <div className="space-y-6">
          {PLATFORMS.map((p) => (
            <div key={p.id} className={`p-4 bg-zinc-900/50 rounded-xl border-l-4 ${p.color}`}>
              <label className="block text-[10px] text-zinc-500 uppercase font-bold mb-2">{p.name}</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="例: 125000"
                  className="flex-1 bg-black border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-white transition-colors"
                  value={counts[p.id] || ""}
                  onChange={(e) => setCounts({ ...counts, [p.id]: e.target.value })}
                />
                <button
                  onClick={() => handleSave(p.id)}
                  className="bg-white text-black px-4 py-2 rounded text-[10px] font-black hover:bg-zinc-200 transition-colors uppercase"
                >
                  Save
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center flex flex-col gap-4">
          <a href="/sns" className="text-zinc-600 hover:text-white text-[10px] underline decoration-zinc-800 underline-offset-4">
            VIEW ANALYTICS PAGE →
          </a>
          <a href="/" className="text-zinc-600 hover:text-white text-[10px] underline decoration-zinc-800 underline-offset-4">
            BACK TO VIDEO STATS →
          </a>
        </div>
      </div>
    </main>
  );
}