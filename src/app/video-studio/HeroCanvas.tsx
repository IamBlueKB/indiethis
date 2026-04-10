"use client";

import { useRef, useEffect } from "react";

// ─── Scene definitions ──────────────────────────────────────────────────────

type DrawFn = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  fade: number // 0→1 fade-in, 1 hold, 1→0 fade-out (combined alpha multiplier)
) => void;

const SCENE_DURATION = 4000; // ms each scene holds
const TRANSITION_MS  = 600;  // ms cross-fade

// Seeded simple random for stable smoke/particles per scene
function seededRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

// ─── Scene 1: Cinematic Noir — spotlight + rising smoke ─────────────────────

function drawNoir(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, fade: number) {
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#020204";
  ctx.fillRect(0, 0, w, h);

  // Spotlight cone from top-center
  const cx = w * 0.52;
  const grad = ctx.createRadialGradient(cx, 0, 0, cx, h * 0.9, h * 0.95);
  grad.addColorStop(0,    `rgba(255,240,190,${0.18 * fade})`);
  grad.addColorStop(0.25, `rgba(255,240,190,${0.07 * fade})`);
  grad.addColorStop(1,    "transparent");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Slow horizontal sweep of spotlight (very subtle)
  const sweep = Math.sin(t * 0.0003) * 0.04 * w;
  const sg = ctx.createRadialGradient(cx + sweep, h * 0.08, 0, cx + sweep, h * 0.5, w * 0.35);
  sg.addColorStop(0,   `rgba(255,245,200,${0.09 * fade})`);
  sg.addColorStop(0.5, `rgba(255,245,200,${0.02 * fade})`);
  sg.addColorStop(1,   "transparent");
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, w, h);

  // Smoke particles rising
  const rng = seededRandom(42);
  const PARTICLES = 28;
  for (let i = 0; i < PARTICLES; i++) {
    const px  = rng() * w;
    const baseY = h * (0.3 + rng() * 0.7);
    const speed = 0.012 + rng() * 0.018;
    const py  = ((baseY - t * speed * (0.5 + rng() * 0.5)) % h + h) % h;
    const r   = 3 + rng() * 12;
    const a   = (0.04 + rng() * 0.08) * fade;
    const sg2 = ctx.createRadialGradient(px, py, 0, px, py, r * 3);
    sg2.addColorStop(0, `rgba(200,200,220,${a})`);
    sg2.addColorStop(1, "transparent");
    ctx.fillStyle = sg2;
    ctx.beginPath();
    ctx.arc(px, py, r * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Floor reflection line
  ctx.globalAlpha = 0.12 * fade;
  const refGrad = ctx.createLinearGradient(cx - 60, h * 0.78, cx + 60, h * 0.78);
  refGrad.addColorStop(0, "transparent");
  refGrad.addColorStop(0.5, "rgba(255,240,190,0.9)");
  refGrad.addColorStop(1, "transparent");
  ctx.fillStyle = refGrad;
  ctx.fillRect(cx - 60, h * 0.78, 120, 2);
  ctx.globalAlpha = 1;
}

// ─── Scene 2: Neon City — rain streaks + neon glow ─────────────────────────

function drawNeonCity(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, fade: number) {
  ctx.globalAlpha = 1;
  // Deep navy-black
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#020208");
  bg.addColorStop(1, "#040412");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Neon glow pools on "wet street"
  const glows = [
    { x: w * 0.2, col: "0,200,255",   r: w * 0.3, a: 0.06 },
    { x: w * 0.7, col: "200,0,255",   r: w * 0.25, a: 0.05 },
    { x: w * 0.5, col: "255,60,120",  r: w * 0.2, a: 0.04 },
  ];
  glows.forEach(g => {
    const pulse = 1 + Math.sin(t * 0.001 + g.x) * 0.15;
    const gg = ctx.createRadialGradient(g.x, h * 0.65, 0, g.x, h * 0.65, g.r * pulse);
    gg.addColorStop(0, `rgba(${g.col},${g.a * fade})`);
    gg.addColorStop(1, "transparent");
    ctx.fillStyle = gg;
    ctx.fillRect(0, 0, w, h);
  });

  // Rain streaks
  const rng = seededRandom(77);
  const DROPS = 60;
  for (let i = 0; i < DROPS; i++) {
    const rx  = rng() * w;
    const spd = 0.08 + rng() * 0.12;
    const ry  = ((rng() * h + t * spd) % h);
    const len = 8 + rng() * 16;
    const a   = (0.15 + rng() * 0.2) * fade;
    const hue = rng() > 0.5 ? "100,180,255" : "180,100,255";
    ctx.strokeStyle = `rgba(${hue},${a})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx - 1, ry + len);
    ctx.stroke();
  }

  // Street reflection (mirror of glow at bottom)
  const refGrad = ctx.createLinearGradient(0, h * 0.6, 0, h);
  refGrad.addColorStop(0, `rgba(0,180,255,${0.03 * fade})`);
  refGrad.addColorStop(0.5, `rgba(180,0,255,${0.04 * fade})`);
  refGrad.addColorStop(1, "transparent");
  ctx.fillStyle = refGrad;
  ctx.fillRect(0, h * 0.6, w, h * 0.4);

  // Horizontal light streaks (moving cars)
  const STREAKS = 3;
  const rng2 = seededRandom(99);
  for (let i = 0; i < STREAKS; i++) {
    const sy  = h * (0.55 + rng2() * 0.25);
    const sx  = ((t * (0.04 + rng2() * 0.04) + rng2() * w) % (w + 200)) - 100;
    const slen = 60 + rng2() * 80;
    const sg  = ctx.createLinearGradient(sx, sy, sx + slen, sy);
    sg.addColorStop(0, "transparent");
    sg.addColorStop(0.5, `rgba(255,255,255,${0.4 * fade})`);
    sg.addColorStop(1, "transparent");
    ctx.fillStyle = sg;
    ctx.fillRect(sx, sy - 1, slen, 2);
  }
}

// ─── Scene 3: 808 Drop — particle explosion ─────────────────────────────────

function drawDrop(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, fade: number) {
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2;
  const cycle = (t % 1400) / 1400; // repeating pulse every 1.4s

  // Expanding shockwave rings
  [0, 0.33, 0.66].forEach(offset => {
    const c = (cycle + offset) % 1;
    const r = c * Math.min(w, h) * 0.7;
    const a = (1 - c) * 0.3 * fade;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(212,168,67,${a})`;
    ctx.lineWidth = 2 - c * 1.5;
    ctx.stroke();

    // Inner white ring
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${a * 0.4})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Burst particles flying outward
  const rng = seededRandom(13);
  const PARTS = 50;
  for (let i = 0; i < PARTS; i++) {
    const angle  = rng() * Math.PI * 2;
    const speed  = 0.3 + rng() * 0.7;
    const c2     = (cycle + rng() * 0.5) % 1;
    const dist   = c2 * speed * Math.min(w, h) * 0.5;
    const px     = cx + Math.cos(angle) * dist;
    const py     = cy + Math.sin(angle) * dist;
    const r2     = (1 - c2) * (2 + rng() * 3);
    const a2     = (1 - c2) * (0.5 + rng() * 0.4) * fade;
    const warm   = rng() > 0.4;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(0.5, r2), 0, Math.PI * 2);
    ctx.fillStyle = warm
      ? `rgba(212,168,67,${a2})`
      : `rgba(255,255,255,${a2 * 0.6})`;
    ctx.fill();
  }

  // Pulsing center glow
  const pulse = 0.7 + Math.sin(cycle * Math.PI * 2) * 0.3;
  const cGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40 * pulse);
  cGrad.addColorStop(0, `rgba(255,240,180,${0.9 * fade})`);
  cGrad.addColorStop(0.4, `rgba(212,168,67,${0.3 * fade})`);
  cGrad.addColorStop(1, "transparent");
  ctx.fillStyle = cGrad;
  ctx.fillRect(0, 0, w, h);
}

// ─── Scene 4: Lo-Fi Dreamy — bokeh circles + soft vignette ─────────────────

function drawDreamy(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, fade: number) {
  ctx.globalAlpha = 1;
  // Warm dark background
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#080509");
  bg.addColorStop(1, "#060408");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Floating bokeh circles
  const rng = seededRandom(55);
  const BOKEH = 22;
  for (let i = 0; i < BOKEH; i++) {
    const bx  = rng() * w;
    const by  = rng() * h;
    const spd = 0.005 + rng() * 0.008;
    const py  = by + Math.sin(t * spd + i) * 12;
    const r   = 8 + rng() * 36;
    const a   = (0.04 + rng() * 0.06) * fade;
    const warm = rng() > 0.5;
    const col = warm ? `180,120,60` : `100,80,180`;
    const bg2 = ctx.createRadialGradient(bx, py, 0, bx, py, r);
    bg2.addColorStop(0,   `rgba(${col},${a * 2})`);
    bg2.addColorStop(0.4, `rgba(${col},${a})`);
    bg2.addColorStop(1,   "transparent");
    ctx.fillStyle = bg2;
    ctx.beginPath();
    ctx.arc(bx, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Horizontal haze line (like light through dusty air)
  const hazeY = h * (0.4 + Math.sin(t * 0.0004) * 0.08);
  const hazeGrad = ctx.createLinearGradient(0, hazeY - 30, 0, hazeY + 30);
  hazeGrad.addColorStop(0,   "transparent");
  hazeGrad.addColorStop(0.5, `rgba(200,160,80,${0.05 * fade})`);
  hazeGrad.addColorStop(1,   "transparent");
  ctx.fillStyle = hazeGrad;
  ctx.fillRect(0, hazeY - 30, w, 60);

  // Vignette
  const vig = ctx.createRadialGradient(w/2, h/2, h * 0.2, w/2, h/2, h * 0.75);
  vig.addColorStop(0, "transparent");
  vig.addColorStop(1, `rgba(0,0,0,${0.55 * fade})`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

// ─── Scene registry ─────────────────────────────────────────────────────────

const SCENES: { label: string; sub: string; draw: DrawFn }[] = [
  { label: "Cinematic Noir",  sub: "Scene type · Performance",  draw: drawNoir      },
  { label: "Neon City",       sub: "Scene type · Urban",        draw: drawNeonCity  },
  { label: "808 Drop",        sub: "Scene type · Abstract",     draw: drawDrop      },
  { label: "Lo-Fi Dreamy",    sub: "Scene type · Atmospheric",  draw: drawDreamy    },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state     = useRef({ startTime: 0, raf: 0, sceneIdx: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    state.current.startTime = performance.now();

    function draw(now: number) {
      const el   = now - state.current.startTime;
      const total = SCENE_DURATION + TRANSITION_MS;
      const slot  = Math.floor(el / total);
      const pos   = el % total;

      const sceneIdx = slot % SCENES.length;
      const nextIdx  = (sceneIdx + 1) % SCENES.length;
      state.current.sceneIdx = sceneIdx;

      const w = canvas!.width;
      const h = canvas!.height;

      // Determine fade value
      let fade = 1;
      if (pos < TRANSITION_MS) {
        fade = pos / TRANSITION_MS;
      } else if (pos > SCENE_DURATION - TRANSITION_MS) {
        fade = (total - pos) / TRANSITION_MS;
      }

      // Draw current scene
      ctx!.globalAlpha = 1;
      SCENES[sceneIdx].draw(ctx!, w, h, el, fade);

      // Cross-fade next scene during transition
      if (pos > SCENE_DURATION - TRANSITION_MS) {
        const nextFade = 1 - fade;
        ctx!.globalAlpha = nextFade;
        // Draw next scene into offscreen? For simplicity, overlay with alpha
        const savedComposite = ctx!.globalCompositeOperation;
        ctx!.globalCompositeOperation = "source-over";
        SCENES[nextIdx].draw(ctx!, w, h, el, nextFade);
        ctx!.globalCompositeOperation = savedComposite;
        ctx!.globalAlpha = 1;
      }

      // Film grain (subtle)
      ctx!.globalAlpha = 0.025;
      ctx!.fillStyle = ctx!.createPattern
        ? (() => {
            // Use noise via random pixel overlay every frame
            const noise = ctx!.createImageData(w, h);
            for (let i = 0; i < noise.data.length; i += 4) {
              const v = Math.random() * 255 | 0;
              noise.data[i] = noise.data[i+1] = noise.data[i+2] = v;
              noise.data[i+3] = 40;
            }
            return noise;
          })()
        : null;

      // Simpler grain: scattered dots
      ctx!.globalAlpha = 0.018;
      for (let i = 0; i < 800; i++) {
        const gx = Math.random() * w;
        const gy = Math.random() * h;
        const gv = Math.random() * 255 | 0;
        ctx!.fillStyle = `rgb(${gv},${gv},${gv})`;
        ctx!.fillRect(gx, gy, 1, 1);
      }
      ctx!.globalAlpha = 1;

      // Scene label overlay
      const scene = SCENES[sceneIdx];
      const labelAlpha = fade;

      // Label background pill
      ctx!.globalAlpha = 0.7 * labelAlpha;
      ctx!.fillStyle = "rgba(0,0,0,0.6)";
      const lx = 12, ly = h - 42;
      ctx!.beginPath();
      (ctx as CanvasRenderingContext2D & { roundRect?: Function }).roundRect?.(lx, ly, 160, 34, 8) ??
        ctx!.rect(lx, ly, 160, 34);
      ctx!.fill();

      // Live indicator dot
      ctx!.globalAlpha = labelAlpha;
      ctx!.fillStyle = "#D4A843";
      ctx!.beginPath();
      ctx!.arc(lx + 10, ly + 17, 3, 0, Math.PI * 2);
      ctx!.fill();

      ctx!.fillStyle = "#fff";
      ctx!.font = "bold 11px system-ui, sans-serif";
      ctx!.fillText(scene.label, lx + 20, ly + 13);
      ctx!.fillStyle = "rgba(255,255,255,0.5)";
      ctx!.font = "9px system-ui, sans-serif";
      ctx!.fillText(scene.sub, lx + 20, ly + 27);
      ctx!.globalAlpha = 1;

      // Scene progress dots (bottom right)
      SCENES.forEach((_, i) => {
        const dx = w - (SCENES.length - i) * 14 - 6;
        const dy = h - 10;
        ctx!.beginPath();
        ctx!.arc(dx, dy, i === sceneIdx ? 3.5 : 2.5, 0, Math.PI * 2);
        ctx!.fillStyle = i === sceneIdx
          ? `rgba(212,168,67,${0.9 * labelAlpha})`
          : "rgba(255,255,255,0.25)";
        ctx!.fill();
      });

      state.current.raf = requestAnimationFrame(draw);
    }

    state.current.raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(state.current.raf);
  }, []);

  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-white/10 hidden sm:block"
      style={{
        width: 340,
        height: 220,
        flexShrink: 0,
        boxShadow: "0 0 60px rgba(212,168,67,0.08), 0 8px 40px rgba(0,0,0,0.7)",
      }}
    >
      <canvas
        ref={canvasRef}
        width={340}
        height={220}
        className="w-full h-full"
        style={{ display: "block" }}
      />
      {/* Top bar — simulated video studio UI chrome */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 py-2"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)" }}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500/70" />
          <div className="w-2 h-2 rounded-full bg-yellow-500/70" />
          <div className="w-2 h-2 rounded-full bg-green-500/70" />
        </div>
        <span className="text-[9px] font-semibold" style={{ color: "rgba(212,168,67,0.8)" }}>
          AI · GENERATING
        </span>
      </div>
    </div>
  );
}
