"use client";

/**
 * MasterResultsClient — guest compare + download UI
 *
 * No login required. Uses access_token query param for download auth.
 * Matches the same UI pattern as the wizard compare/export steps.
 */

import { useState, useRef } from "react";
import {
  Play, Pause, Download, Check, ChevronRight, Info, Music,
} from "lucide-react";
import { cn } from "@/lib/utils";

type VersionName = "Clean" | "Warm" | "Punch" | "Loud";

const VERSION_DESCRIPTIONS: Record<string, string> = {
  Clean: "Balanced, flat reference",
  Warm:  "Smooth, vintage character",
  Punch: "Aggressive, transient-forward",
  Loud:  "Maximum competitive loudness",
};

const PLATFORMS: Record<string, string> = {
  spotify:     "Spotify",
  apple_music: "Apple Music",
  youtube:     "YouTube",
  wav_master:  "WAV Master",
};

interface Props {
  jobId:           string;
  token:           string;
  versions:        { name: string; lufs: number; truePeak: number; url: string; waveformData: number[] }[];
  exports:         { platform: string; lufs: number; format: string; url: string }[];
  reportData:      { finalLufs: number; truePeak: number; dynamicRange: number; loudnessPenalties: { platform: string; penalty: number }[] } | null;
  previewUrl:      string;
  originalUrl:     string | null;
  selectedVersion: string | null;
  guestName:       string;
  expiresAt:       string;
}

export function MasterResultsClient({
  jobId, token, versions, exports: exportsData,
  reportData, previewUrl, originalUrl, selectedVersion: initSelected,
  guestName, expiresAt,
}: Props) {
  const [selected,   setSelected]   = useState<string | null>(initSelected ?? versions[0]?.name ?? null);
  const [playing,    setPlaying]    = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const expiresDate = new Date(expiresAt);
  const daysLeft    = Math.max(0, Math.ceil((expiresDate.getTime() - Date.now()) / 86400000));

  function downloadUrl(format: string, version: string) {
    return `/api/mastering/job/${jobId}/download?format=${format}&version=${version}&access_token=${token}`;
  }

  function togglePlay(url: string, key: string) {
    if (playing === key) {
      audioRef.current?.pause();
      setPlaying(null);
    } else {
      audioRef.current?.pause();
      audioRef.current = new Audio(url);
      audioRef.current.play();
      audioRef.current.onended = () => setPlaying(null);
      setPlaying(key);
    }
  }

  async function confirmVersion(name: string) {
    setSelected(name);
    await fetch(`/api/mastering/job/${jobId}/select-version`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ version: name }),
    }).catch(() => {});
  }

  return (
    <div style={{ backgroundColor: "#0A0A0A", color: "#fff", minHeight: "100vh" }}>
      <div className="max-w-lg mx-auto px-4 py-10 space-y-6">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-xl font-bold">Your master is ready</h1>
          <p className="text-xs mt-1" style={{ color: "#777" }}>
            Hi {guestName} — listen, compare, and download below.
          </p>
          <p className="text-[11px] mt-1" style={{ color: "#555" }}>
            Link expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
          </p>
        </div>

        {/* A/B toggle */}
        {originalUrl && (
          <div className="rounded-xl border border-[#2A2A2A] overflow-hidden">
            <div className="grid grid-cols-2" style={{ backgroundColor: "#111" }}>
              {(["original", "mastered"] as const).map((side) => {
                const isOrig   = side === "original";
                const isActive = isOrig ? playing === "original" : playing !== null && playing !== "original";
                return (
                  <button
                    key={side}
                    onClick={() => {
                      if (isOrig) {
                        togglePlay(originalUrl, "original");
                      } else {
                        const v = versions.find(v => v.name === selected);
                        if (v?.url) togglePlay(v.url, v.name);
                      }
                    }}
                    className="py-2.5 text-xs font-semibold transition-all"
                    style={{
                      color:           isActive ? "#0A0A0A" : "#777",
                      backgroundColor: isActive ? "#D4A843" : "transparent",
                    }}
                  >
                    {isOrig ? "Original" : `Mastered${selected ? ` · ${selected}` : ""}`}
                  </button>
                );
              })}
            </div>
            <div className="px-4 py-2" style={{ backgroundColor: "#0D0D0D" }}>
              <span className="text-[10px]" style={{ color: "#555" }}>
                {playing === "original" ? "Playing original…"
                  : playing && playing !== "original" ? `Playing ${playing}…`
                  : "Tap to compare original vs mastered"}
              </span>
            </div>
          </div>
        )}

        {/* Version cards */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#D4A843" }}>Choose a version</p>
          {versions.map((v) => (
            <div
              key={v.name}
              onClick={() => confirmVersion(v.name)}
              className={cn(
                "rounded-2xl border p-4 cursor-pointer transition-all",
                selected === v.name ? "border-[#D4A843] bg-[#D4A843]/8" : "border-[#2A2A2A] hover:border-[#444]"
              )}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); togglePlay(v.url, v.name); }}
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "#1A1A1A", border: "1px solid #333" }}
                >
                  {playing === v.name
                    ? <Pause size={13} style={{ color: "#D4A843" }} />
                    : <Play  size={13} style={{ color: "#D4A843" }} />
                  }
                </button>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{v.name}</span>
                    {v.name === versions[0]?.name && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
                        AI recommends
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: "#777" }}>
                    {VERSION_DESCRIPTIONS[v.name] ?? ""} · {v.lufs.toFixed(1)} LUFS
                  </div>
                </div>
                {selected === v.name && <Check size={15} style={{ color: "#D4A843" }} />}
              </div>
            </div>
          ))}
        </div>

        {/* Mastering report */}
        {reportData && (
          <div className="rounded-xl border border-[#2A2A2A] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info size={13} style={{ color: "#D4A843" }} />
              <span className="text-xs font-semibold" style={{ color: "#D4A843" }}>Mastering Report</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "LUFS",    value: `${reportData.finalLufs.toFixed(1)} dB` },
                { label: "Peak",    value: `${reportData.truePeak.toFixed(1)} dBTP` },
                { label: "Dynamic", value: `${reportData.dynamicRange.toFixed(1)} dB` },
              ].map((m) => (
                <div key={m.label} className="rounded-lg p-2 text-center" style={{ backgroundColor: "#111" }}>
                  <div className="text-sm font-bold">{m.value}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: "#777" }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Format downloads */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#D4A843" }}>Download</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "mp3_320",    label: "MP3 320kbps",         use: "Streaming & social" },
              { id: "wav_16_44",  label: "WAV 16-bit 44.1kHz",  use: "CD quality"         },
              { id: "wav_24_44",  label: "WAV 24-bit 44.1kHz",  use: "Studio master"      },
              { id: "wav_24_48",  label: "WAV 24-bit 48kHz",    use: "Video / broadcast"  },
              { id: "flac_24_44", label: "FLAC 24-bit",         use: "Lossless archive"   },
              { id: "aiff_24_44", label: "AIFF 24-bit",         use: "Apple / Logic"      },
            ].map((fmt) => (
              <div key={fmt.id} className="rounded-xl border border-[#2A2A2A] p-3 flex flex-col gap-2">
                <div>
                  <div className="text-xs font-bold">{fmt.label}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: "#777" }}>{fmt.use}</div>
                </div>
                <a
                  href={downloadUrl(fmt.id, selected ?? "Warm")}
                  download
                  onClick={() => setDownloaded(true)}
                  className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold hover:opacity-90 transition-all"
                  style={{ backgroundColor: "#1A1A1A", border: "1px solid #2A2A2A", color: "#D4A843" }}
                >
                  <Download size={11} /> Download
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Platform exports */}
        {exportsData.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#777" }}>Platform Exports</p>
            {exportsData.map((ex) => (
              <div key={ex.platform} className="flex items-center justify-between p-4 rounded-xl border border-[#2A2A2A] mb-2">
                <div>
                  <div className="text-sm font-semibold">{PLATFORMS[ex.platform] ?? ex.platform}</div>
                  <div className="text-[11px]" style={{ color: "#777" }}>{ex.format} · {ex.lufs.toFixed(1)} LUFS</div>
                </div>
                <a
                  href={ex.url}
                  download
                  onClick={() => setDownloaded(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold hover:opacity-90 transition-all"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >
                  <Download size={12} /> Download
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Post-download CTA — only shown after at least one download */}
        {downloaded && (
          <div className="rounded-2xl border border-[#D4A843]/30 p-5 text-center" style={{ backgroundColor: "rgba(212,168,67,0.04)" }}>
            <p className="font-bold mb-1">Want unlimited re-downloads?</p>
            <p className="text-sm mb-4" style={{ color: "#777" }}>
              Create an account for re-downloads anytime, plus full AI studio tools.
            </p>
            <a
              href="/sign-up"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold hover:opacity-90 transition-all"
              style={{ backgroundColor: "#E85D4A", color: "#fff" }}
            >
              Create your account <ChevronRight size={15} />
            </a>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-4">
          <a href="/" className="flex items-center justify-center gap-2 text-xs" style={{ color: "#555" }}>
            <Music size={13} />
            Powered by IndieThis AI Mastering
          </a>
        </div>

      </div>
    </div>
  );
}
