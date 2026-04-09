"use client";

/**
 * StylePlaceholder — renders a gradient/shape preview for a CoverArtStyle
 * when no previewUrl image exists.
 */

const STYLE_GRADIENTS: Record<string, string> = {
  // Minimal
  "Minimalist Typography": "linear-gradient(135deg, #1a1a1a 0%, #2e2e2e 50%, #1a1a1a 100%)",
  "Monochrome Film":       "linear-gradient(160deg, #0d0d0d 0%, #3a3a3a 50%, #111 100%)",
  "Clean Gradient":        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  // Dark
  "Dark & Gritty":         "linear-gradient(160deg, #0a0a0a 0%, #1c1c1c 60%, #2a1a0a 100%)",
  "Smoke & Shadow":        "linear-gradient(160deg, #050505 0%, #1a1a2e 50%, #0a0a0a 100%)",
  "Gothic Portrait":       "linear-gradient(135deg, #0d0d0d 0%, #1a0a0a 50%, #2a1800 100%)",
  // Vibrant
  "Vibrant Illustrated":   "linear-gradient(135deg, #f093fb 0%, #f5576c 50%, #fda085 100%)",
  "Neon Futuristic":       "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
  "Psychedelic":           "linear-gradient(135deg, #f7971e 0%, #ffd200 25%, #f5576c 50%, #a855f7 75%, #06b6d4 100%)",
  // Classic
  "Vintage Vinyl":         "linear-gradient(135deg, #3e2723 0%, #6d4c41 50%, #8d6e63 100%)",
  "Street Photography":    "linear-gradient(160deg, #2c2c2c 0%, #4a4a4a 50%, #1a1a1a 100%)",
  "Photo-Real Portrait":   "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
  // Experimental
  "Abstract Geometric":    "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
  "Collage Mixed Media":   "linear-gradient(135deg, #c94b4b 0%, #4b134f 50%, #c94b4b 100%)",
  "Watercolor Dreamy":     "linear-gradient(135deg, #a8edea 0%, #fed6e3 50%, #ffecd2 100%)",
};

const CATEGORY_FALLBACKS: Record<string, string> = {
  MINIMAL:      "linear-gradient(135deg, #1e1e1e, #2e2e2e)",
  DARK:         "linear-gradient(135deg, #090909, #1a1a1a)",
  VIBRANT:      "linear-gradient(135deg, #f093fb, #f5576c)",
  CLASSIC:      "linear-gradient(135deg, #3e2723, #6d4c41)",
  EXPERIMENTAL: "linear-gradient(135deg, #0f2027, #2c5364)",
};

export default function StylePlaceholder({
  name,
  category,
  className = "absolute inset-0",
}: {
  name:      string;
  category:  string;
  className?: string;
}) {
  const bg = STYLE_GRADIENTS[name] ?? CATEGORY_FALLBACKS[category] ?? "linear-gradient(135deg,#1a1a1a,#2a2a2a)";

  const shapes =
    category === "MINIMAL" ? (
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 opacity-20">
        <rect x="15" y="15" width="70" height="70" fill="none" stroke="white" strokeWidth="1.5" />
        <line x1="15" y1="50" x2="85" y2="50" stroke="white" strokeWidth="0.75" />
      </svg>
    ) : category === "DARK" ? (
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 opacity-25">
        <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
        <circle cx="50" cy="50" r="20" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.75" />
      </svg>
    ) : category === "VIBRANT" ? (
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 opacity-30">
        <polygon points="50,5 95,80 5,80" fill="none" stroke="white" strokeWidth="1.5" />
        <polygon points="50,20 82,75 18,75" fill="rgba(255,255,255,0.1)" stroke="none" />
      </svg>
    ) : category === "CLASSIC" ? (
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 opacity-20">
        <ellipse cx="50" cy="50" rx="35" ry="42" fill="none" stroke="rgba(255,220,150,0.6)" strokeWidth="1.5" />
        <line x1="15" y1="50" x2="85" y2="50" stroke="rgba(255,220,150,0.3)" strokeWidth="0.75" />
        <line x1="50" y1="8" x2="50" y2="92" stroke="rgba(255,220,150,0.3)" strokeWidth="0.75" />
      </svg>
    ) : category === "EXPERIMENTAL" ? (
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 opacity-25">
        <polygon points="20,20 80,20 90,80 10,80" fill="none" stroke="white" strokeWidth="1.2" />
        <line x1="20" y1="20" x2="90" y2="80" stroke="rgba(255,255,255,0.3)" strokeWidth="0.75" />
        <line x1="80" y1="20" x2="10" y2="80" stroke="rgba(255,255,255,0.3)" strokeWidth="0.75" />
      </svg>
    ) : null;

  return (
    <div className={className} style={{ background: bg }}>
      {shapes}
    </div>
  );
}
