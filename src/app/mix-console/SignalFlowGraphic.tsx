"use client";

const NODES = ["Clean", "Shape", "Pitch", "Effects", "Mix"];
const GOLD  = "#D4A843";
const GREY  = "#555";
const CORAL = "#E8735A";

// Raw waveform points (grey — rougher, more dynamic)
const RAW_WAVE = [
  0.3, 0.5, 0.7, 0.4, 0.9, 0.6, 0.3, 0.8, 0.5, 0.7,
  0.2, 0.6, 0.95, 0.4, 0.7, 0.3, 0.8, 0.55, 0.4, 0.85,
  0.3, 0.65, 0.5, 0.75, 0.35, 0.9, 0.45, 0.6, 0.25, 0.7,
];

// Polished waveform points (gold — smoother, more controlled)
const GOLD_WAVE = [
  0.4, 0.55, 0.65, 0.5, 0.75, 0.6, 0.45, 0.72, 0.55, 0.68,
  0.42, 0.62, 0.78, 0.52, 0.68, 0.46, 0.72, 0.58, 0.5, 0.74,
  0.44, 0.62, 0.54, 0.70, 0.48, 0.76, 0.52, 0.62, 0.44, 0.68,
];

function Waveform({ points, color, height = 40 }: { points: number[]; color: string; height?: number }) {
  const w = 320;
  const mid = height / 2;
  const pts = points.length;

  const top = points.map((v, i) => `${(i / (pts - 1)) * w},${mid - v * (mid - 3)}`).join(" ");
  const bot = [...points].reverse().map((v, i) => `${((pts - 1 - i) / (pts - 1)) * w},${mid + v * (mid - 3)}`).join(" ");

  return (
    <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={`wfGrad-${color.replace("#","")}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity={0.0} />
          <stop offset="15%" stopColor={color} stopOpacity={0.8} />
          <stop offset="85%" stopColor={color} stopOpacity={0.8} />
          <stop offset="100%" stopColor={color} stopOpacity={0.0} />
        </linearGradient>
      </defs>
      {/* Fill */}
      <polygon
        points={`${top} ${bot}`}
        fill={color}
        fillOpacity={0.08}
      />
      {/* Top edge */}
      <polyline
        points={top}
        fill="none"
        stroke={`url(#wfGrad-${color.replace("#","")})`}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* Bottom edge */}
      <polyline
        points={bot}
        fill="none"
        stroke={`url(#wfGrad-${color.replace("#","")})`}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function SignalFlowGraphic() {
  return (
    <>
      <style>{`
        @keyframes coralPulse {
          0%, 100% { box-shadow: 0 0 8px 2px rgba(232,115,90,0.25); }
          50%       { box-shadow: 0 0 22px 6px rgba(232,115,90,0.55); }
        }
        @keyframes dashFlow {
          to { stroke-dashoffset: -24; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .node-pulse-0 { animation: coralPulse 2s ease-in-out infinite 0.0s; }
        .node-pulse-1 { animation: coralPulse 2s ease-in-out infinite 0.3s; }
        .node-pulse-2 { animation: coralPulse 2s ease-in-out infinite 0.6s; }
        .node-pulse-3 { animation: coralPulse 2s ease-in-out infinite 0.9s; }
        .node-pulse-4 { animation: coralPulse 2s ease-in-out infinite 1.2s; }
        .dash-flow    { animation: dashFlow 1.2s linear infinite; }
      `}</style>

      <div
        className="rounded-2xl px-6 py-10 flex flex-col items-center gap-0"
        style={{ backgroundColor: "#0f0f0f", border: "1px solid #1A1A1A" }}
      >
        {/* ── Raw waveform ── */}
        <div className="flex flex-col items-center gap-1 w-full max-w-sm">
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: GREY }}>Raw Recording</span>
          <Waveform points={RAW_WAVE} color={GREY} height={44} />
        </div>

        {/* ── Top connector: waveform center-bottom → first node (Clean) left side ── */}
        <svg width="320" height="40" viewBox="0 0 320 40" style={{ display: "block", overflow: "visible" }}>
          {/* Bezier from waveform center (160,0) curving down-left to Clean node center (22,40) */}
          <path
            d="M 160,0 C 160,28 22,12 22,40"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={1}
          />
        </svg>

        {/* ── Processing nodes ── */}
        <div className="flex items-center gap-0 w-full max-w-sm justify-between relative">

          {/* Dashed connector line behind nodes */}
          <svg
            style={{ position: "absolute", top: "50%", left: 0, right: 0, transform: "translateY(-50%)", width: "100%", height: 2, overflow: "visible", pointerEvents: "none" }}
            viewBox="0 0 320 2"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="connectorGrad" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%"   stopColor={GREY}  stopOpacity={0.5} />
                <stop offset="100%" stopColor={GOLD}  stopOpacity={0.5} />
              </linearGradient>
            </defs>
            <line
              x1="0" y1="1" x2="320" y2="1"
              stroke="url(#connectorGrad)"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              className="dash-flow"
            />
          </svg>

          {NODES.map((label, i) => (
            <div key={label} className="flex flex-col items-center gap-1.5 relative z-10">
              {/* Node circle */}
              <div
                className={`node-pulse-${i} flex items-center justify-center rounded-full`}
                style={{
                  width:  44,
                  height: 44,
                  backgroundColor: "#0A0A0A",
                  border: `1.5px solid ${CORAL}`,
                  flexShrink: 0,
                }}
              >
                <NodeIcon label={label} />
              </div>
              <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "#666" }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* ── Bottom connector: last node (Mix) right side → waveform center-top ── */}
        <svg width="320" height="40" viewBox="0 0 320 40" style={{ display: "block", overflow: "visible" }}>
          {/* Bezier from Mix node center (298,0) curving down-right to waveform center (160,40) */}
          <path
            d="M 298,0 C 298,28 160,12 160,40"
            fill="none"
            stroke="rgba(212,175,55,0.2)"
            strokeWidth={1}
          />
        </svg>

        {/* ── Gold waveform ── */}
        <div className="flex flex-col items-center gap-1 w-full max-w-sm">
          <Waveform points={GOLD_WAVE} color={GOLD} height={44} />
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: GOLD }}>Radio Ready</span>
        </div>

        {/* ── Tagline ── */}
        <p className="mt-6 text-sm font-medium text-center" style={{ color: "#666" }}>
          From raw recording to radio-ready in minutes.
        </p>
      </div>
    </>
  );
}

function NodeIcon({ label }: { label: string }) {
  const s = { stroke: CORAL, strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  if (label === "Clean") return (
    <svg width="16" height="16" viewBox="0 0 24 24" {...s}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
      <path d="M8 12l3 3 5-5"/>
    </svg>
  );
  if (label === "Shape") return (
    <svg width="16" height="16" viewBox="0 0 24 24" {...s}>
      <path d="M2 12 Q6 4 12 12 Q18 20 22 12"/>
    </svg>
  );
  if (label === "Pitch") return (
    <svg width="16" height="16" viewBox="0 0 24 24" {...s}>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <polyline points="6,10 12,4 18,10"/>
    </svg>
  );
  if (label === "Effects") return (
    <svg width="16" height="16" viewBox="0 0 24 24" {...s}>
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
    </svg>
  );
  // Mix
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" {...s}>
      <line x1="4" y1="21" x2="4" y2="14"/>
      <line x1="4" y1="10" x2="4" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12" y2="3"/>
      <line x1="20" y1="21" x2="20" y2="16"/>
      <line x1="20" y1="12" x2="20" y2="3"/>
      <line x1="1" y1="14" x2="7" y2="14"/>
      <line x1="9" y1="8" x2="15" y2="8"/>
      <line x1="17" y1="16" x2="23" y2="16"/>
    </svg>
  );
}
