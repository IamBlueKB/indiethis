"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Play, Music2, Users } from "lucide-react";
import { useAudioStore } from "@/store";
import PublicNav from "@/components/layout/PublicNav";
import Footer from "@/components/layout/Footer";

type TrackItem = {
  id: string;
  trackId: string;
  addedAt: string;
  track: {
    id: string;
    title: string;
    coverArtUrl: string | null;
    fileUrl: string;
    genre: string | null;
    bpm: number | null;
    musicalKey: string | null;
    artist: {
      id: string;
      name: string;
      artistName: string | null;
      artistSlug: string | null;
      artistSite: { isPublished: boolean } | null;
    };
  };
};

type CrateData = {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  collaborators: Array<{
    djProfile: {
      id: string;
      slug: string;
      bio: string | null;
      user: { name: string; artistName: string | null; photo: string | null };
    };
  }>;
  items: TrackItem[];
};

type DJProfileData = {
  id: string;
  slug: string;
  bio: string | null;
  profilePhotoUrl: string | null;
  user: {
    name: string;
    artistName: string | null;
    photo: string | null;
    artistSlug: string | null;
    artistSite: { isPublished: boolean } | null;
  };
};

export default function PublicCrateClient({
  djProfile,
  crate,
}: {
  djProfile: DJProfileData;
  crate: CrateData;
}) {
  const { play, currentTrack, isPlaying } = useAudioStore();
  const didSetCookie = useRef(false);

  const djDisplayName = djProfile.user.artistName ?? djProfile.user.name;
  const djPhoto = djProfile.profilePhotoUrl ?? djProfile.user.photo;

  // Set attribution cookie when fan visits this crate
  useEffect(() => {
    if (didSetCookie.current) return;
    didSetCookie.current = true;

    fetch("/api/dj/attribute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        djProfileId: djProfile.id,
        sourceType: "CRATE",
        sourceId: crate.id,
      }),
    }).catch(() => {}); // fire and forget
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0A", color: "#f5f5f5" }}>
      <PublicNav />

      <div className="max-w-2xl mx-auto px-4 py-12 space-y-10">
        {/* DJ Profile */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden shrink-0" style={{ backgroundColor: "#1a1a1a" }}>
            {djPhoto
              ? <img src={djPhoto} alt={djDisplayName} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-xl font-bold" style={{ color: "#D4A843" }}>
                  {djDisplayName[0]?.toUpperCase()}
                </div>
            }
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest mb-0.5" style={{ color: "#D4A843" }}>DJ</p>
            <h2 className="text-lg font-bold text-white">{djDisplayName}</h2>
            {djProfile.bio && <p className="text-sm mt-0.5 line-clamp-2" style={{ color: "#888" }}>{djProfile.bio}</p>}
          </div>
        </div>

        {/* Crate header */}
        <div>
          <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: "#D4A843" }}>CRATE</p>
          <h1 className="text-3xl font-black text-white">{crate.name}</h1>
          {crate.description && (
            <p className="text-sm mt-2" style={{ color: "#888" }}>{crate.description}</p>
          )}
          <p className="text-xs mt-2" style={{ color: "#555" }}>{crate.items.length} track{crate.items.length !== 1 ? "s" : ""}</p>
        </div>

        {/* Collaborators */}
        {crate.collaborators.length > 0 && (
          <div className="flex items-center gap-2 text-sm" style={{ color: "#888" }}>
            <Users size={13} />
            <span>Also curated by:</span>
            {crate.collaborators.map(c => (
              <Link
                key={c.djProfile.id}
                href={`/dj/${c.djProfile.slug}`}
                className="font-semibold hover:underline text-white"
              >
                {c.djProfile.user.artistName ?? c.djProfile.user.name}
              </Link>
            ))}
          </div>
        )}

        {/* Track list */}
        {crate.items.length === 0 ? (
          <div className="text-center py-12" style={{ color: "#555" }}>
            <Music2 size={32} className="mx-auto mb-3 opacity-30" />
            <p>No tracks in this crate yet.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {crate.items.map((item, index) => {
              const track = item.track;
              const artist = track.artist;
              const artistName = artist.artistName ?? artist.name;
              const artistSlug = artist.artistSite?.isPublished ? artist.artistSlug : null;
              const isActive = currentTrack?.id === track.id;

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-xl transition-all group"
                  style={{ backgroundColor: isActive ? "rgba(212,168,67,0.08)" : "transparent" }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.03)"; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                >
                  {/* Number */}
                  <div className="w-6 text-center text-xs shrink-0" style={{ color: "#555" }}>
                    {isActive && isPlaying ? (
                      <span style={{ color: "#D4A843" }}>▶</span>
                    ) : index + 1}
                  </div>

                  {/* Cover + play */}
                  <button
                    onClick={() => play({ id: track.id, title: track.title, artist: artistName, src: track.fileUrl, coverArt: track.coverArtUrl ?? undefined })}
                    className="w-10 h-10 rounded-lg overflow-hidden shrink-0 relative"
                    style={{ backgroundColor: "#1a1a1a" }}
                  >
                    {track.coverArtUrl
                      ? <img src={track.coverArtUrl} alt={track.title} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Music2 size={14} style={{ color: "#444" }} /></div>
                    }
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                      <Play size={12} fill="#D4A843" style={{ color: "#D4A843" }} />
                    </div>
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: isActive ? "#D4A843" : "white" }}>{track.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {artistSlug
                        ? <Link href={`/${artistSlug}`} className="text-xs hover:underline" style={{ color: "#888" }}>{artistName}</Link>
                        : <span className="text-xs" style={{ color: "#888" }}>{artistName}</span>
                      }
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-2 shrink-0">
                    {track.bpm && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}>
                        {track.bpm}
                      </span>
                    )}
                    {track.musicalKey && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#1e1e1e", color: "#888" }}>
                        {track.musicalKey}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Follow this DJ (placeholder) */}
        <div className="text-center pt-4">
          <button
            className="px-6 py-3 rounded-xl text-sm font-bold border transition-colors hover:bg-white/5"
            style={{ borderColor: "rgba(212,168,67,0.4)", color: "#D4A843" }}
            onClick={() => alert("Follow feature coming soon.")}
          >
            Follow {djDisplayName}
          </button>
        </div>
      </div>

      <Footer />
    </div>
  );
}
