"use client";

/**
 * Admin Reference Library — upload commercial tracks, tag genre + source
 * quality, watch batch progress, browse genre stats, view popularity trends,
 * and view the Mix Intelligence dashboard.
 *
 * Uses the streaming /api/admin/reference-library/process endpoint for
 * real-time progress as Cog analyzes each file.
 */

import { useEffect, useState } from "react";
import { Library, Upload, Trash2, RefreshCw, TrendingUp, BarChart3 } from "lucide-react";

type Tab = "library" | "trends" | "intelligence";

const GENRES = [
  "HIP_HOP", "TRAP", "RNB", "POP", "ROCK", "ELECTRONIC",
  "ACOUSTIC", "LO_FI", "AFROBEATS", "LATIN", "COUNTRY", "GOSPEL", "NEO_SOUL",
];

const SOURCE_QUALITIES: Array<{ id: string; label: string; weight: number }> = [
  { id: "lossless",    label: "Lossless (WAV/FLAC)",   weight: 1.0 },
  { id: "apple_music", label: "Apple Music (ALAC)",    weight: 1.0 },
  { id: "tidal",       label: "Tidal (FLAC/MQA)",      weight: 1.0 },
  { id: "amazon_hd",   label: "Amazon Music HD",       weight: 1.0 },
  { id: "deezer",      label: "Deezer (FLAC)",         weight: 1.0 },
  { id: "spotify",     label: "Spotify (320kbps)",     weight: 0.9 },
  { id: "youtube",     label: "YouTube (lossy)",       weight: 0.6 },
  { id: "soundcloud",  label: "SoundCloud (lossy)",    weight: 0.5 },
  { id: "other",       label: "Other / Unknown",       weight: 0.6 },
];

interface PendingTrack {
  file:          File;
  genre:         string;
  subgenre:      string;
  sourceQuality: string;
  trackName:     string;
  artistName:    string;
  uploadedUrl?:  string;
  status:        "pending" | "uploading" | "processing" | "ok" | "failed";
  error?:        string;
}

interface GenreStat {
  genre: string; tracks: number; lossless: number; high: number; standard: number;
  lastUpdated: string | null; avgLufs: number | null; status: "READY" | "BUILDING" | "EMPTY";
  commercialCount: number; userRefCount: number; userOutcomeCount: number;
}

export default function ReferenceLibraryClient() {
  const [tab, setTab] = useState<Tab>("library");
  return (
    <div style={{ color: "#E5E5E5" }}>
      <div className="flex items-center gap-3 mb-6">
        <Library size={22} style={{ color: "#D4A843" }} />
        <h1 className="text-xl font-semibold">Reference Library</h1>
      </div>
      <div className="flex gap-2 mb-6 border-b border-[#222]">
        <TabBtn active={tab === "library"}      onClick={() => setTab("library")}><Upload size={14}/> Library</TabBtn>
        <TabBtn active={tab === "trends"}        onClick={() => setTab("trends")}><TrendingUp size={14}/> User Trends</TabBtn>
        <TabBtn active={tab === "intelligence"}  onClick={() => setTab("intelligence")}><BarChart3 size={14}/> Mix Intelligence</TabBtn>
      </div>
      {tab === "library"      && <LibraryTab />}
      {tab === "trends"       && <TrendsTab />}
      {tab === "intelligence" && <IntelligenceTab />}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors"
      style={{
        color:        active ? "#D4A843" : "#999",
        borderColor:  active ? "#D4A843" : "transparent",
      }}
    >
      {children}
    </button>
  );
}

function LibraryTab() {
  const [pending, setPending] = useState<PendingTrack[]>([]);
  const [genres, setGenres] = useState<GenreStat[]>([]);
  const [defaultGenre, setDefaultGenre] = useState("HIP_HOP");
  const [defaultSource, setDefaultSource] = useState("lossless");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<{ index: number; total: number; track: string } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);

  async function loadGenres() {
    const r = await fetch("/api/admin/reference-library/genres");
    if (r.ok) setGenres((await r.json()).genres ?? []);
  }
  useEffect(() => { loadGenres(); }, []);

  function onFiles(files: FileList | null) {
    if (!files) return;
    const next: PendingTrack[] = [...pending];
    for (const f of Array.from(files)) {
      // Try to extract artist + track name from filename: "Artist - Track.mp3"
      const base = f.name.replace(/\.(mp3|wav|flac|aiff|m4a)$/i, "");
      const [artist, ...rest] = base.split(" - ");
      next.push({
        file:          f,
        genre:         defaultGenre,
        subgenre:      "",
        sourceQuality: defaultSource,
        trackName:     rest.join(" - ") || base,
        artistName:    rest.length ? artist : "",
        status:        "pending",
      });
    }
    setPending(next);
  }

  function updateTrack(i: number, patch: Partial<PendingTrack>) {
    setPending(p => p.map((t, idx) => idx === i ? { ...t, ...patch } : t));
  }
  function removeTrack(i: number) {
    setPending(p => p.filter((_, idx) => idx !== i));
  }

  async function uploadOne(t: PendingTrack): Promise<string> {
    const fd = new FormData();
    fd.append("file", t.file);
    fd.append("kind", "reference");
    const r = await fetch("/api/admin/reference-library/upload", { method: "POST", body: fd });
    if (!r.ok) throw new Error(`upload failed: ${r.status}`);
    const j = await r.json();
    return j.url as string;
  }

  async function startBatch() {
    if (processing || pending.length === 0) return;
    setProcessing(true);
    setLogs([]);
    setProgress(null);

    // 1. Upload everything to S3 first
    const tracks: PendingTrack[] = [...pending];
    for (let i = 0; i < tracks.length; i++) {
      try {
        if (!tracks[i].uploadedUrl) {
          updateTrack(i, { status: "uploading" });
          tracks[i].uploadedUrl = await uploadOne(tracks[i]);
          updateTrack(i, { uploadedUrl: tracks[i].uploadedUrl, status: "pending" });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        updateTrack(i, { status: "failed", error: msg });
      }
    }

    // 2. Stream to /process
    const payload = {
      tracks: tracks
        .filter(t => t.uploadedUrl && t.status !== "failed")
        .map(t => ({
          url:           t.uploadedUrl!,
          genre:         t.genre,
          subgenre:      t.subgenre || undefined,
          sourceQuality: t.sourceQuality,
          trackName:     t.trackName || undefined,
          artistName:    t.artistName || undefined,
        })),
    };

    const res = await fetch("/api/admin/reference-library/process", {
      method:  "POST",
      headers: { "content-type": "application/json" },
      body:    JSON.stringify(payload),
    });
    if (!res.ok || !res.body) {
      setLogs(l => [...l, `error: ${res.status}`]);
      setProcessing(false);
      return;
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const evt = JSON.parse(line);
          if (evt.type === "progress") setProgress(evt);
          if (evt.type === "track_ok")     setLogs(l => [...l, `✓ ${evt.genre} · sep ${(evt.separation * 100).toFixed(0)}%`]);
          if (evt.type === "track_failed") setLogs(l => [...l, `✗ #${evt.index} — ${evt.error}`]);
          if (evt.type === "genre_recomputed") setLogs(l => [...l, `↻ recomputed ${evt.genre}`]);
          if (evt.type === "done") setLogs(l => [...l, `done — ${evt.ok} ok / ${evt.fail} failed`]);
        } catch {/* ignore parse errors */}
      }
    }

    setProcessing(false);
    setPending([]);
    await loadGenres();
  }

  async function resetGenre(genre: string) {
    if (!confirm(`Delete ALL ${genre} reference profiles? This cannot be undone.`)) return;
    const r = await fetch(`/api/admin/reference-library/genre/${genre}`, { method: "DELETE" });
    if (r.ok) await loadGenres();
  }

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      <div className="rounded-xl border border-[#2A2A2A] p-5" style={{ background: "#0F0F0F" }}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold mb-1">Upload commercial tracks</h2>
            <p className="text-xs" style={{ color: "#777" }}>
              Drag-and-drop WAV/MP3/FLAC. Tag genre + source quality. Audio is analyzed and discarded — only the profile is stored.
            </p>
          </div>
          <div className="flex gap-2">
            <select value={defaultGenre} onChange={e => setDefaultGenre(e.target.value)}
              className="text-xs rounded-md border border-[#333] bg-[#0A0A0A] px-2 py-1.5">
              {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={defaultSource} onChange={e => setDefaultSource(e.target.value)}
              className="text-xs rounded-md border border-[#333] bg-[#0A0A0A] px-2 py-1.5">
              {SOURCE_QUALITIES.map(s => <option key={s.id} value={s.id}>{s.label} · {s.weight}x</option>)}
            </select>
          </div>
        </div>

        <label
          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
          onDragOver={(e)  => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }}
          onDrop={(e) => {
            e.preventDefault(); e.stopPropagation();
            setDragOver(false);
            const dropped = e.dataTransfer?.files;
            if (dropped && dropped.length > 0) onFiles(dropped);
          }}
          className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 cursor-pointer transition-colors"
          style={{
            background:  dragOver ? "#1A1308" : "#0A0A0A",
            borderColor: dragOver ? "#D4A843" : "#333",
          }}
        >
          <Upload size={20} style={{ color: "#D4A843" }} />
          <p className="text-xs mt-2" style={{ color: "#999" }}>
            {dragOver ? "Drop to add" : "Drop or click to add audio files"}
          </p>
          <input
            type="file" multiple accept="audio/*"
            className="hidden"
            onChange={e => onFiles(e.target.files)}
          />
        </label>

        {pending.length > 0 && (
          <>
            <div className="mt-4 max-h-72 overflow-y-auto space-y-2">
              {pending.map((t, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center text-xs rounded-md border border-[#222] px-3 py-2" style={{ background: "#0A0A0A" }}>
                  <div className="col-span-3 truncate">{t.file.name}</div>
                  <input value={t.artistName} onChange={e => updateTrack(i, { artistName: e.target.value })}
                    placeholder="Artist" className="col-span-2 rounded border border-[#333] bg-transparent px-2 py-1" />
                  <input value={t.trackName} onChange={e => updateTrack(i, { trackName: e.target.value })}
                    placeholder="Track" className="col-span-2 rounded border border-[#333] bg-transparent px-2 py-1" />
                  <select value={t.genre} onChange={e => updateTrack(i, { genre: e.target.value })}
                    className="col-span-2 rounded border border-[#333] bg-transparent px-2 py-1">
                    {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <select value={t.sourceQuality} onChange={e => updateTrack(i, { sourceQuality: e.target.value })}
                    className="col-span-2 rounded border border-[#333] bg-transparent px-2 py-1">
                    {SOURCE_QUALITIES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                  <button onClick={() => removeTrack(i)} className="col-span-1 justify-self-end" disabled={processing}>
                    <Trash2 size={14} style={{ color: "#777" }}/>
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={startBatch}
              disabled={processing}
              className="mt-4 px-5 py-2 text-sm font-medium rounded-lg disabled:opacity-50"
              style={{ background: "#D4A843", color: "#0A0A0A" }}
            >
              {processing ? "Processing…" : `Process Batch (${pending.length})`}
            </button>
          </>
        )}

        {(processing || logs.length > 0) && (
          <div className="mt-4 rounded-md border border-[#222] p-3" style={{ background: "#0A0A0A" }}>
            {progress && (
              <p className="text-xs mb-2" style={{ color: "#D4A843" }}>
                Processing {progress.index + 1} of {progress.total} — {progress.track}
              </p>
            )}
            <div className="text-[11px] font-mono space-y-0.5 max-h-40 overflow-y-auto" style={{ color: "#999" }}>
              {logs.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>
        )}
      </div>

      {/* Genre stats */}
      <div className="rounded-xl border border-[#2A2A2A]" style={{ background: "#0F0F0F" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#222]">
          <h2 className="text-sm font-semibold">Genre Profiles</h2>
          <button onClick={loadGenres} className="flex items-center gap-1.5 text-xs" style={{ color: "#999" }}>
            <RefreshCw size={12}/> Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: "#777" }}>
                <th className="text-left px-5 py-3 font-medium">Genre</th>
                <th className="text-right px-2 py-3 font-medium">Tracks</th>
                <th className="text-right px-2 py-3 font-medium">Lossless</th>
                <th className="text-right px-2 py-3 font-medium">High</th>
                <th className="text-right px-2 py-3 font-medium">Standard</th>
                <th className="text-right px-2 py-3 font-medium">Avg LUFS</th>
                <th className="text-right px-2 py-3 font-medium">Updated</th>
                <th className="text-right px-5 py-3 font-medium">Status</th>
                <th className="text-right px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {genres.length === 0 && (
                <tr><td colSpan={9} className="px-5 py-6 text-center" style={{ color: "#555" }}>No reference data yet — upload some commercial tracks above.</td></tr>
              )}
              {genres.map(g => (
                <tr key={g.genre} className="border-t border-[#1A1A1A]">
                  <td className="px-5 py-3 font-medium">{g.genre}</td>
                  <td className="text-right px-2 py-3">{g.tracks}</td>
                  <td className="text-right px-2 py-3">{g.lossless}</td>
                  <td className="text-right px-2 py-3">{g.high}</td>
                  <td className="text-right px-2 py-3">{g.standard}</td>
                  <td className="text-right px-2 py-3">{g.avgLufs ?? "—"}</td>
                  <td className="text-right px-2 py-3" style={{ color: "#777" }}>
                    {g.lastUpdated ? new Date(g.lastUpdated).toLocaleDateString() : "—"}
                  </td>
                  <td className="text-right px-5 py-3">
                    <span style={{ color:
                        g.status === "READY"    ? "#4CAF50"
                      : g.status === "BUILDING" ? "#D4A843"
                      :                            "#777" }}>
                      {g.status}
                    </span>
                  </td>
                  <td className="text-right px-5 py-3">
                    <button onClick={() => resetGenre(g.genre)} title="Reset genre">
                      <Trash2 size={13} style={{ color: "#666" }}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TrendsTab() {
  const [trends, setTrends] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/admin/reference-library/trends").then(r => r.json()).then(j => setTrends(j.trends ?? []));
  }, []);
  return (
    <div className="rounded-xl border border-[#2A2A2A]" style={{ background: "#0F0F0F" }}>
      <div className="px-5 py-4 border-b border-[#222]">
        <h2 className="text-sm font-semibold">Popular User References</h2>
        <p className="text-xs mt-1" style={{ color: "#777" }}>Tracks uploaded as references by Premium/Pro users. Auto-promoted at 5+ uploads.</p>
      </div>
      <table className="w-full text-xs">
        <thead><tr style={{ color: "#777" }}>
          <th className="text-left px-5 py-3">Track</th>
          <th className="text-left px-2 py-3">Genre</th>
          <th className="text-right px-2 py-3">Times Referenced</th>
          <th className="text-right px-2 py-3">First Seen</th>
          <th className="text-right px-5 py-3">Status</th>
        </tr></thead>
        <tbody>
          {trends.length === 0 && (
            <tr><td colSpan={5} className="px-5 py-6 text-center" style={{ color: "#555" }}>No user references yet.</td></tr>
          )}
          {trends.map(t => (
            <tr key={t.id} className="border-t border-[#1A1A1A]">
              <td className="px-5 py-3">{t.trackName ?? t.fingerprintHash?.slice(0, 16) ?? "—"}</td>
              <td className="px-2 py-3">{t.genre}</td>
              <td className="text-right px-2 py-3">{t.uploadCount}</td>
              <td className="text-right px-2 py-3" style={{ color: "#777" }}>{new Date(t.firstSeen).toLocaleDateString()}</td>
              <td className="text-right px-5 py-3" style={{ color: t.autoPromoted ? "#4CAF50" : "#777" }}>
                {t.autoPromoted ? "Promoted" : `Need ${5 - t.uploadCount}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IntelligenceTab() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch("/api/admin/reference-library/intelligence").then(r => r.json()).then(setData);
  }, []);
  if (!data) return <div className="text-xs" style={{ color: "#777" }}>Loading…</div>;
  const t = data.totals;
  const h = data.holdoutImpact;
  const fmtPct = (n: number | null) => n == null ? "—" : `${(n * 100).toFixed(1)}%`;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Total mixes"   value={t.total} />
        <Card label="Qualifying"    value={`${t.qualifying} (${fmtPct(t.qualifyRate)})`} />
        <Card label="Revision rate" value={fmtPct(t.revisionRate)} />
        <Card label="Downloaded"    value={t.downloaded} />
      </div>

      <div className="rounded-xl border border-[#2A2A2A]" style={{ background: "#0F0F0F" }}>
        <div className="px-5 py-4 border-b border-[#222]">
          <h2 className="text-sm font-semibold">Per-Genre Health</h2>
        </div>
        <table className="w-full text-xs">
          <thead><tr style={{ color: "#777" }}>
            <th className="text-left px-5 py-3">Genre</th>
            <th className="text-right px-2 py-3">Mixes</th>
            <th className="text-right px-2 py-3">Qualify</th>
            <th className="text-right px-2 py-3">Revised</th>
            <th className="text-right px-5 py-3">Top Complaint</th>
          </tr></thead>
          <tbody>
            {data.perGenre.map((g: any) => (
              <tr key={g.genre} className="border-t border-[#1A1A1A]">
                <td className="px-5 py-3">{g.genre}</td>
                <td className="text-right px-2 py-3">{g.total}</td>
                <td className="text-right px-2 py-3">{g.qualify}</td>
                <td className="text-right px-2 py-3">{g.revised}</td>
                <td className="text-right px-5 py-3" style={{ color: "#999" }}>{g.topComplaint ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-[#2A2A2A] p-5" style={{ background: "#0F0F0F" }}>
        <h2 className="text-sm font-semibold mb-3">Reference Library Impact (A/B holdout)</h2>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p style={{ color: "#777" }} className="mb-1">Holdout (no reference)</p>
            <p>Revision rate: <span style={{ color: "#D4A843" }}>{fmtPct(h.holdoutRevisionRate)}</span> · n={h.holdoutN}</p>
          </div>
          <div>
            <p style={{ color: "#777" }} className="mb-1">Reference-informed</p>
            <p>Revision rate: <span style={{ color: "#4CAF50" }}>{fmtPct(h.informedRevisionRate)}</span> · n={h.informedN}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#2A2A2A] p-4" style={{ background: "#0F0F0F" }}>
      <p className="text-[11px] uppercase tracking-wide" style={{ color: "#777" }}>{label}</p>
      <p className="text-lg mt-1 font-semibold" style={{ color: "#E5E5E5" }}>{value}</p>
    </div>
  );
}
