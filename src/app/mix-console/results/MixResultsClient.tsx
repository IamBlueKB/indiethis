"use client";

/**
 * MixResultsClient — renders compare/export UI from a tokenized results link.
 * Used by /mix-console/results?token=xxx
 */

import { useState, useRef } from "react";
import Link from "next/link";
import { Download, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface MixJobData {
  id:                 string;
  mode:               string;
  tier:               string;
  status:             string;
  previewFilePaths:   Record<string, string> | null;
  cleanFilePath:      string | null;
  polishedFilePath:   string | null;
  aggressiveFilePath: string | null;
  mixFilePath:        string | null;
  revisionCount:      number;
  maxRevisions:       number;
  createdAt:          string;
}

export function MixResultsClient({
  jobData,
  accessToken,
}: {
  jobData:     MixJobData;
  accessToken: string;
}) {
  const isStandard = jobData.tier === "STANDARD";

  const standardVersions = [
    { key: "clean",      label: "Clean",      desc: "Balanced, natural reference" },
    { key: "polished",   label: "Polished",   desc: "Radio-ready shine" },
    { key: "aggressive", label: "Aggressive", desc: "Forward, punchy character" },
  ];

  // Default to first available version
  const defaultVersion = isStandard ? "clean" : "mix";
  const [selectedVersion, setSelectedVersion] = useState<string>(defaultVersion);
  const [selectedFormat,  setSelectedFormat]  = useState<string>("wav_24_44");
  const [audioPlaying,    setAudioPlaying]    = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  function togglePlay(url: string) {
    if (audioPlaying) {
      audioRef.current?.pause();
      setAudioPlaying(false);
    } else {
      if (audioRef.current) audioRef.current.pause();
      audioRef.current = new Audio(url);
      audioRef.current.play().catch(() => {});
      audioRef.current.onended = () => setAudioPlaying(false);
      setAudioPlaying(true);
    }
  }

  function downloadFile() {
    const a = document.createElement("a");
    a.href = `/api/mix-console/job/${jobData.id}/download?version=${selectedVersion}&format=${selectedFormat}&access_token=${accessToken}`;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const previewFilePaths = jobData.previewFilePaths;
  const previewUrl = previewFilePaths
    ? (previewFilePaths[selectedVersion] ?? Object.values(previewFilePaths)[0])
    : null;

  const createdDate = new Date(jobData.createdAt).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });

  return (
    <div className="max-w-lg mx-auto px-4 py-10">

      {/* Header */}
      <div className="text-center mb-8">
        <div
          className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-4"
          style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843", border: "1px solid rgba(212,168,67,0.25)" }}
        >
          AI Mix Console
        </div>
        <h1 className="text-2xl font-bold mb-1">Your mix is ready</h1>
        <p className="text-sm" style={{ color: "#666" }}>
          Mixed {createdDate} · {jobData.mode === "VOCAL_BEAT" ? "Vocal + Beat" : "Tracked Stems"} · {jobData.tier.charAt(0) + jobData.tier.slice(1).toLowerCase()}
        </p>
      </div>

      {/* Version selector (Standard only — 3 variations) */}
      {isStandard && (
        <div className="space-y-2 mb-5">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#777" }}>
            Choose your variation
          </p>
          {standardVersions.map((v) => (
            <button
              key={v.key}
              onClick={() => {
                setSelectedVersion(v.key);
                audioRef.current?.pause();
                setAudioPlaying(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all",
                selectedVersion === v.key
                  ? "border-[#D4A843] bg-[#D4A843]/8"
                  : "border-[#2A2A2A] hover:border-[#444]",
              )}
            >
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: selectedVersion === v.key ? "#D4A843" : "#fff" }}>
                  {v.label}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#666" }}>{v.desc}</p>
              </div>
              {selectedVersion === v.key && <Check size={14} style={{ color: "#D4A843" }} />}
            </button>
          ))}
        </div>
      )}

      {/* Preview player */}
      {previewUrl && (
        <div className="rounded-2xl border border-[#1A1A1A] p-4 mb-5">
          <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: "#555" }}>
            30-second preview
          </p>
          <button
            onClick={() => togglePlay(previewUrl)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
            style={{ backgroundColor: "#1A1A1A", color: audioPlaying ? "#D4A843" : "#ccc" }}
          >
            {audioPlaying ? "⏸ Pause" : "▶ Play preview"}
          </button>
        </div>
      )}

      {/* Format picker */}
      <div className="space-y-2 mb-5">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#777" }}>
          Choose file format
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: "wav_24_44",  label: "WAV 24-bit",  sub: "44.1kHz · Studio master" },
            { id: "wav_24_48",  label: "WAV 24-bit",  sub: "48kHz · Video / broadcast" },
            { id: "wav_16_44",  label: "WAV 16-bit",  sub: "44.1kHz · CD quality" },
            { id: "mp3_320",    label: "MP3 320kbps", sub: "Streaming & social" },
            { id: "flac",       label: "FLAC 24-bit", sub: "Lossless archive" },
            { id: "aiff",       label: "AIFF 24-bit", sub: "Apple / Logic" },
          ].map((fmt) => (
            <button
              key={fmt.id}
              onClick={() => setSelectedFormat(fmt.id)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left transition-all",
                selectedFormat === fmt.id
                  ? "border-[#D4A843] bg-[#D4A843]/8"
                  : "border-[#2A2A2A] hover:border-[#444]",
              )}
            >
              <p className="text-xs font-bold" style={{ color: selectedFormat === fmt.id ? "#D4A843" : "#ccc" }}>
                {fmt.label}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: "#555" }}>{fmt.sub}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Download button */}
      <button
        onClick={downloadFile}
        className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all mb-5"
        style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
      >
        <Download size={15} />
        Download {selectedVersion.charAt(0).toUpperCase() + selectedVersion.slice(1)} · {
          selectedFormat === "mp3_320" ? "MP3"
          : selectedFormat.startsWith("wav") ? "WAV"
          : selectedFormat.startsWith("flac") ? "FLAC"
          : "AIFF"
        }
      </button>

      {/* Cross-sell: mastering */}
      <div
        className="rounded-2xl border border-[#1A1A1A] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5"
      >
        <div>
          <p className="text-sm font-semibold mb-0.5">Ready to master?</p>
          <p className="text-xs" style={{ color: "#777" }}>
            Take your mix to release-ready with 4 mastered versions starting at $7.99.
          </p>
        </div>
        <Link
          href="/master"
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 no-underline"
          style={{ backgroundColor: "#E8735A", color: "#fff" }}
        >
          Master for $7.99 →
        </Link>
      </div>

      {/* Upsell: subscriber */}
      <div className="rounded-xl border border-[#D4A843]/30 p-4 text-center">
        <p className="text-sm font-semibold" style={{ color: "#D4A843" }}>Get discounted mixes every time</p>
        <p className="text-xs mt-1 mb-3" style={{ color: "#777" }}>
          Subscribe to IndieThis and save on every mix, master, and AI tool.
        </p>
        <Link
          href="/pricing"
          className="inline-flex items-center gap-1 text-xs font-bold px-4 py-2 rounded-lg transition-all hover:opacity-90 no-underline"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          See subscriber pricing →
        </Link>
      </div>

    </div>
  );
}
