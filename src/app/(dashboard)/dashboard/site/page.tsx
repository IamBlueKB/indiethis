"use client";

import { useState, useEffect } from "react";
import { Globe, Eye, EyeOff, ExternalLink, Pencil, Check, ImagePlus, Loader2, Instagram, Heart, Award, Plus, X, DollarSign, QrCode, Bell, ChevronDown, ChevronUp, Trash2, Activity } from "lucide-react";
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
  const [qrPreviewLoaded,  setQrPreviewLoaded]  = useState(false);

  // ── Artist Identity ──────────────────────────────────────────────────────────
  const [genreInput,       setGenreInput]       = useState("");
  const [roleInput,        setRoleInput]        = useState("");
  const [cityInput,        setCityInput]        = useState("");
  const [soundcloudInput,  setSoundcloudInput]  = useState("");
  const [savingIdentity,   setSavingIdentity]   = useState(false);

  // ── Pinned Announcement ──────────────────────────────────────────────────────
  const [pinnedOpen,       setPinnedOpen]       = useState(false);
  const [pinnedMsg,        setPinnedMsg]        = useState("");
  const [pinnedActionText, setPinnedActionText] = useState("");
  const [pinnedActionUrl,  setPinnedActionUrl]  = useState("");
  const [savingPinned,     setSavingPinned]     = useState(false);

  // ── Activity Ticker ──────────────────────────────────────────────────────────
  const [togglingTicker,   setTogglingTicker]   = useState(false);

  // ── Photo Gallery ────────────────────────────────────────────────────────────
  const [photosOpen,  setPhotosOpen]  = useState(false);
  const [photos,      setPhotos]      = useState<{ id: string; imageUrl: string; caption: string | null }[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  // ── Testimonials ─────────────────────────────────────────────────────────────
  const [testimsOpen,  setTestimsOpen]  = useState(false);
  const [testims,      setTestims]      = useState<{ id: string; quote: string; attribution: string }[]>([]);
  const [newQuote,     setNewQuote]     = useState("");
  const [newAttrib,    setNewAttrib]    = useState("");
  const [savingTestim, setSavingTestim] = useState(false);

  // ── Collaborators ────────────────────────────────────────────────────────────
  const [collabsOpen,    setCollabsOpen]    = useState(false);
  const [collabs,        setCollabs]        = useState<{ id: string; name: string; photoUrl: string | null; artistSlug: string | null }[]>([]);
  const [newCollabName,  setNewCollabName]  = useState("");
  const [newCollabSlug,  setNewCollabSlug]  = useState("");
  const [savingCollab,   setSavingCollab]   = useState(false);

  // ── Press ────────────────────────────────────────────────────────────────────
  const [pressOpen,    setPressOpen]    = useState(false);
  const [pressItems,   setPressItems]   = useState<{ id: string; source: string; title: string; url: string }[]>([]);
  const [newPressSource, setNewPressSource] = useState("");
  const [newPressTitle,  setNewPressTitle]  = useState("");
  const [newPressUrl,    setNewPressUrl]    = useState("");
  const [savingPress,  setSavingPress]  = useState(false);

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

  const { startUpload: uploadPhoto, isUploading: photoUploading } = useUploadThing(
    "siteHeaderImage",
    {
      onClientUploadComplete: async (res) => {
        const url = res[0]?.url;
        if (!url) return;
        const result = await fetch("/api/dashboard/artist-photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: url }),
        });
        const data = await result.json();
        if (data.photo) setPhotos((p) => [...p, data.photo]);
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

  // Sync identity fields from loaded site data
  useEffect(() => {
    if (!site) return;
    const s = site as { genre?: string | null; role?: string | null; city?: string | null; soundcloudUrl?: string | null };
    setGenreInput(s.genre ?? "");
    setRoleInput(s.role ?? "");
    setCityInput(s.city ?? "");
    setSoundcloudInput(s.soundcloudUrl ?? "");
  }, [site]);

  // Sync pinned state from loaded site data
  useEffect(() => {
    if (!site) return;
    const s = site as { pinnedMessage?: string | null; pinnedActionText?: string | null; pinnedActionUrl?: string | null };
    setPinnedMsg(s.pinnedMessage ?? "");
    setPinnedActionText(s.pinnedActionText ?? "");
    setPinnedActionUrl(s.pinnedActionUrl ?? "");
  }, [site]);

  async function saveIdentity() {
    setSavingIdentity(true);
    updateSite(
      { genre: genreInput || null, role: roleInput || null, city: cityInput || null, soundcloudUrl: soundcloudInput || null } as never,
      { onSettled: () => setSavingIdentity(false) }
    );
  }

  async function savePinned() {
    setSavingPinned(true);
    updateSite(
      { pinnedMessage: pinnedMsg || null, pinnedActionText: pinnedActionText || null, pinnedActionUrl: pinnedActionUrl || null } as never,
      { onSettled: () => setSavingPinned(false) }
    );
  }

  async function toggleTicker() {
    if (!site) return;
    setTogglingTicker(true);
    const current = (site as { activityTickerEnabled?: boolean }).activityTickerEnabled ?? false;
    updateSite(
      { activityTickerEnabled: !current } as never,
      { onSettled: () => setTogglingTicker(false) }
    );
  }

  async function loadPhotos() {
    setLoadingPhotos(true);
    const res = await fetch("/api/dashboard/artist-photos");
    const data = await res.json();
    setPhotos(data.photos ?? []);
    setLoadingPhotos(false);
  }

  async function deletePhoto(id: string) {
    await fetch("/api/dashboard/artist-photos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setPhotos((p) => p.filter((x) => x.id !== id));
  }

  async function loadTestimonials() {
    const res = await fetch("/api/dashboard/artist-testimonials");
    const data = await res.json();
    setTestims(data.testimonials ?? []);
  }

  async function addTestimonial() {
    if (!newQuote.trim() || !newAttrib.trim()) return;
    setSavingTestim(true);
    const res = await fetch("/api/dashboard/artist-testimonials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quote: newQuote.trim(), attribution: newAttrib.trim() }),
    });
    const data = await res.json();
    if (data.item) {
      setTestims((t) => [...t, data.item]);
      setNewQuote(""); setNewAttrib("");
    }
    setSavingTestim(false);
  }

  async function deleteTestimonial(id: string) {
    await fetch("/api/dashboard/artist-testimonials", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setTestims((t) => t.filter((x) => x.id !== id));
  }

  async function loadCollaborators() {
    const res = await fetch("/api/dashboard/artist-collaborators");
    const data = await res.json();
    setCollabs(data.collaborators ?? []);
  }

  async function addCollaborator() {
    if (!newCollabName.trim()) return;
    setSavingCollab(true);
    const res = await fetch("/api/dashboard/artist-collaborators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCollabName.trim(), artistSlug: newCollabSlug.trim() || undefined }),
    });
    const data = await res.json();
    if (data.item) {
      setCollabs((c) => [...c, data.item]);
      setNewCollabName(""); setNewCollabSlug("");
    }
    setSavingCollab(false);
  }

  async function deleteCollaborator(id: string) {
    await fetch("/api/dashboard/artist-collaborators", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setCollabs((c) => c.filter((x) => x.id !== id));
  }

  async function loadPressItems() {
    const res = await fetch("/api/dashboard/artist-press-items");
    const data = await res.json();
    setPressItems(data.items ?? []);
  }

  async function addPressItem() {
    if (!newPressSource.trim() || !newPressTitle.trim() || !newPressUrl.trim()) return;
    setSavingPress(true);
    const res = await fetch("/api/dashboard/artist-press-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: newPressSource.trim(), title: newPressTitle.trim(), url: newPressUrl.trim() }),
    });
    const data = await res.json();
    if (data.item) {
      setPressItems((p) => [...p, data.item]);
      setNewPressSource(""); setNewPressTitle(""); setNewPressUrl("");
    }
    setSavingPress(false);
  }

  async function deletePressItem(id: string) {
    await fetch("/api/dashboard/artist-press-items", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setPressItems((p) => p.filter((x) => x.id !== id));
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

          {/* Artist Identity */}
          <div
            className="rounded-2xl border p-5 space-y-4"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <h2 className="text-sm font-semibold text-foreground">Artist Identity</h2>
            <p className="text-xs text-muted-foreground -mt-2">
              Shown as <span className="text-foreground font-medium">genre · role · city</span> under your name in the hero.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Genre</label>
                <input
                  type="text"
                  value={genreInput}
                  onChange={(e) => setGenreInput(e.target.value)}
                  placeholder="e.g. Hip-Hop"
                  maxLength={40}
                  className="w-full px-3 py-2 rounded-lg border text-sm bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Role</label>
                <input
                  type="text"
                  value={roleInput}
                  onChange={(e) => setRoleInput(e.target.value)}
                  placeholder="e.g. Producer"
                  maxLength={40}
                  className="w-full px-3 py-2 rounded-lg border text-sm bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">City</label>
                <input
                  type="text"
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  placeholder="e.g. Atlanta"
                  maxLength={40}
                  className="w-full px-3 py-2 rounded-lg border text-sm bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">SoundCloud URL</label>
              <input
                type="url"
                value={soundcloudInput}
                onChange={(e) => setSoundcloudInput(e.target.value)}
                placeholder="https://soundcloud.com/yourname"
                className="w-full px-3 py-2 rounded-lg border text-sm bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
            <button
              onClick={saveIdentity}
              disabled={savingIdentity}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              {savingIdentity ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : <><Check size={13} /> Save Identity</>}
            </button>
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

          {/* QR Code — link to dedicated QR page */}
          {slug && isLive && (
            <Link
              href="/dashboard/qr"
              className="rounded-2xl border p-4 flex items-center gap-4 no-underline transition-colors hover:bg-white/5"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              {/* Thumbnail */}
              <div
                className="w-14 h-14 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
                style={{ border: "1px solid var(--border)", backgroundColor: "white" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/api/dashboard/qr-code?format=png"
                  alt="Your QR code"
                  width={56}
                  height={56}
                  onLoad={() => setQrPreviewLoaded(true)}
                  className={`w-full h-full object-cover transition-opacity ${qrPreviewLoaded ? "opacity-100" : "opacity-0"}`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">QR Code</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Download PNG &amp; SVG, view scan stats
                </p>
              </div>
              <ExternalLink size={14} className="text-muted-foreground shrink-0" />
            </Link>
          )}

          {/* ── Pinned Announcement ────────────────────────────────────────── */}
          <div
            className="rounded-2xl border"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <button
              onClick={() => setPinnedOpen((v) => !v)}
              className="w-full flex items-center justify-between p-5 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(232,93,74,0.10)" }}>
                  <Bell size={16} style={{ color: "#E85D4A" }} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Pinned Announcement</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Show a banner message at the top of your page</p>
                </div>
              </div>
              {pinnedOpen ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
            </button>
            {pinnedOpen && (
              <div className="px-5 pb-5 space-y-3 border-t" style={{ borderColor: "var(--border)" }}>
                <div className="pt-4 space-y-2">
                  <textarea
                    value={pinnedMsg}
                    onChange={(e) => setPinnedMsg(e.target.value)}
                    placeholder="Announcement message (e.g. 'New album out now!')"
                    rows={2}
                    className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent text-foreground placeholder:text-muted-foreground outline-none resize-none"
                    style={{ borderColor: "var(--border)" }}
                  />
                  <div className="flex gap-2">
                    <input type="text" value={pinnedActionText} onChange={(e) => setPinnedActionText(e.target.value)} placeholder="Button label (optional)" className="flex-1 rounded-xl border px-3 py-2 text-sm bg-transparent text-foreground placeholder:text-muted-foreground outline-none" style={{ borderColor: "var(--border)" }} />
                    <input type="url" value={pinnedActionUrl} onChange={(e) => setPinnedActionUrl(e.target.value)} placeholder="Button URL (optional)" className="flex-1 rounded-xl border px-3 py-2 text-sm bg-transparent text-foreground placeholder:text-muted-foreground outline-none" style={{ borderColor: "var(--border)" }} />
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-muted-foreground">Leave empty to hide the announcement</p>
                    <button onClick={savePinned} disabled={savingPinned} className="px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-all hover:brightness-110" style={{ backgroundColor: "#E85D4A", color: "#fff" }}>
                      {savingPinned ? <Loader2 size={11} className="animate-spin" /> : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Activity Ticker ─────────────────────────────────────────────── */}
          <div
            className="rounded-2xl border p-5"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(76,175,80,0.10)" }}>
                  <Activity size={16} style={{ color: "#4CAF50" }} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Activity Ticker</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Show live activity (purchases, pre-saves, listeners) as a scrolling bar</p>
                </div>
              </div>
              <button
                onClick={toggleTicker}
                disabled={togglingTicker || saving}
                className="relative w-11 h-6 rounded-full transition-colors disabled:opacity-40"
                style={{ backgroundColor: (site as { activityTickerEnabled?: boolean })?.activityTickerEnabled ? "#4CAF50" : "var(--border)" }}
              >
                <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform" style={{ left: (site as { activityTickerEnabled?: boolean })?.activityTickerEnabled ? "calc(100% - 22px)" : "2px" }} />
              </button>
            </div>
          </div>

          {/* ── Photo Gallery ────────────────────────────────────────────────── */}
          <div
            className="rounded-2xl border"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <button
              onClick={() => { setPhotosOpen((v) => !v); if (!photosOpen) loadPhotos(); }}
              className="w-full flex items-center justify-between p-5 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(212,168,67,0.10)" }}>
                  <ImagePlus size={16} className="text-accent" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Photo Gallery</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Add up to 9 photos to your artist page gallery</p>
                </div>
              </div>
              {photosOpen ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
            </button>
            {photosOpen && (
              <div className="px-5 pb-5 space-y-3 border-t" style={{ borderColor: "var(--border)" }}>
                <div className="pt-4">
                  {loadingPhotos ? (
                    <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {photos.map((p) => (
                        <div key={p.id} className="relative group rounded-lg overflow-hidden" style={{ height: 80 }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                          <button
                            onClick={() => deletePhoto(p.id)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
                          >
                            <X size={10} className="text-white" />
                          </button>
                        </div>
                      ))}
                      {photos.length < 9 && (
                        <label
                          className="flex flex-col items-center justify-center rounded-lg cursor-pointer border border-dashed transition-colors hover:border-accent"
                          style={{ height: 80, borderColor: "var(--border)" }}
                        >
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto([f]); }} />
                          {photoUploading ? <Loader2 size={16} className="animate-spin text-muted-foreground" /> : <Plus size={16} className="text-muted-foreground" />}
                        </label>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Testimonials ─────────────────────────────────────────────────── */}
          <div
            className="rounded-2xl border"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <button
              onClick={() => { setTestimsOpen((v) => !v); if (!testimsOpen) loadTestimonials(); }}
              className="w-full flex items-center justify-between p-5 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(212,168,67,0.10)" }}>
                  <Award size={16} className="text-accent" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Testimonials / Co-Signs</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Quotes from fans, artists, or press</p>
                </div>
              </div>
              {testimsOpen ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
            </button>
            {testimsOpen && (
              <div className="px-5 pb-5 space-y-3 border-t" style={{ borderColor: "var(--border)" }}>
                <div className="pt-4 space-y-2">
                  {testims.map((t) => (
                    <div key={t.id} className="flex items-start gap-2 p-3 rounded-xl border" style={{ borderColor: "var(--border)" }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs italic text-foreground/80">&ldquo;{t.quote}&rdquo;</p>
                        <p className="text-[10px] mt-1" style={{ color: "#D4A843" }}>— {t.attribution}</p>
                      </div>
                      <button onClick={() => deleteTestimonial(t.id)} className="shrink-0 p-1 text-muted-foreground hover:text-red-400"><Trash2 size={12} /></button>
                    </div>
                  ))}
                  <div className="space-y-2 pt-1">
                    <textarea value={newQuote} onChange={(e) => setNewQuote(e.target.value)} placeholder="Quote" rows={2} className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent text-foreground placeholder:text-muted-foreground outline-none resize-none" style={{ borderColor: "var(--border)" }} />
                    <div className="flex gap-2">
                      <input type="text" value={newAttrib} onChange={(e) => setNewAttrib(e.target.value)} placeholder="Attribution (e.g. 'DJ Clark Kent')" className="flex-1 rounded-xl border px-3 py-2 text-sm bg-transparent text-foreground placeholder:text-muted-foreground outline-none" style={{ borderColor: "var(--border)" }} />
                      <button onClick={addTestimonial} disabled={savingTestim || !newQuote.trim() || !newAttrib.trim()} className="shrink-0 px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-50" style={{ backgroundColor: "rgba(212,168,67,0.15)", color: "#D4A843" }}>
                        {savingTestim ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Collaborators ────────────────────────────────────────────────── */}
          <div
            className="rounded-2xl border"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <button
              onClick={() => { setCollabsOpen((v) => !v); if (!collabsOpen) loadCollaborators(); }}
              className="w-full flex items-center justify-between p-5 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(212,168,67,0.10)" }}>
                  <Heart size={16} className="text-accent" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Collaborators</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Artists and producers you&apos;ve worked with</p>
                </div>
              </div>
              {collabsOpen ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
            </button>
            {collabsOpen && (
              <div className="px-5 pb-5 space-y-3 border-t" style={{ borderColor: "var(--border)" }}>
                <div className="pt-4 space-y-2">
                  {collabs.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 p-2 rounded-xl border" style={{ borderColor: "var(--border)" }}>
                      <span className="flex-1 text-sm text-foreground">{c.name}</span>
                      {c.artistSlug && <span className="text-xs text-muted-foreground">/{c.artistSlug}</span>}
                      <button onClick={() => deleteCollaborator(c.id)} className="shrink-0 p-1 text-muted-foreground hover:text-red-400"><Trash2 size={12} /></button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input type="text" value={newCollabName} onChange={(e) => setNewCollabName(e.target.value)} placeholder="Name" className="flex-1 rounded-xl border px-3 py-2 text-sm bg-transparent text-foreground placeholder:text-muted-foreground outline-none" style={{ borderColor: "var(--border)" }} />
                    <input type="text" value={newCollabSlug} onChange={(e) => setNewCollabSlug(e.target.value)} placeholder="Artist slug (optional)" className="flex-1 rounded-xl border px-3 py-2 text-sm bg-transparent text-foreground placeholder:text-muted-foreground outline-none" style={{ borderColor: "var(--border)" }} />
                    <button onClick={addCollaborator} disabled={savingCollab || !newCollabName.trim()} className="shrink-0 px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-50" style={{ backgroundColor: "rgba(212,168,67,0.15)", color: "#D4A843" }}>
                      {savingCollab ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Press ────────────────────────────────────────────────────────── */}
          <div
            className="rounded-2xl border"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <button
              onClick={() => { setPressOpen((v) => !v); if (!pressOpen) loadPressItems(); }}
              className="w-full flex items-center justify-between p-5 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(212,168,67,0.10)" }}>
                  <ExternalLink size={16} className="text-accent" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Press / Media</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Articles and features from blogs, magazines, and outlets</p>
                </div>
              </div>
              {pressOpen ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
            </button>
            {pressOpen && (
              <div className="px-5 pb-5 space-y-3 border-t" style={{ borderColor: "var(--border)" }}>
                <div className="pt-4 space-y-2">
                  {pressItems.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 p-2 rounded-xl border" style={{ borderColor: "var(--border)" }}>
                      <span className="text-xs font-semibold w-16 shrink-0" style={{ color: "#D4A843" }}>{p.source}</span>
                      <span className="flex-1 text-sm text-foreground truncate">{p.title}</span>
                      <button onClick={() => deletePressItem(p.id)} className="shrink-0 p-1 text-muted-foreground hover:text-red-400"><Trash2 size={12} /></button>
                    </div>
                  ))}
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input type="text" value={newPressSource} onChange={(e) => setNewPressSource(e.target.value)} placeholder="Source (e.g. 'XXL')" className="w-28 rounded-xl border px-3 py-2 text-sm bg-transparent text-foreground placeholder:text-muted-foreground outline-none" style={{ borderColor: "var(--border)" }} />
                      <input type="text" value={newPressTitle} onChange={(e) => setNewPressTitle(e.target.value)} placeholder="Article title" className="flex-1 rounded-xl border px-3 py-2 text-sm bg-transparent text-foreground placeholder:text-muted-foreground outline-none" style={{ borderColor: "var(--border)" }} />
                    </div>
                    <div className="flex gap-2">
                      <input type="url" value={newPressUrl} onChange={(e) => setNewPressUrl(e.target.value)} placeholder="Article URL" className="flex-1 rounded-xl border px-3 py-2 text-sm bg-transparent text-foreground placeholder:text-muted-foreground outline-none" style={{ borderColor: "var(--border)" }} />
                      <button onClick={addPressItem} disabled={savingPress || !newPressSource.trim() || !newPressTitle.trim() || !newPressUrl.trim()} className="shrink-0 px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-50" style={{ backgroundColor: "rgba(212,168,67,0.15)", color: "#D4A843" }}>
                        {savingPress ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
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
