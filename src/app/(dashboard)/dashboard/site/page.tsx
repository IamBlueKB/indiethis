"use client";

import { useState } from "react";
import { Globe, Eye, EyeOff, ExternalLink, Pencil, Check, ImagePlus, Loader2, Instagram, Heart, Award, Plus, X, DollarSign } from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-client";
import { useArtistSite, useUpdateSite } from "@/hooks/queries";
import Link from "next/link";

export default function ArtistSitePage() {
  const { data, isLoading } = useArtistSite();
  const site = data?.site ?? null;
  const slug = data?.slug ?? null;
  const instagramHandle = data?.instagramHandle ?? null;

  const { mutate: updateSite, isPending: saving } = useUpdateSite();

  const [togglingDraft, setTogglingDraft] = useState(false);
  const [editingBio, setEditingBio]       = useState(false);
  const [bio, setBio]                     = useState("");
  const [savingBio, setSavingBio]         = useState(false);
  const [togglingGate,    setTogglingGate]    = useState(false);
  const [togglingPwyw,    setTogglingPwyw]    = useState(false);
  const [newCredential,   setNewCredential]   = useState("");
  const [savingCreds,     setSavingCreds]     = useState(false);
  const [bookingRateInput, setBookingRateInput] = useState("");
  const [editingRate,      setEditingRate]      = useState(false);
  const [savingRate,       setSavingRate]       = useState(false);

  // Sync bio from server data when it first loads
  const bioValue = editingBio ? bio : (site?.bioContent ?? "");

  const { startUpload: uploadHeader, isUploading: headerUploading } = useUploadThing(
    "siteHeaderImage",
    {
      onClientUploadComplete: async (res) => {
        const url = res[0]?.url;
        if (url) updateSite({ heroImage: url } as never);
      },
    }
  );

  async function togglePublish() {
    if (!site) return;
    setTogglingDraft(true);
    const nowPublished = !site.isPublished;
    updateSite(
      { draftMode: !nowPublished, isPublished: nowPublished } as never,
      { onSettled: () => setTogglingDraft(false) }
    );
  }

  async function saveBio() {
    if (!site) return;
    setSavingBio(true);
    updateSite(
      { bioContent: bio } as never,
      {
        onSuccess: () => setEditingBio(false),
        onSettled: () => setSavingBio(false),
      }
    );
  }

  async function toggleFollowGate() {
    if (!site) return;
    setTogglingGate(true);
    updateSite(
      { followGateEnabled: !site.followGateEnabled } as never,
      { onSettled: () => setTogglingGate(false) }
    );
  }

  async function togglePwyw() {
    if (!site) return;
    setTogglingPwyw(true);
    updateSite(
      { pwywEnabled: !site.pwywEnabled } as never,
      { onSettled: () => setTogglingPwyw(false) }
    );
  }

  const currentCredentials: string[] = (site as { credentials?: string[] })?.credentials ?? [];
  const currentBookingRate: number | null = (site as { bookingRate?: number | null })?.bookingRate ?? null;

  async function saveBookingRate() {
    setSavingRate(true);
    const parsed = bookingRateInput.trim() === "" ? null : parseFloat(bookingRateInput);
    updateSite(
      { bookingRate: isNaN(parsed as number) ? null : parsed } as never,
      {
        onSuccess: () => setEditingRate(false),
        onSettled: () => setSavingRate(false),
      }
    );
  }

  async function addCredential() {
    const trimmed = newCredential.trim();
    if (!trimmed || currentCredentials.includes(trimmed)) return;
    setSavingCreds(true);
    const next = [...currentCredentials, trimmed];
    updateSite(
      { credentials: next } as never,
      {
        onSuccess: () => setNewCredential(""),
        onSettled: () => setSavingCreds(false),
      }
    );
  }

  async function removeCredential(badge: string) {
    setSavingCreds(true);
    const next = currentCredentials.filter((c) => c !== badge);
    updateSite(
      { credentials: next } as never,
      { onSettled: () => setSavingCreds(false) }
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  const isLive    = site?.isPublished && !site?.draftMode;
  const publicUrl = slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/${slug}`
    : null;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Artist Site</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your public profile page</p>
      </div>

      {!site ? (
        <div
          className="rounded-2xl border py-16 text-center space-y-3"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <Globe size={40} className="mx-auto text-muted-foreground opacity-40" />
          <p className="text-sm font-semibold text-foreground">No artist site yet</p>
          <p className="text-xs text-muted-foreground">
            Set an artist URL in Settings to activate your page.
          </p>
        </div>
      ) : (
        <>
          {/* Status card */}
          <div
            className="rounded-2xl border p-5 flex items-center justify-between"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {isLive ? (
                  <Eye size={15} className="text-emerald-400" />
                ) : (
                  <EyeOff size={15} className="text-yellow-400" />
                )}
                <span className={`text-sm font-semibold ${isLive ? "text-emerald-400" : "text-yellow-400"}`}>
                  {isLive ? "Live — Visible to public" : "Draft — Not visible to public"}
                </span>
              </div>
              {publicUrl && isLive && (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground no-underline"
                >
                  <ExternalLink size={11} /> {publicUrl}
                </a>
              )}
            </div>
            <button
              onClick={togglePublish}
              disabled={togglingDraft || saving}
              className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-opacity"
              style={
                isLive
                  ? { border: "1px solid var(--border)", color: "var(--foreground)" }
                  : { backgroundColor: "#D4A843", color: "#0A0A0A" }
              }
            >
              {togglingDraft || saving ? "Saving…" : isLive ? "Unpublish" : "Publish Site"}
            </button>
          </div>

          {/* Header image */}
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            {site.heroImage ? (
              <div className="relative h-40 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={site.heroImage}
                  alt="Site header"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <label
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer"
                    style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                  >
                    {headerUploading
                      ? <><Loader2 size={13} className="animate-spin" /> Uploading…</>
                      : <><ImagePlus size={13} /> Change Header</>}
                    <input type="file" accept="image/*" className="sr-only" disabled={headerUploading}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadHeader([f]); e.target.value = ""; }} />
                  </label>
                </div>
              </div>
            ) : (
              <div
                className="h-32 flex flex-col items-center justify-center gap-2 border-b"
                style={{ borderColor: "var(--border)" }}
              >
                <ImagePlus size={22} className="text-muted-foreground opacity-40" />
                <p className="text-xs text-muted-foreground">No header image</p>
              </div>
            )}
            <div className="px-5 py-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Header Image</h2>
                <p className="text-xs text-muted-foreground">
                  Shown at the top of your public artist page. Max 16 MB.
                </p>
              </div>
              <label
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors hover:bg-white/5"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                {headerUploading
                  ? <><Loader2 size={12} className="animate-spin" /> Uploading…</>
                  : <><ImagePlus size={12} /> {site.heroImage ? "Replace" : "Upload"}</>}
                <input type="file" accept="image/*" className="sr-only" disabled={headerUploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadHeader([f]); e.target.value = ""; }} />
              </label>
            </div>
          </div>

          {/* Bio */}
          <div
            className="rounded-2xl border p-5 space-y-3"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Site Bio</h2>
              {!editingBio ? (
                <button
                  onClick={() => { setBio(site.bioContent ?? ""); setEditingBio(true); }}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                >
                  <Pencil size={13} />
                </button>
              ) : (
                <div className="flex gap-1">
                  <button
                    onClick={saveBio}
                    disabled={savingBio}
                    className="p-1.5 rounded-lg text-emerald-400 hover:bg-white/5 disabled:opacity-50"
                  >
                    <Check size={13} />
                  </button>
                  <button
                    onClick={() => setEditingBio(false)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-white/5"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
            {editingBio ? (
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={5}
                placeholder="Tell the world about yourself…"
                className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none resize-none focus:ring-2 focus:ring-accent/50"
                style={{ borderColor: "var(--border)" }}
              />
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {bioValue || "No bio yet. Click the pencil to add one."}
              </p>
            )}
          </div>

          {/* Credential Badges */}
          <div
            className="rounded-2xl border p-5 space-y-4"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(212,168,67,0.10)" }}
              >
                <Award size={16} className="text-accent" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Credential Badges</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Highlight achievements shown on your About section (e.g. &quot;500K+ Streams&quot;)
                </p>
              </div>
            </div>

            {/* Existing badges */}
            {currentCredentials.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {currentCredentials.map((badge) => (
                  <span
                    key={badge}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: "rgba(212,168,67,0.10)",
                      border:          "1px solid rgba(212,168,67,0.20)",
                      color:           "#D4A843",
                    }}
                  >
                    {badge}
                    <button
                      onClick={() => removeCredential(badge)}
                      disabled={savingCreds}
                      className="hover:opacity-70 transition-opacity disabled:opacity-40 ml-0.5"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Add new badge */}
            {currentCredentials.length < 8 && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCredential}
                  onChange={(e) => setNewCredential(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCredential()}
                  placeholder="e.g. 500K+ Streams"
                  maxLength={60}
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg border text-sm bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1"
                  style={{ borderColor: "var(--border)" }}
                />
                <button
                  onClick={addCredential}
                  disabled={savingCreds || !newCredential.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border disabled:opacity-40 transition-colors hover:bg-white/5 shrink-0"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                >
                  {savingCreds
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Plus size={12} />}
                  Add
                </button>
              </div>
            )}
            {currentCredentials.length >= 8 && (
              <p className="text-xs text-muted-foreground">Maximum 8 badges reached.</p>
            )}
          </div>

          {/* Instagram Follow Gate */}
          <div
            className="rounded-2xl border p-5"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: site.followGateEnabled ? "rgba(212,168,67,0.15)" : "rgba(255,255,255,0.06)" }}
                >
                  <Instagram size={16} className={site.followGateEnabled ? "text-accent" : "text-muted-foreground"} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Instagram Follow Gate</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Require fans to follow your Instagram before downloading free tracks
                  </p>
                </div>
              </div>
              <button
                onClick={toggleFollowGate}
                disabled={togglingGate || saving || !instagramHandle}
                className="relative w-11 h-6 rounded-full transition-colors disabled:opacity-40"
                style={{ backgroundColor: site.followGateEnabled ? "#D4A843" : "var(--border)" }}
                title={!instagramHandle ? "Set your Instagram handle in Settings first" : undefined}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                  style={{ left: site.followGateEnabled ? "calc(100% - 22px)" : "2px" }}
                />
              </button>
            </div>
            {!instagramHandle && (
              <p className="mt-3 text-xs text-yellow-400/80 flex items-center gap-1.5">
                <Instagram size={11} />
                Add your Instagram handle in{" "}
                <Link href="/dashboard/settings" className="underline hover:text-yellow-400">
                  Settings
                </Link>{" "}
                to enable this feature.
              </p>
            )}
            {instagramHandle && site.followGateEnabled && (
              <p className="mt-3 text-xs text-emerald-400/80 flex items-center gap-1.5">
                <Check size={11} />
                Active — fans must follow @{instagramHandle} to download free tracks
              </p>
            )}
          </div>

          {/* Pay What You Want */}
          <div
            className="rounded-2xl border p-5"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: site.pwywEnabled ? "rgba(232,93,74,0.15)" : "rgba(255,255,255,0.06)" }}
                >
                  <Heart size={16} style={{ color: site.pwywEnabled ? "#E85D4A" : undefined }} className={site.pwywEnabled ? "" : "text-muted-foreground"} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Support / Tip Jar</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Let fans support you with a pay-what-you-want tip directly on your page
                  </p>
                </div>
              </div>
              <button
                onClick={togglePwyw}
                disabled={togglingPwyw || saving}
                className="relative w-11 h-6 rounded-full transition-colors disabled:opacity-40"
                style={{ backgroundColor: site.pwywEnabled ? "#E85D4A" : "var(--border)" }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                  style={{ left: site.pwywEnabled ? "calc(100% - 22px)" : "2px" }}
                />
              </button>
            </div>
            {site.pwywEnabled && (
              <p className="mt-3 text-xs text-emerald-400/80 flex items-center gap-1.5">
                <Check size={11} />
                Active — a &quot;Support&quot; section is visible on your artist page
              </p>
            )}
          </div>

          {/* Booking Rate */}
          <div
            className="rounded-2xl border p-5 space-y-3"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "rgba(212,168,67,0.10)" }}
                >
                  <DollarSign size={16} className="text-accent" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Booking Rate</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Display a starting rate on your booking form (optional)
                  </p>
                </div>
              </div>
              {!editingRate ? (
                <button
                  onClick={() => {
                    setBookingRateInput(currentBookingRate !== null ? String(currentBookingRate) : "");
                    setEditingRate(true);
                  }}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                >
                  <Pencil size={13} />
                </button>
              ) : (
                <div className="flex gap-1">
                  <button
                    onClick={saveBookingRate}
                    disabled={savingRate}
                    className="p-1.5 rounded-lg text-emerald-400 hover:bg-white/5 disabled:opacity-50"
                  >
                    {savingRate ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  </button>
                  <button
                    onClick={() => setEditingRate(false)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-white/5"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
            {editingRate ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">$</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={bookingRateInput}
                  onChange={(e) => setBookingRateInput(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-36 px-3 py-2 rounded-lg border text-sm bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1"
                  style={{ borderColor: "var(--border)" }}
                />
                <span className="text-xs text-muted-foreground">Leave blank to hide</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {currentBookingRate !== null && currentBookingRate > 0
                  ? <span>Shown as <span className="font-semibold" style={{ color: "#D4A843" }}>${currentBookingRate.toLocaleString()}</span> on your booking form</span>
                  : "Not set — no rate will be shown on your booking form"}
              </p>
            )}
          </div>

          {/* View link */}
          {publicUrl && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold border transition-colors hover:bg-white/5 text-muted-foreground no-underline"
              style={{ borderColor: "var(--border)" }}
            >
              <ExternalLink size={15} />
              View Your Public Site
            </a>
          )}
        </>
      )}
    </div>
  );
}
