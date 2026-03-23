"use client";

import { useEffect, useState } from "react";
import {
  User, Music2, Phone, Instagram, Youtube, Globe, Check, Link2, Camera, Loader2, Lock, Eye, EyeOff, AlertTriangle, X,
  Mic2, DollarSign, Radio, CreditCard, ChevronDown,
} from "lucide-react";
import { formatPhoneInput } from "@/lib/formatPhone";
import { useUploadThing } from "@/lib/uploadthing-client";

type UserSettings = {
  id: string;
  name: string;
  artistName: string | null;
  email: string;
  phone: string | null;
  bio: string | null;
  photo: string | null;
  instagramHandle: string | null;
  tiktokHandle: string | null;
  youtubeChannel: string | null;
  spotifyUrl: string | null;
  appleMusicUrl: string | null;
  artistSlug: string | null;
};

type ProducerProfileData = {
  id: string;
  displayName: string | null;
  bio: string | null;
  defaultLeasePrice: number | null;
  defaultNonExclusivePrice: number | null;
  defaultExclusivePrice: number | null;
  separatePayoutEnabled: boolean;
  producerStripeConnectId: string | null;
};

type ProducerLeaseSettingsData = {
  id: string;
  streamLeaseEnabled: boolean;
  revocationPolicy: string;
  contentRestrictions: string[];
  creditFormat: string;
};

const CONTENT_RESTRICTION_OPTIONS = [
  { value: "no_explicit",   label: "No explicit lyrics" },
  { value: "no_political",  label: "No political content" },
  { value: "no_religious",  label: "No religious content" },
  { value: "no_violence",   label: "No violent content" },
  { value: "no_commercial", label: "No commercial advertising use" },
];

const REVOCATION_POLICIES = [
  { value: "A", label: "A — 30-day written notice required" },
  { value: "B", label: "B — Violation only (breach of terms)" },
  { value: "C", label: "C — Cannot revoke (irrevocable license)" },
];

export default function SettingsPage() {
  const [userData, setUserData] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [artistName, setArtistName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [youtube, setYoutube] = useState("");
  const [spotify, setSpotify] = useState("");
  const [appleMusic, setAppleMusic] = useState("");
  const [slug, setSlug] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword]         = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw]     = useState(false);
  const [showNewPw, setShowNewPw]             = useState(false);
  const [pwSaving, setPwSaving]               = useState(false);
  const [pwSaved, setPwSaved]                 = useState(false);
  const [pwError, setPwError]                 = useState<string | null>(null);

  // Producer settings state
  const [producerProfile, setProducerProfile]         = useState<ProducerProfileData | null>(null);
  const [producerLeaseSettings, setProducerLeaseSettings] = useState<ProducerLeaseSettingsData | null>(null);
  const [producerLoaded, setProducerLoaded]           = useState(false);
  const [producerSaving, setProducerSaving]           = useState(false);
  const [producerSaved, setProducerSaved]             = useState(false);

  // Producer profile fields
  const [prodDisplayName, setProdDisplayName]               = useState("");
  const [prodBio, setProdBio]                               = useState("");
  const [prodLeasePrice, setProdLeasePrice]                 = useState("");
  const [prodNonExclusivePrice, setProdNonExclusivePrice]   = useState("");
  const [prodExclusivePrice, setProdExclusivePrice]         = useState("");
  const [prodSeparatePayout, setProdSeparatePayout]         = useState(false);

  // Producer lease settings fields
  const [prodStreamEnabled, setProdStreamEnabled]           = useState(true);
  const [prodRevocationPolicy, setProdRevocationPolicy]     = useState("A");
  const [prodRestrictions, setProdRestrictions]             = useState<string[]>([]);
  const [prodCreditFormat, setProdCreditFormat]             = useState("Prod. {producerName}");

  async function handlePasswordChange() {
    setPwError(null);
    if (newPassword !== confirmNewPassword) { setPwError("New passwords do not match."); return; }
    if (newPassword.length < 8)             { setPwError("New password must be at least 8 characters."); return; }
    setPwSaving(true);
    try {
      const res = await fetch("/api/dashboard/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setPwError(data.error ?? "Something went wrong."); return; }
      setPwSaved(true);
      setCurrentPassword(""); setNewPassword(""); setConfirmNewPassword("");
      setTimeout(() => setPwSaved(false), 2500);
    } finally {
      setPwSaving(false);
    }
  }

  const { startUpload: uploadPhoto, isUploading: photoUploading } = useUploadThing("profilePhoto", {
    onClientUploadComplete: async (res) => {
      const url = res[0]?.url;
      if (!url) return;
      setPhoto(url);
      // Persist immediately
      await fetch("/api/dashboard/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo: url }),
      });
    },
  });

  useEffect(() => {
    fetch("/api/dashboard/settings")
      .then((r) => r.json())
      .then((d) => {
        const u = d.user;
        setUserData(u);
        setName(u.name ?? "");
        setArtistName(u.artistName ?? "");
        setPhone(u.phone ?? "");
        setBio(u.bio ?? "");
        setInstagram(u.instagramHandle ?? "");
        setTiktok(u.tiktokHandle ?? "");
        setYoutube(u.youtubeChannel ?? "");
        setSpotify(u.spotifyUrl ?? "");
        setAppleMusic(u.appleMusicUrl ?? "");
        setSlug(u.artistSlug ?? "");
        setPhoto(u.photo ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Load producer settings separately
  useEffect(() => {
    fetch("/api/dashboard/producer/settings")
      .then((r) => r.json())
      .then((d: { profile: ProducerProfileData | null; leaseSettings: ProducerLeaseSettingsData | null }) => {
        setProducerProfile(d.profile);
        setProducerLeaseSettings(d.leaseSettings);
        if (d.profile) {
          setProdDisplayName(d.profile.displayName ?? "");
          setProdBio(d.profile.bio ?? "");
          setProdLeasePrice(d.profile.defaultLeasePrice?.toString() ?? "");
          setProdNonExclusivePrice(d.profile.defaultNonExclusivePrice?.toString() ?? "");
          setProdExclusivePrice(d.profile.defaultExclusivePrice?.toString() ?? "");
          setProdSeparatePayout(d.profile.separatePayoutEnabled);
        }
        if (d.leaseSettings) {
          setProdStreamEnabled(d.leaseSettings.streamLeaseEnabled);
          setProdRevocationPolicy(d.leaseSettings.revocationPolicy);
          setProdRestrictions(d.leaseSettings.contentRestrictions);
          setProdCreditFormat(d.leaseSettings.creditFormat);
        }
        setProducerLoaded(true);
      })
      .catch(() => setProducerLoaded(true));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSlugError(null);
    try {
      const res = await fetch("/api/dashboard/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, artistName, phone, bio,
          instagramHandle: instagram, tiktokHandle: tiktok,
          youtubeChannel: youtube, spotifyUrl: spotify,
          appleMusicUrl: appleMusic, artistSlug: slug,
        }),
      });
      if (res.status === 409) {
        setSlugError("That URL is already taken. Try a different one.");
      } else if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleProducerSave() {
    setProducerSaving(true);
    try {
      const res = await fetch("/api/dashboard/producer/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName:              prodDisplayName || undefined,
          bio:                      prodBio || undefined,
          defaultLeasePrice:        prodLeasePrice        ? parseFloat(prodLeasePrice)        : null,
          defaultNonExclusivePrice: prodNonExclusivePrice ? parseFloat(prodNonExclusivePrice) : null,
          defaultExclusivePrice:    prodExclusivePrice    ? parseFloat(prodExclusivePrice)    : null,
          separatePayoutEnabled:    prodSeparatePayout,
          streamLeaseEnabled:       prodStreamEnabled,
          revocationPolicy:         prodRevocationPolicy,
          contentRestrictions:      prodRestrictions,
          creditFormat:             prodCreditFormat || "Prod. {producerName}",
        }),
      });
      if (res.ok) {
        const d = await res.json() as { profile: ProducerProfileData; leaseSettings: ProducerLeaseSettingsData };
        setProducerProfile(d.profile);
        setProducerLeaseSettings(d.leaseSettings);
        setProducerSaved(true);
        setTimeout(() => setProducerSaved(false), 2500);
      }
    } finally {
      setProducerSaving(false);
    }
  }

  function toggleRestriction(value: string) {
    setProdRestrictions((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your artist profile</p>
      </div>

      {/* Profile Photo */}
      <Section title="Profile Photo" icon={<Camera size={15} className="text-accent" />}>
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            <div
              className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center border-2"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
            >
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User size={28} className="text-muted-foreground" />
              )}
            </div>
            {photoUploading && (
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                <Loader2 size={18} className="animate-spin text-white" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-colors hover:opacity-80"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              <Camera size={13} />
              {photoUploading ? "Uploading…" : photo ? "Change Photo" : "Upload Photo"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={photoUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadPhoto([file]);
                  e.target.value = "";
                }}
              />
            </label>
            <p className="text-xs text-muted-foreground">JPG, PNG, or WebP. Max 8 MB.</p>
          </div>
        </div>
      </Section>

      {/* Profile */}
      <Section title="Profile" icon={<User size={15} className="text-accent" />}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Full Name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
              className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50" style={{ borderColor: "var(--border)" }} />
          </Field>
          <Field label="Artist Name">
            <input value={artistName} onChange={(e) => setArtistName(e.target.value)} placeholder="Stage name"
              className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50" style={{ borderColor: "var(--border)" }} />
          </Field>
        </div>
        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(formatPhoneInput(e.target.value))} placeholder="(404) 555-0100"
            className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50" style={{ borderColor: "var(--border)" }} />
        </Field>
        <Field label="Bio">
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
            placeholder="Tell your story…"
            className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none resize-none focus:ring-2 focus:ring-accent/50"
            style={{ borderColor: "var(--border)" }} />
        </Field>
      </Section>

      {/* Artist URL */}
      <Section title="Artist URL" icon={<Link2 size={15} className="text-accent" />}>
        <Field label="Your public page URL" error={slugError}>
          <div className="flex items-center gap-0 rounded-xl border overflow-hidden focus-within:ring-2 focus-within:ring-accent/50" style={{ borderColor: "var(--border)" }}>
            <span className="px-3 py-2.5 text-sm text-muted-foreground bg-transparent border-r" style={{ borderColor: "var(--border)" }}>
              indiethis.com/
            </span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              placeholder="your-name"
              className="flex-1 px-3 py-2.5 text-sm bg-transparent text-foreground outline-none"
            />
          </div>
        </Field>
      </Section>

      {/* Socials */}
      <Section title="Social Links" icon={<Globe size={15} className="text-accent" />}>
        <Field label="Instagram" icon={<Instagram size={13} />}>
          <input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="yourhandle"
            className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50" style={{ borderColor: "var(--border)" }} />
        </Field>
        <Field label="TikTok">
          <input value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="@yourhandle"
            className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50" style={{ borderColor: "var(--border)" }} />
        </Field>
        <Field label="YouTube Channel" icon={<Youtube size={13} />}>
          <input value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="https://youtube.com/@..."
            className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50" style={{ borderColor: "var(--border)" }} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Spotify" icon={<Music2 size={13} />}>
            <input value={spotify} onChange={(e) => setSpotify(e.target.value)} placeholder="https://open.spotify.com/..."
              className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50" style={{ borderColor: "var(--border)" }} />
          </Field>
          <Field label="Apple Music">
            <input value={appleMusic} onChange={(e) => setAppleMusic(e.target.value)} placeholder="https://music.apple.com/..."
              className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50" style={{ borderColor: "var(--border)" }} />
          </Field>
        </div>
      </Section>

      {/* Change Password */}
      <Section title="Change Password" icon={<Lock size={15} className="text-accent" />}>
        <div className="space-y-3">
          <Field label="Current Password">
            <div className="relative">
              <input
                type={showCurrentPw ? "text" : "password"}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Your current password"
                autoComplete="current-password"
                className="w-full rounded-xl border px-3 py-2.5 pr-10 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                style={{ borderColor: "var(--border)" }}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrentPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="New Password">
              <div className="relative">
                <input
                  type={showNewPw ? "text" : "password"}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  className="w-full rounded-xl border px-3 py-2.5 pr-10 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                  style={{ borderColor: "var(--border)" }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>
            <Field label="Confirm New Password">
              <input
                type="password"
                value={confirmNewPassword}
                onChange={e => setConfirmNewPassword(e.target.value)}
                placeholder="Repeat new password"
                autoComplete="new-password"
                className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                style={{ borderColor: "var(--border)" }}
              />
            </Field>
          </div>
          {pwError && <p className="text-xs text-red-400">{pwError}</p>}
          <button
            onClick={handlePasswordChange}
            disabled={pwSaving || !currentPassword || !newPassword || !confirmNewPassword}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 border transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            {pwSaved
              ? <><Check size={13} className="text-emerald-400" /> Password Updated</>
              : pwSaving
              ? <><Loader2 size={13} className="animate-spin" /> Updating…</>
              : <><Lock size={13} /> Update Password</>}
          </button>
        </div>
      </Section>

      {/* ── Producer Settings (only when ProducerProfile exists) ─────────────── */}
      {producerLoaded && producerProfile && (
        <>
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-px flex-1" style={{ backgroundColor: "var(--border)" }} />
              <p className="text-[11px] font-bold tracking-[0.12em] uppercase px-2" style={{ color: "#D4A843" }}>
                Producer
              </p>
              <div className="h-px flex-1" style={{ backgroundColor: "var(--border)" }} />
            </div>
          </div>

          {/* Identity */}
          <Section title="Producer Identity" icon={<Mic2 size={15} style={{ color: "#D4A843" }} />}>
            <Field label="Producer Display Name">
              <input
                value={prodDisplayName}
                onChange={(e) => setProdDisplayName(e.target.value)}
                placeholder="Leave blank to use your artist name"
                className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                style={{ borderColor: "var(--border)" }}
              />
            </Field>
            <Field label={`Producer Bio (${prodBio.length}/300)`}>
              <textarea
                value={prodBio}
                onChange={(e) => setProdBio(e.target.value.slice(0, 300))}
                rows={3}
                placeholder="Tell artists about your production style"
                className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none resize-none focus:ring-2 focus:ring-accent/50"
                style={{ borderColor: "var(--border)" }}
              />
            </Field>
          </Section>

          {/* Default Pricing */}
          <Section title="Default Pricing" icon={<DollarSign size={15} style={{ color: "#D4A843" }} />}>
            <p className="text-xs text-muted-foreground -mt-1">These prices pre-fill when you upload new beats. You can override them per beat.</p>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Lease Price">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={prodLeasePrice}
                    onChange={(e) => setProdLeasePrice(e.target.value)}
                    placeholder="29.99"
                    className="w-full rounded-xl border pl-6 pr-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                    style={{ borderColor: "var(--border)" }}
                  />
                </div>
              </Field>
              <Field label="Non-Exclusive">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={prodNonExclusivePrice}
                    onChange={(e) => setProdNonExclusivePrice(e.target.value)}
                    placeholder="99.99"
                    className="w-full rounded-xl border pl-6 pr-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                    style={{ borderColor: "var(--border)" }}
                  />
                </div>
              </Field>
              <Field label="Exclusive">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={prodExclusivePrice}
                    onChange={(e) => setProdExclusivePrice(e.target.value)}
                    placeholder="499.99"
                    className="w-full rounded-xl border pl-6 pr-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                    style={{ borderColor: "var(--border)" }}
                  />
                </div>
              </Field>
            </div>
          </Section>

          {/* Default Stream Lease Settings */}
          <Section title="Default Stream Lease Settings" icon={<Radio size={15} style={{ color: "#D4A843" }} />}>
            <p className="text-xs text-muted-foreground -mt-1">These defaults apply to new beats. You can override them per beat.</p>

            {/* Stream lease enabled toggle */}
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium text-foreground">Stream Lease enabled by default</p>
                <p className="text-xs text-muted-foreground">New beats will have stream leasing turned on</p>
              </div>
              <button
                type="button"
                onClick={() => setProdStreamEnabled((v) => !v)}
                className="relative w-10 h-6 rounded-full transition-colors shrink-0"
                style={{ backgroundColor: prodStreamEnabled ? "#D4A843" : "var(--border)" }}
              >
                <span
                  className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform"
                  style={{ transform: prodStreamEnabled ? "translateX(16px)" : "translateX(0)" }}
                />
              </button>
            </div>

            {/* Revocation policy */}
            <Field label="Default Revocation Policy">
              <div className="relative">
                <select
                  value={prodRevocationPolicy}
                  onChange={(e) => setProdRevocationPolicy(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none appearance-none focus:ring-2 focus:ring-accent/50 cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                >
                  {REVOCATION_POLICIES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </Field>

            {/* Content restrictions */}
            <Field label="Default Content Restrictions">
              <div className="grid grid-cols-2 gap-2">
                {CONTENT_RESTRICTION_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
                    <div
                      onClick={() => toggleRestriction(opt.value)}
                      className="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                      style={{
                        borderColor: prodRestrictions.includes(opt.value) ? "#D4A843" : "var(--border)",
                        backgroundColor: prodRestrictions.includes(opt.value) ? "#D4A843" : "transparent",
                      }}
                    >
                      {prodRestrictions.includes(opt.value) && <Check size={10} style={{ color: "#0A0A0A" }} />}
                    </div>
                    <span className="text-sm text-foreground group-hover:text-foreground/80 select-none" onClick={() => toggleRestriction(opt.value)}>
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </Field>

            {/* Credit format */}
            <Field label="Default Credit Format">
              <input
                value={prodCreditFormat}
                onChange={(e) => setProdCreditFormat(e.target.value)}
                placeholder={`Prod. ${prodDisplayName || artistName || "Your Name"}`}
                className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                style={{ borderColor: "var(--border)" }}
              />
              <p className="text-[11px] text-muted-foreground">
                Use <code className="text-accent">{"{producerName}"}</code> as a placeholder for your name.
                Artists using your beats will credit you this way.
              </p>
            </Field>
          </Section>

          {/* Payout Settings */}
          <Section title="Payout Settings" icon={<CreditCard size={15} style={{ color: "#D4A843" }} />}>
            {/* Same payout toggle */}
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium text-foreground">Use same payout account as artist earnings</p>
                <p className="text-xs text-muted-foreground">Producer earnings go to your main payout account</p>
              </div>
              <button
                type="button"
                onClick={() => setProdSeparatePayout((v) => !v)}
                className="relative w-10 h-6 rounded-full transition-colors shrink-0"
                style={{ backgroundColor: !prodSeparatePayout ? "#D4A843" : "var(--border)" }}
              >
                <span
                  className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform"
                  style={{ transform: !prodSeparatePayout ? "translateX(16px)" : "translateX(0)" }}
                />
              </button>
            </div>

            {/* Separate Stripe Connect CTA */}
            {prodSeparatePayout && (
              <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}>
                {producerProfile.producerStripeConnectId ? (
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-400" />
                    <p className="text-sm text-foreground font-medium">Separate Stripe account connected</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-foreground font-medium">Connect a separate Stripe account</p>
                    <p className="text-xs text-muted-foreground">
                      Producer earnings will be paid out to a different Stripe Connect account than your artist earnings.
                    </p>
                    <button
                      type="button"
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors hover:bg-white/5"
                      style={{ borderColor: "#D4A843", color: "#D4A843" }}
                      onClick={() => {
                        // Stripe Connect onboarding — will be wired in a future phase
                        alert("Stripe Connect setup coming soon.");
                      }}
                    >
                      <CreditCard size={13} />
                      Connect Stripe Account
                    </button>
                  </>
                )}
              </div>
            )}
          </Section>

          {/* Producer save button */}
          <button
            onClick={handleProducerSave}
            disabled={producerSaving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            {producerSaved
              ? <><Check size={14} /> Producer Settings Saved</>
              : producerSaving
              ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
              : "Save Producer Settings"}
          </button>

          <div className="h-px" style={{ backgroundColor: "var(--border)" }} />
        </>
      )}

      {userData && (
        <p className="text-xs text-muted-foreground">Account email: <span className="text-foreground">{userData.email}</span></p>
      )}

      <button
        onClick={handleSave}
        disabled={saving || !name.trim()}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
        style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
      >
        {saved ? <><Check size={14} /> Saved</> : saving ? "Saving…" : "Save Changes"}
      </button>

      <CancelSubscriptionSection />
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-6 space-y-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: "var(--border)" }}>
        {icon}
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

const CANCEL_REASONS = [
  "Too expensive",
  "Not enough features",
  "Switched platforms",
  "Not using it",
  "Other",
];

function CancelSubscriptionSection() {
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState("");
  const [canceling, setCanceling] = useState(false);
  const [canceled, setCanceled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    if (!reason) { setError("Please select a reason."); return; }
    setCanceling(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancelReason: reason }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
      setCanceled(true);
      setShowModal(false);
    } finally {
      setCanceling(false);
    }
  }

  if (canceled) {
    return (
      <div className="rounded-2xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <p className="text-sm text-muted-foreground">Your subscription has been canceled. You&apos;ll retain access until the end of your billing period.</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border p-5 flex items-center justify-between" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div>
          <p className="text-sm font-semibold text-foreground">Cancel Subscription</p>
          <p className="text-xs text-muted-foreground mt-0.5">You&apos;ll keep access until your billing period ends.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
          style={{ borderColor: "rgba(239,68,68,0.4)", color: "#ef4444" }}
        >
          Cancel Plan
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-sm rounded-2xl border p-6 space-y-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
                  <AlertTriangle size={16} style={{ color: "#ef4444" }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Why are you leaving?</p>
                  <p className="text-xs text-muted-foreground">Your feedback helps us improve.</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2">
              {CANCEL_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className="w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-all"
                  style={{
                    borderColor: reason === r ? "rgba(239,68,68,0.5)" : "var(--border)",
                    backgroundColor: reason === r ? "rgba(239,68,68,0.08)" : "transparent",
                    color: reason === r ? "#ef4444" : "var(--foreground)",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border text-sm font-semibold"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                Keep my plan
              </button>
              <button
                onClick={handleCancel}
                disabled={canceling || !reason}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: "#ef4444", color: "#fff" }}
              >
                {canceling ? "Canceling…" : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, icon, error, children }: { label: string; icon?: React.ReactNode; error?: string | null; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
