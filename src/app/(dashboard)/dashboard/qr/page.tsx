"use client";

import { useEffect, useState } from "react";
import {
  QrCode, Download, Scan, TrendingUp, Copy, Check,
  Printer, ShoppingBag, Sticker, FileImage, Loader2,
} from "lucide-react";
import { useArtistSite } from "@/hooks/queries";

// ─── Types ────────────────────────────────────────────────────────────────────

type QrStats = {
  total:   number;
  last30d: number;
};

// ─── Use-case card ────────────────────────────────────────────────────────────

function UseCase({
  icon: Icon,
  title,
  desc,
  color,
}: {
  icon:  React.ElementType;
  title: string;
  desc:  string;
  color: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}15`, color }}
      >
        <Icon size={17} />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QrCodePage() {
  const { data, isLoading: siteLoading } = useArtistSite();
  const slug    = data?.slug ?? null;
  const isLive  = data?.site?.isPublished && !data?.site?.draftMode;

  const [stats,        setStats]        = useState<QrStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [pngLoaded,    setPngLoaded]    = useState(false);
  const [copied,       setCopied]       = useState(false);
  const [format,       setFormat]       = useState<"png" | "svg">("png");

  // ── Load QR scan stats ─────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/dashboard/analytics")
      .then((r) => r.json())
      .then((d) => {
        if (d.qrScans) setStats(d.qrScans);
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  // ── Copy page URL ──────────────────────────────────────────────────────────
  function copyUrl() {
    if (!slug) return;
    const url = `${window.location.origin}/${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (siteLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={22} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!slug || !isLive) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div
          className="rounded-2xl border py-16 text-center space-y-3"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <QrCode size={40} className="mx-auto text-muted-foreground opacity-40" />
          <p className="text-sm font-semibold text-foreground">Publish your artist page first</p>
          <p className="text-xs text-muted-foreground">
            Your QR code is generated once your artist page is live.
          </p>
        </div>
      </div>
    );
  }

  const pageUrl   = `${typeof window !== "undefined" ? window.location.origin : ""}/${slug}`;
  const pngUrl    = "/api/dashboard/qr-code?format=png";
  const dlPng     = `/api/dashboard/qr-code?format=png&download=1`;
  const dlSvg     = `/api/dashboard/qr-code?format=svg&download=1`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 pb-12">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(212,168,67,0.10)" }}
        >
          <QrCode size={17} className="text-accent" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">QR Code</h1>
          <p className="text-xs text-muted-foreground">Your artist page link in scannable form</p>
        </div>
      </div>

      {/* ── Main card: QR + downloads ───────────────────────────────────────── */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="flex flex-col sm:flex-row gap-0">

          {/* QR preview */}
          <div
            className="sm:w-72 flex items-center justify-center p-8"
            style={{ backgroundColor: "rgba(255,255,255,0.02)", borderRight: "1px solid var(--border)" }}
          >
            <div
              className="rounded-2xl overflow-hidden shadow-2xl"
              style={{
                backgroundColor: "white",
                padding:          "16px",
                width:            "220px",
                height:           "220px",
                display:          "flex",
                alignItems:       "center",
                justifyContent:   "center",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={format}
                src={pngUrl}
                alt="Your artist page QR code"
                width={188}
                height={188}
                onLoad={() => setPngLoaded(true)}
                className={`w-full h-full object-contain transition-opacity duration-300 ${pngLoaded ? "opacity-100" : "opacity-0"}`}
              />
              {!pngLoaded && (
                <div className="absolute flex items-center justify-center w-[188px] h-[188px]">
                  <Loader2 size={24} className="animate-spin text-black/20" />
                </div>
              )}
            </div>
          </div>

          {/* Info + downloads */}
          <div className="flex-1 p-6 space-y-5">
            <div>
              <p className="text-base font-bold text-foreground">Your Artist Page QR</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Print this on flyers, merch tags, stickers, and posters.
                Fans scan and land right on your page.
              </p>
            </div>

            {/* Page URL + copy */}
            <div
              className="flex items-center gap-2 rounded-xl border px-3 py-2"
              style={{ backgroundColor: "rgba(255,255,255,0.03)", borderColor: "var(--border)" }}
            >
              <p className="flex-1 text-xs text-muted-foreground font-mono truncate">{pageUrl}</p>
              <button
                onClick={copyUrl}
                className="shrink-0 flex items-center gap-1 text-[11px] font-semibold transition-colors px-2 py-1 rounded-lg"
                style={copied
                  ? { backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759" }
                  : { color: "var(--muted-foreground)" }
                }
              >
                {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
              </button>
            </div>

            {/* Download buttons */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Download</p>
              <div className="flex flex-col gap-2">
                <a
                  href={dlPng}
                  download={`${slug}-qr.png`}
                  className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold no-underline transition-all hover:brightness-110"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >
                  <FileImage size={15} />
                  Download PNG
                  <span className="ml-auto text-[11px] font-normal opacity-70">1024 × 1024 px</span>
                </a>
                <a
                  href={dlSvg}
                  download={`${slug}-qr.svg`}
                  className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold no-underline border transition-colors hover:bg-white/5"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                >
                  <Download size={15} />
                  Download SVG
                  <span className="ml-auto text-[11px] font-normal text-muted-foreground">Infinitely scalable</span>
                </a>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground/50">
              The QR code encodes a tracking URL — scans are counted separately from regular visits.
            </p>
          </div>
        </div>
      </div>

      {/* ── Scan stats ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <div
          className="rounded-2xl border p-5"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "rgba(212,168,67,0.12)" }}
            >
              <Scan size={15} style={{ color: "#D4A843" }} />
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Scans</p>
          </div>
          {statsLoading ? (
            <div className="h-8 w-16 rounded-lg animate-pulse" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
          ) : (
            <p className="text-3xl font-bold text-foreground">{stats?.total ?? 0}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">All-time QR scans</p>
        </div>

        <div
          className="rounded-2xl border p-5"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "rgba(52,199,89,0.12)" }}
            >
              <TrendingUp size={15} style={{ color: "#34C759" }} />
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last 30 Days</p>
          </div>
          {statsLoading ? (
            <div className="h-8 w-16 rounded-lg animate-pulse" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
          ) : (
            <p className="text-3xl font-bold text-foreground">{stats?.last30d ?? 0}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">QR scans this month</p>
        </div>
      </div>

      {/* ── Usage ideas ─────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl border p-5 space-y-5"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div>
          <p className="text-sm font-bold text-foreground">Where to use your QR code</p>
          <p className="text-xs text-muted-foreground mt-0.5">Every scan lands directly on your artist page</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UseCase
            icon={Printer}
            title="Flyers & Posters"
            desc="Add your QR to show flyers, venue posters, and local advertising."
            color="#D4A843"
          />
          <UseCase
            icon={ShoppingBag}
            title="Merch Tags"
            desc="Hang tags on merch so fans can find your music and socials instantly."
            color="#E85D4A"
          />
          <UseCase
            icon={Sticker}
            title="Stickers"
            desc="Print as stickers for street marketing, instrument cases, or packaging."
            color="#5AC8FA"
          />
          <UseCase
            icon={FileImage}
            title="Digital Promo"
            desc="Drop the PNG in email newsletters, slides, or social media bios."
            color="#34C759"
          />
        </div>

        {/* Print tip */}
        <div
          className="rounded-xl p-3 flex items-start gap-2.5"
          style={{ backgroundColor: "rgba(212,168,67,0.06)", border: "1px solid rgba(212,168,67,0.15)" }}
        >
          <Printer size={14} className="mt-0.5 shrink-0" style={{ color: "#D4A843" }} />
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold" style={{ color: "#D4A843" }}>Print tip:</span>{" "}
            Use the <strong className="text-foreground">SVG</strong> for professional printing — it scales to any size without pixelation.
            Use the <strong className="text-foreground">PNG</strong> for digital use and quick sharing.
          </p>
        </div>
      </div>

    </div>
  );
}
