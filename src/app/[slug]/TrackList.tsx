"use client";

import { useState, useEffect } from "react";
import { Music2, Download, Instagram, ExternalLink, X, Check, Play, ChevronDown, ChevronUp } from "lucide-react";
import { useAudioStore } from "@/store";
import InlinePlayer from "@/components/audio/InlinePlayer";
import type { AudioTrack } from "@/store";
import { detectDevice, buildStreamingLinks } from "@/lib/smart-links";
import type { DeviceType } from "@/lib/smart-links";
import AddToCrateButton from "@/components/dj/AddToCrateButton";

// ─── Types ────────────────────────────────────────────────────────────────────

type TrackData = {
  id:             string;
  title:          string;
  coverArtUrl:    string | null;
  canvasVideoUrl: string | null;
  price:          number | null;
  plays:          number;
  fileUrl:        string;
  releaseId?:     string | null;
};

// Extended internal type — stream lease tracks carry extra credit info
type InternalTrack = TrackData & {
  isStreamLease?: boolean;
  leaseId?:       string;
  producerCredit?: string;
  producerSlug?:  string | null;
};

export type StreamLeaseTrackData = {
  leaseId:       string;
  title:         string;
  coverUrl:      string | null;
  audioUrl:      string;
  playCount:     number;
  producerCredit: string;
  producerSlug:  string | null;
};

type ReleaseData = {
  id:          string;
  title:       string;
  coverUrl:    string | null;
  releaseDate: string | null;
  type:        string;
  tracks:      TrackData[];
};

// ─── Platform SVG icons ───────────────────────────────────────────────────────

const PLATFORM_ICONS: Record<string, (props: { size: number }) => React.ReactElement> = {
  spotify: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.51 17.31a.748.748 0 01-1.03.248c-2.82-1.723-6.37-2.112-10.553-1.157a.748.748 0 01-.353-1.453c4.576-1.047 8.502-.596 11.688 1.332a.748.748 0 01.248 1.03zm1.47-3.268a.937.937 0 01-1.288.308c-3.226-1.983-8.14-2.558-11.953-1.4a.937.937 0 01-.544-1.793c4.358-1.322 9.776-.681 13.477 1.596a.937.937 0 01.308 1.289zm.127-3.403c-3.868-2.297-10.248-2.508-13.942-1.388a1.124 1.124 0 01-.653-2.15c4.238-1.287 11.284-1.038 15.735 1.607a1.124 1.124 0 01-1.14 1.931z" />
    </svg>
  ),
  apple: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026C4.786.07 4.043.15 3.34.428 2.004.958 1.04 1.88.475 3.208A4.86 4.86 0 00.09 4.88c-.014.277-.021.554-.022.832V18.3c.003.28.012.56.03.838.051.824.227 1.626.62 2.372.684 1.296 1.768 2.15 3.19 2.545.525.145 1.062.208 1.608.225.293.01.586.015.878.015H18.56c.293 0 .586-.005.878-.015.546-.017 1.083-.08 1.608-.225 1.422-.395 2.506-1.249 3.19-2.545.393-.746.57-1.548.62-2.372.018-.278.027-.558.03-.838V5.71c0-.007-.003-.013-.003-.02l.003-.07c0-.007.003-.013.003-.02v-.496c-.001-.295-.018-.59-.037-.88zM12 18.83c-3.757 0-6.8-3.042-6.8-6.8S8.243 5.23 12 5.23s6.8 3.042 6.8 6.8-3.043 6.8-6.8 6.8zm0-11.09c-2.37 0-4.29 1.92-4.29 4.29S9.63 16.32 12 16.32s4.29-1.92 4.29-4.29S14.37 7.74 12 7.74zm6.96-2.95a1.59 1.59 0 110-3.18 1.59 1.59 0 010 3.18z" />
    </svg>
  ),
  youtube: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function NowPlayingBars() {
  return (
    <div className="flex items-end gap-[2px]" style={{ width: 13, height: 13 }} aria-hidden>
      <style>{`
        @keyframes trackNpBar { 0%,100%{transform:scaleY(0.25)} 50%{transform:scaleY(1)} }
      `}</style>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ width: 3, height: "100%", borderRadius: 2, backgroundColor: "currentColor", transformOrigin: "bottom", animation: "trackNpBar 0.75s ease-in-out infinite", animationDelay: `${i * 0.18}s` }} />
      ))}
    </div>
  );
}

// ─── Streaming pills (gray mockup style + smart ordering) ─────────────────────

function StreamingPills({
  spotifyUrl, appleMusicUrl, youtubeChannel, device, artistSlug, trackId,
}: {
  spotifyUrl?: string | null; appleMusicUrl?: string | null;
  youtubeChannel?: string | null; device: DeviceType;
  artistSlug?: string; trackId?: string;
}) {
  const links = buildStreamingLinks({ spotifyUrl, appleMusicUrl, youtubeChannel }, device);
  if (!links.length) return null;

  function handleClick(platform: string) {
    if (!artistSlug) return;
    fetch("/api/public/artist-linkclick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ artistSlug, platform, trackId: trackId ?? null }) }).catch(() => {});
  }

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {links.map(({ key, label, href }) => {
        const Icon = PLATFORM_ICONS[key];
        return (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer" onClick={() => handleClick(key)}
            className="inline-flex items-center gap-1 px-2 py-[3px] rounded-[10px] text-[9px] no-underline transition-all hover:bg-white/10"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "#999" }}>
            {Icon && <Icon size={9} />}
            {label}
          </a>
        );
      })}
    </div>
  );
}

// ─── Follow Gate Modal ────────────────────────────────────────────────────────

function FollowGateModal({ track, instagramHandle, onClose }: { track: TrackData; instagramHandle: string; onClose: () => void }) {
  const [followed, setFollowed] = useState(false);
  function handleDownload() {
    const a = document.createElement("a");
    a.href = track.fileUrl; a.download = track.title; a.target = "_blank";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    onClose();
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
      <div className="w-full max-w-sm rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="relative px-6 pt-6 pb-4 text-center">
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5"><X size={14} /></button>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: "linear-gradient(135deg,#833AB4,#E1306C,#F77737)" }}><Instagram size={22} className="text-white" /></div>
          <h2 className="text-base font-bold text-foreground">Free Download</h2>
          <p className="text-sm text-muted-foreground mt-1">Follow <span className="font-semibold text-foreground">@{instagramHandle}</span> on Instagram to download <span className="font-semibold text-foreground">{track.title}</span> for free.</p>
        </div>
        <div className="px-6 pb-6 space-y-3">
          <a href={`https://instagram.com/${instagramHandle}`} target="_blank" rel="noopener noreferrer" onClick={() => setFollowed(true)}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold no-underline"
            style={{ background: "linear-gradient(135deg,#833AB4,#E1306C,#F77737)", color: "white" }}>
            <Instagram size={16} /> Follow @{instagramHandle} <ExternalLink size={12} className="opacity-70" />
          </a>
          <button onClick={handleDownload} disabled={!followed}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
            {followed ? <Check size={15} /> : <Download size={15} />} I Followed — Download Now
          </button>
          {!followed && <p className="text-center text-xs text-muted-foreground">Click &ldquo;Follow&rdquo; first, then download will unlock.</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Numbered track row ────────────────────────────────────────────────────────

function TrackRow({
  track, index, isActive, isPlaying: trackIsPlaying, onPlay, onTip, onDownload, followGateEnabled, instagramHandle,
}: {
  track: InternalTrack; index: number; isActive: boolean; isPlaying: boolean;
  onPlay: () => void; onTip: () => void; onDownload: () => void;
  followGateEnabled: boolean; instagramHandle: string | null;
}) {
  return (
    <div id={`track-${track.id}`} className="flex items-center gap-2.5 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", scrollMarginTop: "80px" }}>
      {/* Number / now-playing */}
      <div className="w-[18px] shrink-0 text-center text-[11px]" style={{ color: "#666" }}>
        {isActive && trackIsPlaying ? <NowPlayingBars /> : index + 1}
      </div>

      {/* Cover */}
      <button onClick={onPlay} className="shrink-0 relative rounded-[4px] overflow-hidden transition-transform hover:scale-105" style={{ width: 36, height: 36 }}>
        {(track.coverArtUrl || track.canvasVideoUrl)
          ? <img src={track.coverArtUrl ?? ''} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: "rgba(212,168,67,0.08)" }}><Music2 size={12} style={{ color: "rgba(212,168,67,0.4)" }} /></div>
        }
        <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center">
          {!isActive && <Play size={10} className="opacity-0 group-hover:opacity-100" style={{ color: "#D4A843", marginLeft: 1 }} />}
        </div>
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-[#F5F5F5] truncate" style={isActive ? { color: "#D4A843" } : {}}>{track.title}</p>
        {track.producerCredit ? (
          track.producerSlug
            ? <a href={`/${track.producerSlug}`} target="_blank" rel="noopener noreferrer"
                className="text-[10px] hover:underline block truncate" style={{ color: "#888" }}>
                {track.producerCredit}
              </a>
            : <p className="text-[10px] truncate" style={{ color: "#888" }}>{track.producerCredit}</p>
        ) : (
          <p className="text-[10px]" style={{ color: "#666" }}>{track.plays.toLocaleString()} plays</p>
        )}
      </div>

      {/* Mini waveform (visual placeholder) */}
      <div className="shrink-0 rounded-[3px]" style={{ width: 70, height: 18, backgroundColor: isActive ? "rgba(232,93,74,0.3)" : "rgba(212,168,67,0.20)" }} />

      {/* Tip link */}
      <button onClick={onTip} className="shrink-0 text-[9px] transition-opacity hover:opacity-70" style={{ color: "#D4A843" }}>
        $ Tip
      </button>

      {/* Download (if free + gate, regular tracks only) */}
      {!track.isStreamLease && followGateEnabled && instagramHandle && track.price === null && (
        <button onClick={onDownload} className="shrink-0 text-[9px] transition-opacity hover:opacity-70" style={{ color: "rgba(255,255,255,0.4)" }}>
          <Download size={10} />
        </button>
      )}

      {/* Add to Crate (DJ Mode only) */}
      <div className="shrink-0">
        <AddToCrateButton trackId={track.id} />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TrackList({
  releases = [],
  looseTracks = [],
  streamLeaseTracks = [],
  artistName,
  artistSlug,
  followGateEnabled = false,
  instagramHandle = null,
  spotifyUrl = null,
  appleMusicUrl = null,
  youtubeChannel = null,
}: {
  releases:              ReleaseData[];
  looseTracks:           TrackData[];
  streamLeaseTracks?:    StreamLeaseTrackData[];
  artistName?:           string;
  artistSlug?:           string;
  followGateEnabled?:    boolean;
  instagramHandle?:      string | null;
  spotifyUrl?:           string | null;
  appleMusicUrl?:        string | null;
  youtubeChannel?:       string | null;
}) {
  const currentId    = useAudioStore((s) => s.currentTrack?.id);
  const isPlaying    = useAudioStore((s) => s.isPlaying);
  const playInContext = useAudioStore((s) => s.playInContext);

  const [gateTrack,      setGateTrack]      = useState<TrackData | null>(null);
  const [expandedRelId,  setExpandedRelId]  = useState<string | null>(null);
  const [device,         setDevice]         = useState<DeviceType>("desktop");
  useEffect(() => { setDevice(detectDevice()); }, []);

  // Convert stream lease tracks to internal format
  const slTracks: InternalTrack[] = streamLeaseTracks.map((sl) => ({
    id:             sl.leaseId,
    title:          sl.title,
    coverArtUrl:    sl.coverUrl,
    canvasVideoUrl: null,
    price:          null,
    plays:          sl.playCount,
    fileUrl:        sl.audioUrl,
    isStreamLease:  true,
    leaseId:        sl.leaseId,
    producerCredit: sl.producerCredit,
    producerSlug:   sl.producerSlug,
  }));

  const hasReleases = releases.length > 0;

  // Build global audio context from all tracks
  const regularTracks: InternalTrack[] = hasReleases
    ? [...releases.flatMap((r) => r.tracks), ...looseTracks]
    : looseTracks;

  const allTracks: InternalTrack[] = [...regularTracks, ...slTracks];

  const audioContext: AudioTrack[] = allTracks.map((t) => ({
    id: t.id, title: t.title, artist: artistName ?? "", src: t.fileUrl, coverArt: t.coverArtUrl ?? undefined,
  }));

  function firePlay(track: InternalTrack) {
    if (track.isStreamLease && track.leaseId) {
      fetch("/api/public/stream-lease-play", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaseId: track.leaseId, artistSlug }),
      }).catch(() => {});
    } else if (artistSlug) {
      fetch("/api/public/artist-trackplay", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId: track.id, artistSlug }),
      }).catch(() => {});
    }
  }

  function playTrack(track: InternalTrack) {
    const s = useAudioStore.getState();
    if (s.currentTrack?.id === track.id && s.isPlaying) { s.pause(); return; }
    playInContext({ id: track.id, title: track.title, artist: artistName ?? "", src: track.fileUrl, coverArt: track.coverArtUrl ?? undefined, canvasVideoUrl: track.canvasVideoUrl ?? null }, audioContext);
    firePlay(track);
  }

  function handleTip() {
    document.getElementById("support")?.scrollIntoView({ behavior: "smooth" });
  }

  function handleDownload(track: InternalTrack) {
    if (track.isStreamLease) return; // stream lease tracks are not downloadable
    if (followGateEnabled && instagramHandle && track.price === null) {
      setGateTrack(track);
    } else {
      const a = document.createElement("a");
      a.href = track.fileUrl; a.download = track.title; a.target = "_blank";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
  }

  const streamingProps = { spotifyUrl, appleMusicUrl, youtubeChannel, device, artistSlug };

  if (allTracks.length === 0) return null;

  // ── MODE A: Release-based ──────────────────────────────────────────────────
  if (hasReleases) {
    const featured      = releases[0];
    const otherReleases = releases.slice(1);

    const featuredAudio: AudioTrack = featured.tracks[0]
      ? { id: featured.tracks[0].id, title: featured.title, artist: artistName ?? "", src: featured.tracks[0].fileUrl, coverArt: featured.coverUrl ?? undefined }
      : null!;

    return (
      <section className="space-y-0">
        {/* Section labels */}
        <div style={{ fontSize: 10, color: "#D4A843", letterSpacing: "1.5px", marginBottom: 5 }}>LATEST RELEASE</div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "#F5F5F5", marginBottom: 12, letterSpacing: "-0.5px" }}>Music</h2>

        {/* Featured release card */}
        <div className="rounded-[10px] flex gap-3.5 mb-3" style={{ backgroundColor: "#111", padding: 14 }}>
          {/* Cover art */}
          <div className="shrink-0 rounded-[8px] overflow-hidden flex items-center justify-center" style={{ width: 100, height: 100, backgroundColor: "rgba(212,168,67,0.06)" }}>
            {(featured.coverUrl || (featured.tracks[0] as TrackData | undefined)?.canvasVideoUrl)
              ? <img src={featured.coverUrl ?? ''} alt="" className="w-full h-full object-cover" />
              : <Music2 size={24} style={{ color: "rgba(212,168,67,0.3)" }} />
            }
          </div>

          {/* Info column */}
          <div className="flex-1 min-w-0 flex flex-col justify-between">
            <div>
              <p className="font-semibold text-[15px] text-[#F5F5F5] leading-tight">{featured.title}</p>
              <p className="text-[10px] mt-0.5" style={{ color: "#666" }}>
                {featured.type} {featured.releaseDate ? `· ${formatDate(featured.releaseDate)}` : ""}
              </p>
            </div>

            {/* Waveform player */}
            {featuredAudio && (
              <div className="my-2">
                <InlinePlayer track={featuredAudio} context={audioContext} onPlay={() => featured.tracks[0] && firePlay(featured.tracks[0] as InternalTrack)} />
              </div>
            )}

            {/* Streaming pills + tip */}
            <div className="flex items-center gap-2 flex-wrap">
              <StreamingPills {...streamingProps} trackId={featured.tracks[0]?.id} />
              <button onClick={handleTip} className="ml-auto text-[9px] transition-opacity hover:opacity-70" style={{ color: "#D4A843" }}>$ Tip</button>
            </div>
          </div>
        </div>

        {/* Track rows for featured release */}
        <div>
          {featured.tracks.slice(0, 10).map((track, i) => (
            <TrackRow
              key={track.id} track={track as InternalTrack} index={i}
              isActive={currentId === track.id} isPlaying={currentId === track.id && isPlaying}
              onPlay={() => playTrack(track as InternalTrack)} onTip={handleTip} onDownload={() => handleDownload(track as InternalTrack)}
              followGateEnabled={followGateEnabled} instagramHandle={instagramHandle}
            />
          ))}
        </div>

        {/* Stream-leased tracks — appended after release tracks */}
        {slTracks.length > 0 && (
          <div className="mt-1">
            {slTracks.map((track, i) => (
              <TrackRow
                key={track.id} track={track} index={featured.tracks.length + i}
                isActive={currentId === track.id} isPlaying={currentId === track.id && isPlaying}
                onPlay={() => playTrack(track)} onTip={handleTip} onDownload={() => {}}
                followGateEnabled={false} instagramHandle={null}
              />
            ))}
          </div>
        )}

        {/* Other releases — horizontal scroll */}
        {otherReleases.length > 0 && (
          <div className="mt-6 space-y-4">
            <p className="text-[11px] font-semibold text-[#F5F5F5]">More Releases</p>
            <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {otherReleases.map((rel) => {
                const isExp = expandedRelId === rel.id;
                return (
                  <div key={rel.id} className="shrink-0 cursor-pointer" style={{ width: 90 }} onClick={() => setExpandedRelId(isExp ? null : rel.id)}>
                    <div className="relative rounded-[6px] overflow-hidden" style={{ width: 90, height: 90 }}>
                      {rel.coverUrl
                        ? <img src={rel.coverUrl} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: "rgba(212,168,67,0.08)" }}><Music2 size={20} style={{ color: "rgba(212,168,67,0.3)" }} /></div>
                      }
                      <div className="absolute inset-0 bg-black/30 flex items-end p-1.5">
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(212,168,67,0.8)", color: "#0A0A0A" }}>{rel.type}</span>
                      </div>
                      {isExp && <div className="absolute inset-0" style={{ border: "2px solid #D4A843", borderRadius: 6 }} />}
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <p className="text-[10px] text-[#F5F5F5] truncate flex-1">{rel.title}</p>
                      {isExp ? <ChevronUp size={10} style={{ color: "#D4A843" }} /> : <ChevronDown size={10} style={{ color: "#666" }} />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Expanded release track rows */}
            {expandedRelId && (() => {
              const rel = otherReleases.find((r) => r.id === expandedRelId);
              if (!rel) return null;
              return (
                <div className="rounded-[10px] p-4" style={{ backgroundColor: "#111" }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[13px] font-semibold text-[#F5F5F5]">{rel.title}</p>
                    <button onClick={() => setExpandedRelId(null)} className="p-1 rounded hover:bg-white/5"><X size={12} style={{ color: "#666" }} /></button>
                  </div>
                  {rel.tracks.slice(0, 10).map((track, i) => (
                    <TrackRow key={track.id} track={track as InternalTrack} index={i}
                      isActive={currentId === track.id} isPlaying={currentId === track.id && isPlaying}
                      onPlay={() => playTrack(track as InternalTrack)} onTip={handleTip} onDownload={() => handleDownload(track as InternalTrack)}
                      followGateEnabled={followGateEnabled} instagramHandle={instagramHandle}
                    />
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* Follow gate modal */}
        {gateTrack && instagramHandle && (
          <FollowGateModal track={gateTrack} instagramHandle={instagramHandle} onClose={() => setGateTrack(null)} />
        )}
      </section>
    );
  }

  // ── MODE B: Flat list (no releases) ───────────────────────────────────────
  // Blend regular loose tracks + stream lease tracks, first item is featured
  const combinedTracks: InternalTrack[] = [...looseTracks as InternalTrack[], ...slTracks];
  const featured = combinedTracks[0];
  const rest     = combinedTracks.slice(1);
  if (!featured) return null;

  const featuredAudio: AudioTrack = { id: featured.id, title: featured.title, artist: artistName ?? "", src: featured.fileUrl, coverArt: featured.coverArtUrl ?? undefined };

  return (
    <section className="space-y-0">
      <div style={{ fontSize: 10, color: "#D4A843", letterSpacing: "1.5px", marginBottom: 5 }}>LATEST RELEASE</div>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: "#F5F5F5", marginBottom: 12, letterSpacing: "-0.5px" }}>Music</h2>

      {/* Featured track card */}
      <div className="rounded-[10px] flex gap-3.5 mb-3" style={{ backgroundColor: "#111", padding: 14 }}>
        <div className="shrink-0 rounded-[8px] overflow-hidden flex items-center justify-center" style={{ width: 100, height: 100, backgroundColor: "rgba(212,168,67,0.06)" }}>
          {(featured.coverArtUrl || featured.canvasVideoUrl)
            ? <img src={featured.coverArtUrl ?? ''} alt="" className="w-full h-full object-cover" />
            : <Music2 size={24} style={{ color: "rgba(212,168,67,0.3)" }} />
          }
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <p className="font-semibold text-[15px] text-[#F5F5F5] leading-tight">{featured.title}</p>
            {featured.producerCredit ? (
              featured.producerSlug
                ? <a href={`/${featured.producerSlug}`} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] mt-0.5 hover:underline block" style={{ color: "#888" }}>
                    {featured.producerCredit}
                  </a>
                : <p className="text-[10px] mt-0.5" style={{ color: "#888" }}>{featured.producerCredit}</p>
            ) : (
              <p className="text-[10px] mt-0.5" style={{ color: "#666" }}>{featured.plays.toLocaleString()} plays</p>
            )}
          </div>
          <div className="my-2">
            <InlinePlayer track={featuredAudio} context={audioContext} onPlay={() => firePlay(featured)} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!featured.isStreamLease && <StreamingPills {...streamingProps} trackId={featured.id} />}
            <button onClick={handleTip} className="ml-auto text-[9px] transition-opacity hover:opacity-70" style={{ color: "#D4A843" }}>$ Tip</button>
          </div>
        </div>
      </div>

      {/* Track rows */}
      {rest.map((track, i) => (
        <TrackRow key={track.id} track={track} index={i + 1}
          isActive={currentId === track.id} isPlaying={currentId === track.id && isPlaying}
          onPlay={() => playTrack(track)} onTip={handleTip} onDownload={() => handleDownload(track)}
          followGateEnabled={followGateEnabled} instagramHandle={instagramHandle}
        />
      ))}

      {gateTrack && instagramHandle && (
        <FollowGateModal track={gateTrack} instagramHandle={instagramHandle} onClose={() => setGateTrack(null)} />
      )}
    </section>
  );
}
