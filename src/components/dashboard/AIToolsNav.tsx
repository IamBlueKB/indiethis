"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wand2, Image, Music, Film, BarChart3, FileText, Scissors, Sparkles, Shield, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const tools = [
  { label: "AI Video",         href: "/dashboard/ai/video",            icon: Wand2     },
  { label: "Cover Art",        href: "/dashboard/ai/cover-art",        icon: Image     },
  { label: "Mastering",        href: "/dashboard/ai/mastering",        icon: Music     },
  { label: "Lyric Video",      href: "/dashboard/ai/lyric-video",      icon: Film      },
  { label: "A&R Report",       href: "/dashboard/ai/ar-report",        icon: BarChart3 },
  { label: "Press Kit",        href: "/dashboard/ai/press-kit",        icon: FileText  },
  { label: "Vocal Remover",    href: "/dashboard/ai/vocal-remover",    icon: Scissors  },
  { label: "Bio Generator",    href: "/dashboard/ai/bio-generator",    icon: Sparkles  },
  { label: "Contract Scanner", href: "/dashboard/ai/contract-scanner", icon: Shield    },
  { label: "Split Sheets",    href: "/dashboard/ai/split-sheet",      icon: Users     },
];

export function AIToolsNav() {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap gap-1 p-1 rounded-xl border mb-6"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      {tools.map((t) => {
        const Icon = t.icon;
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all no-underline flex-1 justify-center whitespace-nowrap",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            style={active ? { backgroundColor: "var(--background)" } : {}}
          >
            <Icon size={14} strokeWidth={active ? 2.25 : 1.75} />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
