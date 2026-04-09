import type { Metadata } from "next";
import Link from "next/link";
import {
  Wand2, ImageIcon, Sliders, Film,
  BarChart3, FileText, Scissors, Sparkles, Shield, Users, ShieldCheck,
  ChevronRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "AI Tools — IndieThis",
  description: "All AI-powered tools for independent artists.",
};

// ── Premium tools — large card treatment ─────────────────────────────────────
const PREMIUM_TOOLS = [
  {
    label:       "Music Video Studio",
    description: "Turn your track into a full music video with AI-generated visuals and scene direction.",
    href:        "/dashboard/ai/video",
    icon:        Wand2,
    badge:       "Director + Quick mode",
    color:       "#D4A843",
  },
  {
    label:       "Cover Art Studio",
    description: "Generate stunning album artwork from a prompt in seconds.",
    href:        "/dashboard/ai/cover-art",
    icon:        ImageIcon,
    badge:       "Instant generation",
    color:       "#E85D4A",
  },
  {
    label:       "Lyric Video Studio",
    description: "Animated lyric videos with karaoke, kinetic, glitch, and handwritten styles.",
    href:        "/dashboard/ai/lyric-video",
    icon:        Film,
    badge:       "5 animation styles",
    color:       "#7C6AF7",
  },
  {
    label:       "Mix & Master",
    description: "Upload a stereo mix or stems — get 4 mastered versions with platform-ready exports.",
    href:        "/dashboard/ai/master",
    icon:        Sliders,
    badge:       "6 download formats",
    color:       "#D4A843",
  },
];

// ── Utility tools — compact grid ─────────────────────────────────────────────
const UTILITY_TOOLS = [
  { label: "A&R Report",        href: "/dashboard/ai/ar-report",        icon: BarChart3    },
  { label: "Press Kit",         href: "/dashboard/ai/press-kit",        icon: FileText     },
  { label: "Vocal Remover",     href: "/dashboard/ai/vocal-remover",    icon: Scissors     },
  { label: "Bio Generator",     href: "/dashboard/ai/bio-generator",    icon: Sparkles     },
  { label: "Contract Scanner",  href: "/dashboard/ai/contract-scanner", icon: Shield       },
  { label: "Split Sheets",      href: "/dashboard/ai/split-sheet",      icon: Users        },
  { label: "Track Shield",      href: "/dashboard/ai/track-shield",     icon: ShieldCheck  },
];

export default function AIToolsHubPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">AI Tools</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          Every AI-powered tool in your studio, in one place.
        </p>
      </div>

      {/* Premium tools grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        {PREMIUM_TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.href}
              href={tool.href}
              className="group flex flex-col gap-4 p-5 rounded-2xl border transition-all no-underline hover:border-[var(--accent)]"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              {/* Icon + badge row */}
              <div className="flex items-start justify-between">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${tool.color}18`, border: `1px solid ${tool.color}30` }}
                >
                  <Icon size={18} style={{ color: tool.color }} />
                </div>
                <span
                  className="text-[10px] font-semibold px-2 py-1 rounded-full"
                  style={{ backgroundColor: `${tool.color}15`, color: tool.color }}
                >
                  {tool.badge}
                </span>
              </div>

              {/* Text */}
              <div className="flex-1">
                <p className="font-semibold text-sm mb-1">{tool.label}</p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                  {tool.description}
                </p>
              </div>

              {/* CTA */}
              <div
                className="flex items-center gap-1 text-xs font-semibold transition-colors group-hover:opacity-100 opacity-70"
                style={{ color: tool.color }}
              >
                Open studio <ChevronRight size={13} />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Utility tools section */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--muted-foreground)" }}>
          Utility Tools
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {UTILITY_TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.href}
                href={tool.href}
                className="flex items-center gap-3 p-3.5 rounded-xl border transition-all no-underline hover:border-[var(--accent)] text-sm font-medium"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                <Icon size={15} strokeWidth={1.75} style={{ color: "var(--accent)", flexShrink: 0 }} />
                {tool.label}
              </Link>
            );
          })}
        </div>
      </div>

    </div>
  );
}
