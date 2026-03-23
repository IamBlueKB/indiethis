"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Camera, CheckCircle2, ArrowRight, Music2, Mic2, Building2, Music4,
  Instagram, Youtube, Globe, SkipForward,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUploadThing } from "@/lib/uploadthing-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SetupData = {
  name:            string;
  bio:             string;
  photo:           string;
  city:            string;
  genres:          string[];
  soundcloudUrl:   string;
  instagramHandle: string;
  tiktokHandle:    string;
  youtubeChannel:  string;
  spotifyUrl:      string;
  appleMusicUrl:   string;
};

type Props = {
  initialStep: 0 | 1 | 2;
  initialData: SetupData;
  signupPath:  string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const GENRES = [
  "Hip-Hop", "R&B", "Pop", "Rock", "Electronic", "Jazz", "Gospel",
  "Country", "Latin", "Trap", "Drill", "Soul", "Afrobeats", "Classical", "Folk",
];

const SOCIAL_FIELDS = [
  { key: "instagramHandle", label: "Instagram",   placeholder: "@yourhandle",          icon: Instagram,    prefix: "@" },
  { key: "tiktokHandle",    label: "TikTok",       placeholder: "@yourhandle",          icon: Music2,       prefix: "@" },
  { key: "youtubeChannel",  label: "YouTube",      placeholder: "youtube.com/@channel", icon: Youtube,      prefix: ""  },
  { key: "spotifyUrl",      label: "Spotify",      placeholder: "open.spotify.com/…",   icon: Music4,       prefix: ""  },
  { key: "appleMusicUrl",   label: "Apple Music",  placeholder: "music.apple.com/…",    icon: Music4,       prefix: ""  },
  { key: "soundcloudUrl",   label: "SoundCloud",   placeholder: "soundcloud.com/you",   icon: Globe,        prefix: ""  },
] as const;

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-8">
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className="rounded-full transition-all"
          style={{
            width:           n === step ? 24 : 8,
            height:          8,
            backgroundColor: n === step ? "#E85D4A" : n < step ? "#D4A843" : "var(--border)",
          }}
        />
      ))}
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function SetupWizard({ initialStep, initialData, signupPath }: Props) {
  const router = useRouter();

  // Step 1 starts at screen 1 if onboardingStep=0, screen 2 if =1, etc.
  const [step, setStep]   = useState<1 | 2 | 3>(
    initialStep === 0 ? 1 : initialStep === 1 ? 2 : 3
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  // ── Screen 1 state ──────────────────────────────────────────────────────────
  const [photo,    setPhoto]    = useState(initialData.photo);
  const [bio,      setBio]      = useState(initialData.bio);
  const [city,     setCity]     = useState(initialData.city);
  const [genres,   setGenres]   = useState<string[]>(initialData.genres);
  const [photoPreview, setPhotoPreview] = useState<string>(initialData.photo);
  const [photoFile,    setPhotoFile]    = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { startUpload, isUploading } = useUploadThing("profilePhoto");

  // ── Screen 2 state ──────────────────────────────────────────────────────────
  const [socials, setSocials] = useState({
    instagramHandle: initialData.instagramHandle,
    tiktokHandle:    initialData.tiktokHandle,
    youtubeChannel:  initialData.youtubeChannel,
    spotifyUrl:      initialData.spotifyUrl,
    appleMusicUrl:   initialData.appleMusicUrl,
    soundcloudUrl:   initialData.soundcloudUrl,
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function toggleGenre(g: string) {
    setGenres((prev) => {
      if (prev.includes(g)) return prev.filter((x) => x !== g);
      if (prev.length >= 3) return prev;
      return [...prev, g];
    });
  }

  function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function save(s: 1 | 2 | 3, extra?: Record<string, unknown>) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/setup", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ step: s, ...extra }),
      });
      if (!res.ok) throw new Error("Save failed");
    } catch {
      setError("Something went wrong. Please try again.");
      setSaving(false);
      return false;
    }
    setSaving(false);
    return true;
  }

  // ─── Step 1 submit ───────────────────────────────────────────────────────────

  async function handleStep1() {
    setSaving(true);
    setError("");

    let uploadedUrl = photo;

    // Upload photo if a new file was picked
    if (photoFile) {
      const uploaded = await startUpload([photoFile]);
      const url = uploaded?.[0]?.ufsUrl ?? uploaded?.[0]?.url;
      if (url) {
        uploadedUrl = url;
        setPhoto(url);
      }
    }

    const ok = await save(1, {
      photo:  uploadedUrl || undefined,
      bio:    bio || undefined,
      city:   city || undefined,
      genres,
    });

    if (ok) setStep(2);
  }

  // ─── Step 2 submit ───────────────────────────────────────────────────────────

  async function handleStep2() {
    const ok = await save(2, socials);
    if (ok) setStep(3);
  }

  async function skipStep2() {
    const ok = await save(2, {});
    if (ok) setStep(3);
  }

  // ─── Step 3 actions ──────────────────────────────────────────────────────────

  async function completeSetup(destination: string) {
    setSaving(true);
    await save(3);
    router.push(destination);
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-[500px]">

      {/* Logo */}
      <div className="flex justify-center mb-7">
        <img
          src="/images/brand/indiethis-logo-dark-bg.svg"
          alt="IndieThis"
          style={{ height: "32px", width: "auto" }}
        />
      </div>

      <div
        className="rounded-2xl border p-8"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >

        <StepDots step={step} />

        {/* ── Screen 1: Profile Basics ─────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="text-center mb-2">
              <h1 className="font-display font-bold text-xl text-foreground tracking-tight">
                Set up your profile
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Takes under 2 minutes · Everything is optional
              </p>
            </div>

            {/* Photo upload */}
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative w-20 h-20 rounded-full overflow-hidden border-2 flex items-center justify-center transition-opacity hover:opacity-80"
                style={{ borderColor: photoPreview ? "#D4A843" : "var(--border)", backgroundColor: "var(--background)" }}
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <Camera size={24} className="text-muted-foreground" />
                )}
                <div
                  className="absolute bottom-0 inset-x-0 py-1 flex items-center justify-center text-[10px] font-bold"
                  style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#fff" }}
                >
                  {isUploading ? "…" : "PHOTO"}
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoFile}
              />
              <p className="text-xs text-muted-foreground">
                {photoPreview ? "Tap to change" : "Add a profile photo"}
              </p>
            </div>

            {/* Bio */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell people who you are in 1–2 sentences"
                rows={3}
                maxLength={200}
                className="w-full rounded-xl border px-3.5 py-2.5 text-sm bg-transparent text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/40 resize-none transition-shadow"
                style={{ borderColor: "var(--border)" }}
              />
              <p className="text-right text-[11px] text-muted-foreground">{bio.length}/200</p>
            </div>

            {/* City */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Atlanta, GA"
                className="w-full rounded-xl border px-3.5 py-2.5 text-sm bg-transparent text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/40 transition-shadow"
                style={{ borderColor: "var(--border)" }}
              />
            </div>

            {/* Genre pills */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Genre{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  (pick up to 3)
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((g) => {
                  const active = genres.includes(g);
                  const maxed  = genres.length >= 3 && !active;
                  return (
                    <button
                      key={g}
                      type="button"
                      disabled={maxed}
                      onClick={() => toggleGenre(g)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium border transition-all",
                        active
                          ? "border-accent text-foreground"
                          : "border-border text-muted-foreground hover:border-border/80",
                        maxed && "opacity-40 cursor-not-allowed"
                      )}
                      style={active ? { backgroundColor: "rgba(212,168,67,0.15)", borderColor: "#D4A843" } : {}}
                    >
                      {active && <CheckCircle2 size={10} className="inline mr-1" style={{ color: "#D4A843" }} />}
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && <p className="text-sm text-red-400 text-center">{error}</p>}

            <button
              type="button"
              onClick={handleStep1}
              disabled={saving || isUploading}
              className="w-full h-11 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: "#E85D4A", color: "#fff" }}
            >
              {saving || isUploading
                ? <><Loader2 size={16} className="animate-spin" /> Saving…</>
                : <>Continue <ArrowRight size={15} /></>
              }
            </button>

            <button
              type="button"
              onClick={() => save(1, { genres }).then((ok) => ok && setStep(2))}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip for now
            </button>
          </div>
        )}

        {/* ── Screen 2: Socials ─────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="text-center mb-2">
              <h1 className="font-display font-bold text-xl text-foreground tracking-tight">
                Connect your socials
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                All optional — add what you have
              </p>
            </div>

            <div className="space-y-3">
              {SOCIAL_FIELDS.map(({ key, label, placeholder, icon: Icon, prefix }) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {label}
                  </label>
                  <div className="flex items-center gap-2 rounded-xl border px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-accent/40 transition-shadow" style={{ borderColor: "var(--border)" }}>
                    <Icon size={15} className="shrink-0 text-muted-foreground" />
                    {prefix && (
                      <span className="text-sm text-muted-foreground select-none">{prefix}</span>
                    )}
                    <input
                      type="text"
                      value={socials[key]}
                      onChange={(e) => setSocials((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            {error && <p className="text-sm text-red-400 text-center">{error}</p>}

            <button
              type="button"
              onClick={handleStep2}
              disabled={saving}
              className="w-full h-11 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: "#E85D4A", color: "#fff" }}
            >
              {saving
                ? <><Loader2 size={16} className="animate-spin" /> Saving…</>
                : <>Continue <ArrowRight size={15} /></>
              }
            </button>

            <button
              type="button"
              onClick={skipStep2}
              disabled={saving}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
            >
              <SkipForward size={13} />
              Skip for now
            </button>
          </div>
        )}

        {/* ── Screen 3: First Action ────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="text-center mb-2">
              <div
                className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3"
                style={{ backgroundColor: "rgba(52,199,89,0.15)" }}
              >
                <CheckCircle2 size={24} style={{ color: "#34C759" }} />
              </div>
              <h1 className="font-display font-bold text-xl text-foreground tracking-tight">
                You&apos;re all set up!
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Now let&apos;s get your first piece of content on the platform.
              </p>
            </div>

            {/* Artist first actions */}
            {(signupPath === "artist" || signupPath === "producer") && (
              <div className="space-y-3">
                <ActionCard
                  icon={signupPath === "producer" ? <Music4 size={20} /> : <Mic2 size={20} />}
                  title={signupPath === "producer" ? "Upload your first beat" : "Upload your first track"}
                  description={signupPath === "producer"
                    ? "Add it to the marketplace and start earning"
                    : "Add it to your catalog and share with the world"
                  }
                  color="#E85D4A"
                  loading={saving}
                  onClick={() => completeSetup(
                    signupPath === "producer"
                      ? "/dashboard/producer/beats?upload=1"
                      : "/dashboard/music?upload=1"
                  )}
                  primary
                />
                <ActionCard
                  icon={<Globe size={20} />}
                  title="Explore the platform"
                  description="See what other independent artists are doing"
                  color="#5AC8FA"
                  loading={saving}
                  onClick={() => completeSetup("/explore")}
                />
              </div>
            )}

            {/* Studio first action */}
            {signupPath === "studio" && (
              <div className="space-y-3">
                <ActionCard
                  icon={<Building2 size={20} />}
                  title="Set up your studio page"
                  description="Add your name, photos, services, and go live"
                  color="#D4A843"
                  loading={saving}
                  onClick={() => completeSetup("/studio/setup")}
                  primary
                />
              </div>
            )}

            {/* Always show "Go to dashboard" */}
            <button
              type="button"
              onClick={() => completeSetup(signupPath === "studio" ? "/studio" : "/dashboard?welcome=1")}
              disabled={saving}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Go to my dashboard →
            </button>
          </div>
        )}

      </div>

      {/* Step label */}
      <p className="text-center text-xs text-muted-foreground mt-4">
        Step {step} of 3 — Quick Setup
      </p>
    </div>
  );
}

// ─── Action Card ──────────────────────────────────────────────────────────────

function ActionCard({
  icon, title, description, color, onClick, loading, primary,
}: {
  icon:        React.ReactNode;
  title:       string;
  description: string;
  color:       string;
  onClick:     () => void;
  loading:     boolean;
  primary?:    boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-all hover:border-accent/50 disabled:opacity-50"
      style={{
        backgroundColor: primary ? `${color}10` : "var(--card)",
        borderColor:     primary ? `${color}40` : "var(--border)",
      }}
    >
      <div
        className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-snug">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
      </div>
      <ArrowRight size={15} className="shrink-0 self-center text-muted-foreground" />
    </button>
  );
}
