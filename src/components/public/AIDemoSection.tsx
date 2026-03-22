"use client";

import { useEffect, useRef, useState } from "react";

const PROMPT_TEXT = "human silhouette dissolving into golden particles, sound waves, hand reaching toward light, amber and blue, surreal, gallery quality";

function TypingPrompt({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");
  const [showImage, setShowImage] = useState(false);

  useEffect(() => {
    let i = 0;
    setDisplayed("");
    setShowImage(false);
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => setShowImage(true), 400);
      }
    }, 45);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Prompt input */}
      <div style={{
        backgroundColor: "#111",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 10,
        padding: "12px 16px",
        textAlign: "left",
        minHeight: 60,
      }}>
        <div style={{ fontSize: 10, color: "#D4A843", fontWeight: 700, letterSpacing: "1px", marginBottom: 8, textTransform: "uppercase" }}>Prompt</div>
        <span style={{ fontSize: 13, color: "#ccc", fontFamily: "monospace" }}>
          {displayed}
          <span style={{ opacity: displayed.length < text.length ? 1 : 0, color: "#D4A843" }}>|</span>
        </span>
      </div>
      {/* Generated cover art */}
      <div style={{
        borderRadius: 10,
        aspectRatio: "1",
        overflow: "hidden",
        opacity: showImage ? 1 : 0,
        transition: "opacity 0.8s ease",
        backgroundColor: "#111",
        position: "relative",
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/brand/ai demo art.jpg"
          alt="AI Generated Cover Art"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
      <div style={{ fontSize: 11, color: "#666", textAlign: "center" }}>
        Generated in 12 seconds ·{" "}
        <span style={{ color: "#D4A843", fontWeight: 700 }}>$4.99</span>
      </div>
    </div>
  );
}

function MasteringAB() {
  const [playing, setPlaying] = useState<"before" | "after" | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = (track: "before" | "after") => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (playing === track) {
      setPlaying(null);
      return;
    }
    const audio = new Audio("/demo/beat-128bpm.wav");
    if (track === "before") audio.volume = 0.45;
    else audio.volume = 0.85;
    audio.play().catch(() => {});
    audioRef.current = audio;
    audio.addEventListener("ended", () => setPlaying(null));
    setPlaying(track);
  };

  const WaveRow = ({ label, track, color }: { label: string; track: "before" | "after"; color: string }) => {
    const isActive = playing === track;
    return (
      <div
        onClick={() => toggle(track)}
        style={{
          backgroundColor: "#111",
          border: `1px solid ${isActive ? color : "rgba(255,255,255,0.06)"}`,
          borderRadius: 10,
          padding: "14px 16px",
          cursor: "pointer",
          transition: "border-color 0.2s",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#999" }}>{label}</span>
          <div style={{
            width: 24, height: 24, borderRadius: "50%",
            backgroundColor: isActive ? color : "rgba(255,255,255,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 8, color: isActive ? "#0A0A0A" : "#999" }}>▶</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 2, alignItems: "center", height: track === "before" ? 28 : 40 }}>
          {Array.from({ length: 40 }, (_, i) => {
            const h = Math.abs(Math.sin(i * 0.7) * 0.6 + 0.2);
            const scale = track === "before" ? 0.5 : 1;
            return (
              <div key={i} style={{
                flex: 1, borderRadius: 2,
                height: `${(h * scale * 100)}%`,
                backgroundColor: isActive ? color : `rgba(${track === "before" ? "150,150,150" : "212,168,67"},0.35)`,
                minHeight: 3,
              }} />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <WaveRow label="Before" track="before" color="#999" />
      <WaveRow label="After — AI Mastered" track="after" color="#D4A843" />
      <div style={{ fontSize: 11, color: "#666", textAlign: "center" }}>
        3 master profiles ·{" "}
        <span style={{ color: "#D4A843", fontWeight: 700 }}>$9.99</span>
      </div>
    </div>
  );
}

export default function AIDemoSection() {
  return (
    <section className="py-20 px-6" style={{ backgroundColor: "#0A0A0A" }}>
      <div className="max-w-4xl mx-auto">
        <p style={{ fontSize: "10px", color: "#D4A843", letterSpacing: "2px", textTransform: "uppercase", textAlign: "center", marginBottom: 12, fontWeight: 700 }}>
          SEE THE AI WORK
        </p>
        <h2 className="font-display font-extrabold text-center mb-3" style={{ color: "#fff", fontSize: "clamp(28px,3vw,40px)", letterSpacing: "-1px" }}>
          Watch AI create in real time.
        </h2>
        <p style={{ color: "#666", fontSize: 14, textAlign: "center", marginBottom: 48 }}>
          No plugins. No third-party apps. Built in.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 16, letterSpacing: "-0.5px" }}>Cover Art Generation</div>
            <TypingPrompt text={PROMPT_TEXT} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 16, letterSpacing: "-0.5px" }}>Mastering Before / After</div>
            <MasteringAB />
          </div>
        </div>

        <p style={{ fontSize: 13, color: "#666", textAlign: "center", marginTop: 48 }}>
          6 AI tools. All built in. No plugins. No third-party apps.
        </p>
      </div>
    </section>
  );
}
