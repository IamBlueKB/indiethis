import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const W = 1200;
const H = 630;

// ── Font loader (Google Fonts → ArrayBuffer for Satori) ───────────────────────
let _playfairBold: ArrayBuffer | null = null;
let _dmSansReg: ArrayBuffer | null = null;

async function loadFonts(): Promise<{ playfair: ArrayBuffer | null; dm: ArrayBuffer | null }> {
  try {
    if (!_playfairBold || !_dmSansReg) {
      const [playfairCss, dmCss] = await Promise.all([
        fetch("https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap", {
          headers: { "User-Agent": "Mozilla/5.0" },
        }).then((r) => r.text()),
        fetch("https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600&display=swap", {
          headers: { "User-Agent": "Mozilla/5.0" },
        }).then((r) => r.text()),
      ]);

      const extractUrl = (css: string) => {
        const m = css.match(/src: url\(([^)]+)\) format\('(opentype|truetype|woff2?)'\)/);
        return m ? m[1] : null;
      };

      const [playfairUrl, dmUrl] = [extractUrl(playfairCss), extractUrl(dmCss)];

      if (playfairUrl && !_playfairBold) {
        _playfairBold = await fetch(playfairUrl).then((r) => r.arrayBuffer());
      }
      if (dmUrl && !_dmSansReg) {
        _dmSansReg = await fetch(dmUrl).then((r) => r.arrayBuffer());
      }
    }
  } catch {
    // Fonts fail gracefully — Satori uses Noto Sans built-in as fallback
  }
  return { playfair: _playfairBold, dm: _dmSansReg };
}

// ── Shared layout helpers ─────────────────────────────────────────────────────

function BrandMark() {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 32,
        right: 40,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          backgroundColor: "#D4A843",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ color: "#0A0A0A", fontSize: 14, fontWeight: 700, lineHeight: 1 }}>
          IT
        </div>
      </div>
      <div style={{ color: "#D4A843", fontSize: 16, fontWeight: 600 }}>IndieThis</div>
    </div>
  );
}

function PersonLayout({
  photoUrl,
  displayName,
  tagline,
  sub,
}: {
  photoUrl: string | null;
  displayName: string;
  tagline: string;
  sub?: string | null;
}) {
  return (
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        backgroundColor: "#0A0A0A",
        position: "relative",
        fontFamily: "DM Sans, sans-serif",
      }}
    >
      {/* Subtle gradient accent */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: "linear-gradient(90deg, #D4A843 0%, #F5C76A 50%, #D4A843 100%)",
        }}
      />

      {/* Left — photo */}
      <div
        style={{
          width: 380,
          height: H,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            style={{
              width: 220,
              height: 220,
              borderRadius: "50%",
              objectFit: "cover",
              border: "3px solid #D4A843",
            }}
            alt=""
          />
        ) : (
          <div
            style={{
              width: 220,
              height: 220,
              borderRadius: "50%",
              backgroundColor: "#1A1A1A",
              border: "3px solid #D4A843",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ color: "#D4A843", fontSize: 56, fontWeight: 700 }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
          </div>
        )}
      </div>

      {/* Right — text */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 60px 0 20px",
        }}
      >
        <div
          style={{
            color: "#F5F5F5",
            fontSize: displayName.length > 20 ? 40 : 52,
            fontWeight: 700,
            fontFamily: "Playfair Display, Georgia, serif",
            lineHeight: 1.15,
            marginBottom: 16,
          }}
        >
          {displayName}
        </div>

        <div
          style={{
            color: "#D4A843",
            fontSize: 22,
            fontWeight: 600,
            marginBottom: sub ? 10 : 0,
          }}
        >
          {tagline}
        </div>

        {sub && (
          <div
            style={{
              color: "#666",
              fontSize: 18,
              marginTop: 4,
            }}
          >
            {sub}
          </div>
        )}

        {/* Gold divider */}
        <div
          style={{
            width: 60,
            height: 3,
            backgroundColor: "#D4A843",
            marginTop: 28,
            borderRadius: 2,
          }}
        />
      </div>

      <BrandMark />
    </div>
  );
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const { type, id } = await params;
  const { playfair, dm } = await loadFonts();

  const fontConfig = [
    ...(playfair ? [{ name: "Playfair Display", data: playfair, weight: 700 as const, style: "normal" as const }] : []),
    ...(dm        ? [{ name: "DM Sans",          data: dm,       weight: 400 as const, style: "normal" as const }] : []),
  ];

  const headers = {
    "Cache-Control": "public, max-age=86400, s-maxage=86400",
    "Content-Type": "image/png",
  };

  // ── Artist ──────────────────────────────────────────────────────────────────
  if (type === "artist") {
    const artist = await db.user.findUnique({
      where:  { artistSlug: id },
      select: {
        name:       true,
        artistName: true,
        photo:      true,
        bio:        true,
        artistSite: { select: { genre: true, city: true } },
        avatars:    { where: { isDefault: true }, select: { avatarUrl: true }, take: 1 },
      },
    });

    const displayName = artist?.artistName || artist?.name || "Artist";
    const genre       = artist?.artistSite?.genre;
    const tagline     = genre ? `${genre} · on IndieThis` : "on IndieThis";
    // Prefer default avatar over generic profile photo for OG image
    const photoUrl    = artist?.avatars?.[0]?.avatarUrl ?? artist?.photo ?? null;

    return new ImageResponse(
      <PersonLayout
        photoUrl={photoUrl}
        displayName={displayName}
        tagline={tagline}
      />,
      { width: W, height: H, fonts: fontConfig, headers }
    );
  }

  // ── DJ ──────────────────────────────────────────────────────────────────────
  if (type === "dj") {
    const dj = await db.dJProfile.findUnique({
      where:  { slug: id },
      select: {
        profilePhotoUrl: true,
        genres:          true,
        city:            true,
        user:            {
          select: {
            name:       true,
            artistName: true,
            photo:      true,
            avatars:    { where: { isDefault: true }, select: { avatarUrl: true }, take: 1 },
          },
        },
      },
    });

    const displayName = dj?.user.artistName || dj?.user.name || "DJ";
    const genres      = (dj?.genres as string[] | null) ?? [];
    const genreLabel  = genres.slice(0, 2).join(", ");
    const tagline     = genreLabel ? `${genreLabel} · DJ on IndieThis` : "DJ on IndieThis";
    // Prefer default avatar → DJ profile photo → generic user photo
    const photo       = dj?.user.avatars?.[0]?.avatarUrl ?? dj?.profilePhotoUrl ?? dj?.user.photo ?? null;

    return new ImageResponse(
      <PersonLayout
        photoUrl={photo}
        displayName={displayName}
        tagline={tagline}
      />,
      { width: W, height: H, fonts: fontConfig, headers }
    );
  }

  // ── Studio ──────────────────────────────────────────────────────────────────
  if (type === "studio") {
    const studio = await db.studio.findUnique({
      where:  { slug: id },
      select: { name: true, description: true, logo: true, city: true, state: true },
    });

    const displayName = studio?.name ?? "Recording Studio";
    const location    = [studio?.city, studio?.state].filter(Boolean).join(", ");
    const tagline     = location ? `${location} · Recording Studio on IndieThis` : "Recording Studio on IndieThis";

    return new ImageResponse(
      <PersonLayout
        photoUrl={studio?.logo ?? null}
        displayName={displayName}
        tagline={tagline}
      />,
      { width: W, height: H, fonts: fontConfig, headers }
    );
  }

  // ── Track ───────────────────────────────────────────────────────────────────
  if (type === "track") {
    const track = await db.track.findUnique({
      where:  { id },
      select: {
        title:       true,
        coverArtUrl: true,
        genre:       true,
        bpm:         true,
        artist:      { select: { name: true, artistName: true } },
      },
    });

    const trackTitle  = track?.title ?? "Track";
    const artistName  = track?.artist.artistName || track?.artist.name || "";
    const meta        = [track?.genre, track?.bpm ? `${track.bpm} BPM` : null].filter(Boolean).join(" · ");

    return new ImageResponse(
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          backgroundColor: "#0A0A0A",
          position: "relative",
          fontFamily: "DM Sans, sans-serif",
        }}
      >
        {/* Left — cover art square */}
        <div style={{ width: H, height: H, flexShrink: 0, position: "relative" }}>
          {track?.coverArtUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={track.coverArtUrl}
              style={{ width: H, height: H, objectFit: "cover" }}
              alt=""
            />
          ) : (
            <div
              style={{
                width: H,
                height: H,
                backgroundColor: "#1A1A1A",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ color: "#D4A843", fontSize: 80, opacity: 0.3 }}>♪</div>
            </div>
          )}
          {/* Gradient bleed into right side */}
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 80,
              height: H,
              background: "linear-gradient(90deg, transparent, #0A0A0A)",
            }}
          />
        </div>

        {/* Right — text */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 50px 0 30px",
          }}
        >
          <div
            style={{
              color: "#F5F5F5",
              fontSize: trackTitle.length > 22 ? 30 : 38,
              fontWeight: 700,
              fontFamily: "Playfair Display, Georgia, serif",
              lineHeight: 1.2,
              marginBottom: 14,
            }}
          >
            {trackTitle}
          </div>

          <div style={{ color: "#888", fontSize: 20, marginBottom: 12 }}>
            {artistName}
          </div>

          {meta && (
            <div style={{ color: "#D4A843", fontSize: 16, fontWeight: 600 }}>
              {meta}
            </div>
          )}

          <div
            style={{
              width: 50,
              height: 3,
              backgroundColor: "#D4A843",
              marginTop: 24,
              borderRadius: 2,
            }}
          />
        </div>

        {/* Top accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "linear-gradient(90deg, #D4A843 0%, #F5C76A 50%, #D4A843 100%)",
          }}
        />

        <BrandMark />
      </div>,
      { width: W, height: H, fonts: fontConfig, headers }
    );
  }

  // ── Fallback — generic IndieThis brand card ──────────────────────────────────
  return new ImageResponse(
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0A0A0A",
        fontFamily: "DM Sans, sans-serif",
        position: "relative",
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          backgroundColor: "#D4A843",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 28,
        }}
      >
        <div style={{ color: "#0A0A0A", fontSize: 32, fontWeight: 700 }}>IT</div>
      </div>
      <div
        style={{
          color: "#F5F5F5",
          fontSize: 56,
          fontWeight: 700,
          fontFamily: "Playfair Display, Georgia, serif",
          marginBottom: 16,
        }}
      >
        IndieThis
      </div>
      <div style={{ color: "#D4A843", fontSize: 22 }}>
        Discover independent music
      </div>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: "linear-gradient(90deg, #D4A843 0%, #F5C76A 50%, #D4A843 100%)",
        }}
      />
    </div>,
    { width: W, height: H, fonts: fontConfig, headers }
  );
}
