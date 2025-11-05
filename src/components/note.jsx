import { useEffect, useMemo, useRef, useState } from "react";

/* ---------- Utils ---------- */
function sToStamp(s) {
  if (isNaN(s)) return "0:00";
  const sec = Math.max(0, Math.floor(s));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = String(sec % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
function stampToS(stamp) {
  const parts = stamp.split(":").map((n) => Number(n));
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(stamp) || 0;
}

/* ---------- YouTube API loader ---------- */
function loadYouTubeAPI() {
  if (typeof window === "undefined") return Promise.reject();
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (window._ytApiPromise) return window._ytApiPromise;

  window._ytApiPromise = new Promise((resolve) => {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
  });
  return window._ytApiPromise;
}

/* ---------- helpers ---------- */
function extractYouTubeId(urlOrId) {
  if (!urlOrId) return "";
  try {
    const u = new URL(urlOrId);
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) return u.searchParams.get("v");
    if (u.hostname === "youtu.be") return u.pathname.replace("/", "");
    if (u.hostname.includes("youtube.com") && u.pathname.startsWith("/embed/")) return u.pathname.split("/").pop();
  } catch {
    return urlOrId; // นับว่าเป็น id ตรง ๆ
  }
  return urlOrId;
}

/* ---------- Component ---------- */
export default function YouTubeNotes({ videoId, videoUrl }) {
  const resolvedVideoId = extractYouTubeId(videoId || videoUrl);
  const playerRef = useRef(null);
  const textRef = useRef(null);

  if (!resolvedVideoId) {
    return <div className="p-4 text-sm text-red-600">ไม่พบวิดีโอสำหรับแสดง (videoId/videoUrl ว่าง)</div>;
  }

  const containerId = `yt-player-${resolvedVideoId}`;
  const storageKey = `yt-notes-${resolvedVideoId}`;
  const MODE_STORAGE = `yt-save-mode-${resolvedVideoId}`;

  const [ready, setReady] = useState(false);

  // ⛑️ โหลดโน้ตแบบกันพัง
  const [notes, setNotes] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // ถ้า parse พัง จะไม่ทับของเดิมใน localStorage
      return [];
    }
  });

  // "pause" | "continue" | "nochange"
  const [saveAfterMode, setSaveAfterMode] = useState(() => {
    return localStorage.getItem(MODE_STORAGE) || "pause";
  });

  // 🧷 จำโหมดไว้ต่อวิดีโอ
  useEffect(() => {
    localStorage.setItem(MODE_STORAGE, saveAfterMode);
  }, [saveAfterMode, MODE_STORAGE]);

  const [q, setQ] = useState("");
  const [form, setForm] = useState({ start: "", end: "", text: "", tags: "" });

  // 🔄 sync ลง localStorage ทุกครั้งที่ notes หรือ storageKey เปลี่ยน
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(notes));
    } catch {}
  }, [notes, storageKey]);

  // init player
  useEffect(() => {
    let player;
    let mounted = true;
    loadYouTubeAPI().then((YT) => {
      if (!mounted) return;
      player = new YT.Player(containerId, {
        videoId: resolvedVideoId,
        playerVars: { modestbranding: 1, rel: 0, playsinline: 1 },
        events: {
          onReady: () => {
            playerRef.current = player;
            setReady(true);
          },
        },
      });
    });
    return () => {
      mounted = false;
      try { player?.destroy?.(); } catch {}
    };
  }, [resolvedVideoId, containerId]);

  // shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (!ready) return;
      const k = e.key?.toLowerCase?.();
      if (k === "n" && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        startNoteNow(true);   // หยุดแล้วจด
      }
      if (k === "n" && e.shiftKey) {
        e.preventDefault();
        startNoteNow(false);  // ไม่หยุดแล้วจด
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        saveNote();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ready, form, saveAfterMode]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const sorted = [...notes].sort((a, b) => a.start - b.start);
    if (!term) return sorted;
    return sorted.filter(
      (n) => n.text.toLowerCase().includes(term) || n.tags.join(" ").toLowerCase().includes(term)
    );
  }, [notes, q]);

  // create note form
  const startNoteNow = (pause = true) => {
    const p = playerRef.current;
    if (!p || !ready) return;
    const t = Math.floor(p.getCurrentTime());
    if (pause) p.pauseVideo();
    setForm((f) => ({ ...f, start: sToStamp(t), end: "", text: f.text }));
    requestAnimationFrame(() => textRef.current?.focus());
  };

  const saveNote = () => {
    const startS = stampToS(form.start);
    const endS = form.end ? stampToS(form.end) : startS;
    if (!form.text.trim()) return alert("กรอกข้อความโน้ตก่อนนะ");
    if (isNaN(startS) || isNaN(endS)) return alert("เวลาไม่ถูกต้อง");
    if (endS < startS) return alert("end ต้องมากกว่าหรือเท่ากับ start");

    const tagList = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const next = [
      ...notes,
      { id: crypto.randomUUID?.() ?? String(Date.now()), start: startS, end: endS, text: form.text.trim(), tags: tagList, createdAt: new Date().toISOString() },
    ];

    // ✅ เขียนลง state และ localStorage “ทันที” กันหลุดตอนสลับคลิปเร็ว ๆ
    setNotes(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}

    setForm({ start: "", end: "", text: "", tags: "" });

    const p = playerRef.current;
    if (p) {
      const state = p.getPlayerState?.(); // 1 = playing
      if (saveAfterMode === "continue") {
        if (state !== 1) p.playVideo();
      } else if (saveAfterMode === "pause") {
        p.pauseVideo();
      }
    }
  };

  const removeNote = (id) => {
    const next = notes.filter((n) => n.id !== id);
    setNotes(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
  };

  const jumpAndPauseForEdit = (note) => {
    const p = playerRef.current;
    if (!p || !ready) return;
    p.seekTo(note.start, true);
    p.pauseVideo();
    setForm((f) => ({ ...f, start: sToStamp(note.start), end: sToStamp(note.end ?? note.start) }));
    requestAnimationFrame(() => textRef.current?.focus());
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-4 lg:gap-6">
        {/* Player */}
        <section className="md:col-span-3">
          <div className="rounded-2xl overflow-hidden bg-white">
            <div id={containerId} className="aspect-video w-full" />
          </div>

        {/* Controls */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => startNoteNow(true)}
              className="px-3 py-2 rounded-lg border-2 border-gray-200 bg-white hover:bg-gray-50"
            >
              สร้างโน้ต (หยุดวิดีโอ)
            </button>
            <button
              onClick={() => startNoteNow(false)}
              className="px-3 py-2 rounded-lg border-2 border-gray-200 bg-white hover:bg-green-100"
            >
              สร้างโน้ต (ไม่หยุด)
            </button>

            <div className="flex-1" />

            <div className="inline-flex rounded-lg border bg-white overflow-hidden">
              <button
                onClick={() => setSaveAfterMode("pause")}
                className={`px-3 py-2 text-sm ${saveAfterMode === "pause" ? "bg-indigo-600 text-white" : "hover:bg-gray-50"}`}
              >
                หยุดหลังบันทึก
              </button>
              <button
                onClick={() => setSaveAfterMode("continue")}
                className={`px-3 py-2 text-sm border-l ${saveAfterMode === "continue" ? "bg-indigo-600 text-white" : "hover:bg-gray-50"}`}
              >
                เล่นต่อหลังบันทึก
              </button>
              <button
                onClick={() => setSaveAfterMode("nochange")}
                className={`px-3 py-2 text-sm border-l ${saveAfterMode === "nochange" ? "bg-indigo-600 text-white" : "hover:bg-gray-50"}`}
              >
                ไม่แตะวิดีโอ
              </button>
            </div>
          </div>
        </section>

        {/* Editor + List (เหมือนเดิม) */}
        <section className="md:col-span-2 flex flex-col lg:flex-row gap-4">
          <div className="rounded-2xl border bg-white shadow p-4 flex-1 min-w-0 md:max-w-none lg:max-w-[560px]">
            <h2 className="text-xl sm:text-lg font-semibold mb-3">เพิ่มโน้ตตามช่วงเวลา</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-600">Start</label>
                <input
                  value={form.start}
                  onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
                  placeholder="1:23"
                  className="w-full mt-1 rounded-lg border px-3 py-2"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">End (ไม่ใส่ก็ได้)</label>
                <input
                  value={form.end}
                  onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
                  placeholder="2:10"
                  className="w-full mt-1 rounded-lg border px-3 py-2"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="text-sm text-gray-600">ข้อความโน้ต</label>
              <textarea
                ref={textRef}
                value={form.text}
                onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                rows={3}
                placeholder="สรุปใจความสำคัญ…"
                className="w-full mt-1 rounded-lg border px-3 py-2"
              />
            </div>

            <div className="mt-3">
              <label className="text-sm text-gray-600">แท็ก (คั่นด้วย ,)</label>
              <input
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="keyword1, keyword2"
                className="w-full mt-1 rounded-lg border px-3 py-2"
              />
            </div>

            <div className="mt-4 flex gap-2 justify-end">
              <button
                onClick={saveNote}
                className="w-full sm:w-auto px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                title="บันทึกโน้ต (คีย์ลัด: Ctrl/Cmd + Enter)"
              >
                บันทึกโน้ต
              </button>
            </div>
          </div>

          <div className="rounded-2xl border bg-white shadow p-4 flex-none w-full sm:w-auto md:w-full lg:w-[360px] xl:w-[420px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="font-semibold">โน้ตทั้งหมด</h3>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ค้นหา…"
                className="w-full sm:w-40 rounded-lg border px-3 py-2"
              />
            </div>

            <ul className="mt-3 space-y-2 overflow-auto pr-1 max-h-[40vh] sm:max-h-[55vh] md:max-h-[65vh]">
              {filtered.map((n) => (
                <li key={n.id} className="border rounded-xl p-3 hover:bg-indigo-50 transition">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => jumpAndPauseForEdit(n)}
                      className="font-mono text-sm px-2 py-1 rounded bg-indigo-100 hover:bg-indigo-200"
                      title="คลิกเพื่อไปช่วงนี้และหยุดไว้เพื่อจด"
                    >
                      {sToStamp(n.start)} – {sToStamp(n.end)}
                    </button>
                    <button onClick={() => removeNote(n.id)} className="text-red-600 text-sm hover:underline">
                      ลบ
                    </button>
                  </div>
                  <p className="mt-2 text-sm">{n.text}</p>
                  {n.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {n.tags.map((t) => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 border">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
              {filtered.length === 0 && <li className="text-sm text-gray-500">ยังไม่มีโน้ต</li>}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
