"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export type EquipmentItem = {
  id: string;
  category: string;
  name: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  CONSOLE:     "Consoles",
  MONITORS:    "Monitors",
  MICROPHONES: "Microphones",
  OUTBOARD:    "Outboard Gear",
  DAW:         "DAW & Software",
  OTHER:       "Other",
};

const CATEGORY_ORDER = ["CONSOLE", "MONITORS", "MICROPHONES", "OUTBOARD", "DAW", "OTHER"];

interface Props {
  equipment: EquipmentItem[];
  accent?: string;
  dark?: boolean;
}

function EquipmentGroup({
  category, items, accent, dark,
}: {
  category: string; items: EquipmentItem[]; accent: string; dark: boolean;
}) {
  const [open, setOpen] = useState(true);
  const textColor  = dark ? "#ffffff" : "#0A0A0A";
  const subColor   = dark ? "rgba(255,255,255,0.55)" : "#555555";
  const groupBg    = dark ? "rgba(255,255,255,0.03)" : "#F9F9F9";
  const groupBorder = dark ? "rgba(255,255,255,0.08)" : "#E5E5E5";

  return (
    <div style={{ border: `1px solid ${groupBorder}`, borderRadius: 10, overflow: "hidden" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0.9rem 1.1rem", backgroundColor: groupBg,
          border: "none", cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: accent, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            {CATEGORY_LABELS[category] ?? category}
          </span>
          <span style={{ fontSize: "0.72rem", color: subColor }}>
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        </div>
        {open
          ? <ChevronUp size={14} color={subColor} />
          : <ChevronDown size={14} color={subColor} />
        }
      </button>

      {open && (
        <div style={{ padding: "0.25rem 0 0.75rem" }}>
          {items.map((item, i) => (
            <div key={item.id} style={{
              padding: "0.5rem 1.1rem",
              borderTop: i === 0 ? `1px solid ${groupBorder}` : "none",
              display: "flex", alignItems: "center", gap: "0.6rem",
            }}>
              <span style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: accent, flexShrink: 0 }} />
              <span style={{ fontSize: "0.875rem", color: textColor }}>{item.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function EquipmentSection({ equipment, accent = "#D4A843", dark = true }: Props) {
  if (!equipment.length) return null;

  const textColor = dark ? "#ffffff" : "#0A0A0A";

  // Group by category, maintaining order
  const grouped = CATEGORY_ORDER.reduce<Record<string, EquipmentItem[]>>((acc, cat) => {
    const items = equipment.filter((e) => e.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  // Include any unexpected categories not in the order list
  for (const item of equipment) {
    if (!CATEGORY_ORDER.includes(item.category)) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }
  }

  return (
    <section id="gear">
      <p style={{
        fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.2em",
        textTransform: "uppercase", color: accent, marginBottom: "1.25rem",
      }}>
        GEAR
      </p>
      <h2 style={{
        fontSize: "clamp(1.6rem, 4vw, 2.5rem)", fontWeight: 700,
        letterSpacing: "-0.02em", color: textColor, marginBottom: "2.5rem", lineHeight: 1.1,
      }}>
        Equipment
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {Object.entries(grouped).map(([cat, items]) => (
          <EquipmentGroup key={cat} category={cat} items={items} accent={accent} dark={dark} />
        ))}
      </div>
    </section>
  );
}
