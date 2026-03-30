"use client";

import { useEffect, useState } from "react";
import { Loader2, Check, AlertCircle } from "lucide-react";

type SocialLinks = {
  instagram?: string;
  tiktok?: string;
  twitter?: string;
  soundcloud?: string;
};

type DJProfileData = {
  id: string;
  slug: string;
  bio: string | null;
  genres: string[];
  city: string | null;
  profilePhotoUrl: string | null;
  socialLinks: SocialLinks | null;
  isVerified: boolean;
  verificationStatus: string;
  balance: number;
  totalEarnings: number;
};

export default function DJSettingsPage() {
  const [profile, setProfile] = useState<DJProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [bio, setBio] = useState("");
  const [genres, setGenres] = useState("");
  const [city, setCity] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [twitter, setTwitter] = useState("");
  const [soundcloud, setSoundcloud] = useState("");

  useEffect(() => {
    fetch("/api/dj/profile")
      .then((r) => r.json())
      .then((d: { profile?: DJProfileData; error?: string }) => {
        if (d.profile) {
          const p = d.profile;
          setProfile(p);
          setBio(p.bio ?? "");
          setGenres(p.genres.join(", "));
          setCity(p.city ?? "");
          setProfilePhotoUrl(p.profilePhotoUrl ?? "");
          const sl = p.socialLinks ?? {};
          setInstagram(sl.instagram ?? "");
          setTiktok(sl.tiktok ?? "");
          setTwitter(sl.twitter ?? "");
          setSoundcloud(sl.soundcloud ?? "");
        } else {
          setError(d.error ?? "Failed to load DJ profile.");
        }
      })
      .catch(() => setError("Failed to load DJ profile."))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    const genresArray = genres
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean);

    const body = {
      bio: bio.trim() || null,
      genres: genresArray,
      city: city.trim() || null,
      profilePhotoUrl: profilePhotoUrl.trim() || null,
      socialLinks: {
        instagram: instagram.trim() || undefined,
        tiktok: tiktok.trim() || undefined,
        twitter: twitter.trim() || undefined,
        soundcloud: soundcloud.trim() || undefined,
      },
    };

    try {
      const res = await fetch("/api/dj/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save settings.");
      } else {
        setProfile(data.profile);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      setError("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-muted-foreground" size={28} />
      </div>
    );
  }

  if (!profile && error) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm"
          style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
        >
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">DJ Profile Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Customize your public DJ profile visible to artists and fans.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Bio */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Bio
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={300}
            rows={4}
            placeholder="Tell artists and fans about yourself…"
            className="w-full px-3 py-2.5 rounded-lg text-sm text-foreground bg-transparent border resize-none focus:outline-none focus:ring-1 transition-colors"
            style={{
              backgroundColor: "var(--card)",
              borderColor: "var(--border)",
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#D4A843")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          />
          <p className="text-xs text-muted-foreground mt-1 text-right">{bio.length}/300</p>
        </div>

        {/* Genres */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Genres
          </label>
          <input
            type="text"
            value={genres}
            onChange={(e) => setGenres(e.target.value)}
            placeholder="e.g. Hip-Hop, R&B, Afrobeats"
            className="w-full px-3 py-2.5 rounded-lg text-sm text-foreground bg-transparent border focus:outline-none focus:ring-1 transition-colors"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#D4A843")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          />
          <p className="text-xs text-muted-foreground mt-1">Separate genres with commas.</p>
        </div>

        {/* City */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            City
          </label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Atlanta, GA"
            className="w-full px-3 py-2.5 rounded-lg text-sm text-foreground bg-transparent border focus:outline-none focus:ring-1 transition-colors"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#D4A843")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          />
        </div>

        {/* Profile Photo URL */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Profile Photo URL
          </label>
          <input
            type="url"
            value={profilePhotoUrl}
            onChange={(e) => setProfilePhotoUrl(e.target.value)}
            placeholder="https://…"
            className="w-full px-3 py-2.5 rounded-lg text-sm text-foreground bg-transparent border focus:outline-none focus:ring-1 transition-colors"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#D4A843")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          />
        </div>

        {/* Social Links */}
        <div>
          <p className="text-sm font-medium text-foreground mb-3">Social Links</p>
          <div className="space-y-3">
            {[
              { label: "Instagram", value: instagram, setter: setInstagram, placeholder: "https://instagram.com/yourhandle" },
              { label: "TikTok",    value: tiktok,    setter: setTiktok,    placeholder: "https://tiktok.com/@yourhandle" },
              { label: "Twitter",   value: twitter,   setter: setTwitter,   placeholder: "https://twitter.com/yourhandle" },
              { label: "SoundCloud",value: soundcloud,setter: setSoundcloud,placeholder: "https://soundcloud.com/yourhandle" },
            ].map(({ label, value, setter, placeholder }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  {label}
                </label>
                <input
                  type="url"
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-foreground bg-transparent border focus:outline-none focus:ring-1 transition-colors"
                  style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#D4A843")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm"
            style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            <AlertCircle size={15} className="shrink-0" />
            {error}
          </div>
        )}

        {/* Save button */}
        <div className="flex items-center gap-4 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-60"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            {saving ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Saving…
              </>
            ) : (
              "Save Changes"
            )}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "#D4A843" }}>
              <Check size={15} />
              Saved
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
