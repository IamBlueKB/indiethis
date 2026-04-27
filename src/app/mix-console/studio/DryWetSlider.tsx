/**
 * DryWetSlider — horizontal mix slider on the channel strip.
 *
 * 0   = raw upload only (effects bypassed)
 * 100 = fully processed (current chain output) — the studio default
 *
 * Lazy-load behavior: useStudioAudio.setDryWet only fetches the raw
 * upload buffer the first time the user moves the slider, AND only
 * when an originalStems URL is provided that differs from the wet
 * URL. Until then the dry leg taps the wet source so the slider
 * effectively bypasses per-stem effects on first interaction.
 *
 * Visual: 14px tall track, color-fill from the dry side (left) toward
 * the thumb. Tiny "DRY / WET" labels above. Double-click resets to 100.
 */

"use client";

interface DryWetSliderProps {
  value:    number;                 // 0..100
  onChange: (v: number) => void;
  color:    string;
  label?:   string;
}

export function DryWetSlider({ value, onChange, color, label }: DryWetSliderProps) {
  const v = Math.max(0, Math.min(100, value));

  return (
    <div className="w-full flex flex-col items-center gap-0.5">
      <div
        className="w-full flex justify-between text-[8px] font-mono uppercase tracking-wider leading-none"
        style={{ color: "#666" }}
      >
        <span>DRY</span>
        <span>WET</span>
      </div>
      <div className="relative w-full" style={{ height: 14 }}>
        {/* Track */}
        <div
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full"
          style={{
            height:          4,
            backgroundColor: "#2A2A2A",
          }}
        />
        {/* Fill — grows from left (dry side) toward thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 rounded-full"
          style={{
            left:            0,
            width:           `${v}%`,
            height:          4,
            backgroundColor: color,
            opacity:         0.85,
          }}
        />
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={v}
          aria-label={label ?? "Dry/wet mix"}
          onChange={(e) => onChange(Number(e.target.value))}
          onDoubleClick={() => onChange(100)}
          className="absolute inset-0 w-full appearance-none bg-transparent cursor-pointer"
          style={{ height: 14 }}
        />
      </div>
    </div>
  );
}
