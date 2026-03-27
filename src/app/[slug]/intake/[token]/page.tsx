"use client";

import { useEffect, useLayoutEffect, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  Music2, AlertTriangle, CheckCircle2, X, Loader2, Youtube, Plus,
  Upload, Camera, DollarSign, ExternalLink, Phone, Mail,
} from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-client";
import { formatPhoneInput } from "@/lib/formatPhone";
import { analyzeAudioFile } from "@/lib/audio-analysis-client";

type StudioData = {
  name: string;
  instagram: string | null;
  tiktok: string | null;
  youtube: string | null;
  cashAppHandle: string | null;
  zelleHandle: string | null;
  paypalHandle: string | null;
  venmoHandle: string | null;
  stripePaymentsEnabled: boolean;
};

type IntakeLinkData = {
  name: string | null;
  email: string | null;
  phone: string | null;
  sessionDate: string | null;
  sessionTime: string | null;
  endTime: string | null;
  hourlyRate: number | null;
  sessionHours: number | null;
  studio: StudioData;
  expiresAt: string;
  usedAt: string | null;
};

type RefPreview = {
  url: string;
  videoId: string;
  title: string;
  thumbnailUrl: string;
  authorName: string;
};

type UploadedFile = { name: string; url: string };

function extractVideoId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

async function fetchOEmbed(url: string): Promise<RefPreview | null> {
  const videoId = extractVideoId(url.trim());
  if (!videoId) return null;
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (!res.ok) return null;
    const data = await res.json();
    return { url: `https://www.youtube.com/watch?v=${videoId}`, videoId, title: data.title, thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`, authorName: data.author_name };
  } catch { return null; }
}

function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }); }
  catch { return d; }
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{children}</label>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

const INPUT = "w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50";

export default function IntakeFormPage() {
  const { token } = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const stripeDepositPaid = searchParams.get("depositPaid") === "stripe";
  const [link, setLink] = useState<IntakeLinkData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Form fields ──────────────────────────────────────────────────────────────
  const [firstName, setFirstName]       = useState("");
  const [lastName, setLastName]         = useState("");
  const [artistName, setArtistName]     = useState("");
  const [email, setEmail]               = useState("");
  const [phone, setPhone]               = useState("");
  const [instagram, setInstagram]       = useState("");
  const [tiktok, setTiktok]             = useState("");
  const [youtubeHandle, setYoutubeHandle] = useState("");
  const [genre, setGenre]               = useState("");
  const [projectDesc, setProjectDesc]   = useState("");
  const [notes, setNotes]               = useState("");

  // ── YouTube references ───────────────────────────────────────────────────────
  const [refInput, setRefInput]         = useState("");
  const [refFetching, setRefFetching]   = useState(false);
  const [refError, setRefError]         = useState<string | null>(null);
  const [refPreviews, setRefPreviews]   = useState<RefPreview[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── File uploads ─────────────────────────────────────────────────────────────
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [dragging, setDragging]           = useState(false);
  const [filesError, setFilesError]       = useState<string | null>(null);
  const [detectedBpm, setDetectedBpm]     = useState<number | null>(null);
  const [detectedKey, setDetectedKey]     = useState<string | null>(null);
  const [analyzing, setAnalyzing]         = useState(false);
  const { startUpload: uploadFiles, isUploading: filesUploading } = useUploadThing("intakeFiles", {
    onClientUploadComplete: (res) => {
      if (res?.length) {
        setUploadedFiles((p) => [...p, ...res.map((f) => ({
          name: f.name,
          url: (f as any).serverData?.url ?? f.ufsUrl ?? (f as any).url ?? "",
        }))]);
      }
    },
    onUploadError: (err) => {
      setFilesError(err.message ?? "Upload failed. Try again.");
    },
  });

  async function runClientAnalysis(files: File[]) {
    const audioTypes = /^audio\//;
    const audioFile  = files.find((f) => audioTypes.test(f.type) || /\.(mp3|wav|flac|aac|ogg|m4a)$/i.test(f.name));
    if (!audioFile) return;
    setAnalyzing(true);
    const { bpm, key } = await analyzeAudioFile(audioFile);
    if (bpm  !== null) setDetectedBpm(bpm);
    if (key  !== null) setDetectedKey(key);
    setAnalyzing(false);
  }

  // ── Photo upload ─────────────────────────────────────────────────────────────
  const [photoUrl, setPhotoUrl]       = useState<string | null>(null);
  const [photoName, setPhotoName]     = useState<string | null>(null);
  const [photoError, setPhotoError]   = useState<string | null>(null);
  const { startUpload: uploadPhoto, isUploading: photoUploading } = useUploadThing("intakeFiles", {
    onClientUploadComplete: (res) => {
      if (res?.[0]) {
        const url = (res[0] as any).serverData?.url ?? res[0].ufsUrl ?? (res[0] as any).url ?? "";
        if (url) { setPhotoUrl(url); setPhotoName(res[0].name); }
        else setPhotoError("Upload succeeded but no URL returned. Try again.");
      }
    },
    onUploadError: (err) => {
      setPhotoError(err.message ?? "Photo upload failed. Try again.");
    },
  });

  // ── AI video upsell ──────────────────────────────────────────────────────────
  const [aiVideoRequested, setAiVideoRequested] = useState(false);

  // ── Payment / deposit ────────────────────────────────────────────────────────
  const [depositPaid, setDepositPaid]       = useState(false);
  const [paymentMethod, setPaymentMethod]   = useState<string | null>(null);
  const [depositAmount, setDepositAmount]   = useState("");
  const savedScrollY = useRef<number | null>(null);

  // Restore scroll position after payment method state update causes layout shift
  useLayoutEffect(() => {
    if (savedScrollY.current !== null) {
      window.scrollTo(0, savedScrollY.current);
      savedScrollY.current = null;
    }
  }, [paymentMethod, depositPaid]);

  // ── Load link data ───────────────────────────────────────────────────────────
  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    fetch(`/api/intake/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setLoadError(d.error);
        else setLink(d);
      })
      .catch(() => setLoadError("Failed to load form."));
  }, [token]);

  // ── YouTube ref handler ──────────────────────────────────────────────────────
  function handleRefInput(val: string) {
    setRefInput(val);
    setRefError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!extractVideoId(val.trim())) return;
    debounceRef.current = setTimeout(async () => {
      setRefFetching(true);
      const result = await fetchOEmbed(val.trim());
      setRefFetching(false);
      if (result) {
        if (!refPreviews.find((r) => r.videoId === result.videoId))
          setRefPreviews((p) => [...p, result]);
        setRefInput("");
      } else {
        setRefError("Couldn't load that video. Check the URL.");
      }
    }, 500);
  }

  // ── File drop handler ────────────────────────────────────────────────────────
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    setFilesError(null);
    uploadFiles(files);
    runClientAnalysis(files);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadFiles]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setFilesError(null);
    uploadFiles(files);
    runClientAnalysis(files);
    e.target.value = "";
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    uploadPhoto([file]);
    e.target.value = "";
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!firstName.trim() || !artistName.trim()) return;
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/intake/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          fullName,
          artistName: artistName.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          instagram: instagram.trim() || undefined,
          tiktok: tiktok.trim() || undefined,
          youtubeHandle: youtubeHandle.trim() || undefined,
          genre: genre.trim() || undefined,
          projectDesc: projectDesc.trim() || undefined,
          notes: notes.trim() || undefined,
          youtubeLinks: refPreviews.map((r) => r.url),
          youtubeMeta: refPreviews,
          fileUrls: uploadedFiles.map((f) => f.url),
          photoUrl: photoUrl || undefined,
          paymentMethod: paymentMethod || undefined,
          depositPaid,
          depositAmount: depositAmount ? parseFloat(depositAmount) : undefined,
          aiVideoRequested,
          bpmDetected:  detectedBpm  ?? undefined,
          keyDetected:  detectedKey  ?? undefined,
        }),
      });
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        if (d.checkoutUrl) {
          window.location.href = d.checkoutUrl;
        } else {
          setSubmitted(true);
        }
      } else { const d = await res.json(); setSubmitError(d.error ?? "Failed to submit."); }
    } finally { setSubmitting(false); }
  }

  // ── States ───────────────────────────────────────────────────────────────────
  if (loadError) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
      <div className="text-center space-y-3 px-6">
        <AlertTriangle size={40} className="mx-auto text-red-400" />
        <p className="text-foreground font-semibold">{loadError}</p>
      </div>
    </div>
  );

  if (!link) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
      <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
    </div>
  );

  if (submitted || link.usedAt) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
      <div className="text-center space-y-4 max-w-sm px-6">
        <CheckCircle2 size={48} className="mx-auto text-emerald-400" />
        <h1 className="text-xl font-bold text-foreground">All done!</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your info has been sent to <span className="text-foreground font-semibold">{link.studio.name}</span>. They&apos;ll be in touch soon.
        </p>
        {stripeDepositPaid && (
          <p className="text-sm text-emerald-400 font-medium">
            ✓ Deposit payment confirmed
          </p>
        )}
      </div>
    </div>
  );

  const { studio } = link;

  const paymentHandles = [
    studio.stripePaymentsEnabled && { label: "Card", handle: "Secure card payment", method: "stripe", color: "#D4A843", logo: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect width="22" height="22" rx="6" fill="#D4A843"/><text x="11" y="16" textAnchor="middle" fill="#0A0A0A" fontSize="12" fontWeight="bold" fontFamily="Arial">$</text></svg>
    )},
    studio.cashAppHandle && { label: "Cash App", handle: studio.cashAppHandle, method: "cashapp", color: "#00D54B", logo: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect width="22" height="22" rx="6" fill="#00D54B"/><text x="11" y="16" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="Arial">$</text></svg>
    )},
    studio.zelleHandle   && { label: "Zelle",    handle: studio.zelleHandle,   method: "zelle",   color: "#6D1ED4", logo: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect width="22" height="22" rx="6" fill="#6D1ED4"/><text x="11" y="16" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold" fontFamily="Arial">Z</text></svg>
    )},
    studio.paypalHandle  && { label: "PayPal",   handle: studio.paypalHandle,  method: "paypal",  color: "#003087", logo: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect width="22" height="22" rx="6" fill="#003087"/><text x="11" y="16" textAnchor="middle" fill="#009CDE" fontSize="12" fontWeight="bold" fontFamily="Arial">PP</text></svg>
    )},
    studio.venmoHandle   && { label: "Venmo",    handle: studio.venmoHandle,   method: "venmo",   color: "#3D95CE", logo: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect width="22" height="22" rx="6" fill="#3D95CE"/><text x="11" y="16" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold" fontFamily="Arial">V</text></svg>
    )},
  ].filter(Boolean) as { label: string; handle: string; method: string; color: string; logo: React.ReactNode }[];

  const clean = (h: string) => h.replace(/^@+/, "");
  const studioSocials = [
    studio.instagram && { label: "Instagram", url: `https://instagram.com/${clean(studio.instagram)}`,   handle: `@${clean(studio.instagram)}` },
    studio.tiktok    && { label: "TikTok",    url: `https://tiktok.com/@${clean(studio.tiktok)}`,         handle: `@${clean(studio.tiktok)}` },
    studio.youtube   && { label: "YouTube",   url: `https://youtube.com/@${clean(studio.youtube)}`,       handle: `@${clean(studio.youtube)}` },
  ].filter(Boolean) as { label: string; url: string; handle: string }[];

  const needsEmail = !link.email;
  const needsPhone = !link.phone;

  return (
    <div className="min-h-screen py-10 px-4" style={{ backgroundColor: "var(--background)" }}>
      <div className="max-w-lg mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <Music2 size={24} className="text-accent" />
          </div>
          <h1 className="text-xl font-bold text-foreground">{studio.name}</h1>
          <p className="text-sm text-muted-foreground">Fill out this form so we can prepare for your session.</p>
        </div>

        {/* Session banner */}
        {link.sessionDate && (
          <div className="rounded-2xl p-4 flex items-center gap-3" style={{ backgroundColor: "#D4A84318", border: "1px solid #D4A84366" }}>
            <span className="text-xl shrink-0">📅</span>
            <div>
              <p className="text-xs font-semibold" style={{ color: "#D4A843" }}>Your Session</p>
              <p className="text-sm font-medium text-foreground">
                {formatDate(link.sessionDate)}
                {link.sessionTime ? ` — ${link.sessionTime}${link.endTime ? ` to ${link.endTime}` : ""}` : ""}
              </p>
            </div>
          </div>
        )}

        {/* Pricing banner — only shown if studio set a rate */}
        {link.hourlyRate && link.sessionHours && (() => {
          const sessionTotal = link.hourlyRate * link.sessionHours;
          const dep = depositPaid ? (parseFloat(depositAmount) || 0) : 0;
          const balance = sessionTotal - dep;
          return (
            <div className="rounded-2xl border p-4 space-y-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Session Cost</p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {link.sessionHours} hr{link.sessionHours !== 1 ? "s" : ""} × ${link.hourlyRate}/hr
                  </span>
                  <span className="text-sm font-bold text-foreground">${sessionTotal.toFixed(2)}</span>
                </div>
                {dep > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Deposit paid</span>
                    <span className="text-sm font-semibold text-emerald-400">−${dep.toFixed(2)}</span>
                  </div>
                )}
                {dep > 0 && (
                  <>
                    <div className="border-t" style={{ borderColor: "var(--border)" }} />
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">Balance Due</span>
                      <span className="text-base font-bold" style={{ color: "#D4A843" }}>${balance.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })()}

        <div className="space-y-4">

          {/* ── Your Info ── */}
          <section className="rounded-2xl border p-6 space-y-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <h2 className="text-sm font-bold text-foreground">Your Info</h2>

            <div className="grid grid-cols-2 gap-3">
              <Field label="First Name *">
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required
                  placeholder="First Name"
                  className={INPUT} style={{ borderColor: "var(--border)" }} />
              </Field>
              <Field label="Last Name">
                <input value={lastName} onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last Name"
                  className={INPUT} style={{ borderColor: "var(--border)" }} />
              </Field>
            </div>

            <Field label="Artist / Stage Name *">
              <input value={artistName} onChange={(e) => setArtistName(e.target.value)} required
                placeholder="Your artist name"
                className={INPUT} style={{ borderColor: "var(--border)" }} />
            </Field>

            {needsEmail && (
              <Field label="Email *">
                <div className="relative">
                  <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                    placeholder="you@example.com"
                    className={INPUT + " pl-8"} style={{ borderColor: "var(--border)" }} />
                </div>
              </Field>
            )}

            {needsPhone && (
              <Field label="Phone">
                <div className="relative">
                  <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="tel" value={phone} onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                    placeholder="(555) 123-4567" inputMode="tel"
                    className={INPUT + " pl-8"} style={{ borderColor: "var(--border)" }} />
                </div>
              </Field>
            )}
          </section>

          {/* ── Social Handles ── */}
          <section className="rounded-2xl border p-6 space-y-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <h2 className="text-sm font-bold text-foreground">Social Handles <span className="text-muted-foreground font-normal">(optional)</span></h2>

            {[
              { label: "Instagram", value: instagram, set: setInstagram, placeholder: "@yourhandle", icon: (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <defs><linearGradient id="ig-g" x1="0" y1="20" x2="20" y2="0"><stop offset="0%" stopColor="#f09433"/><stop offset="40%" stopColor="#dc2743"/><stop offset="100%" stopColor="#bc1888"/></linearGradient></defs>
                  <rect width="20" height="20" rx="5" fill="url(#ig-g)"/>
                  <rect x="5.5" y="5.5" width="9" height="9" rx="2" stroke="white" strokeWidth="1.4" fill="none"/>
                  <circle cx="10" cy="10" r="2.3" stroke="white" strokeWidth="1.4" fill="none"/>
                  <circle cx="14" cy="6" r="1" fill="white"/>
                </svg>
              )},
              { label: "TikTok", value: tiktok, set: setTiktok, placeholder: "@yourhandle", icon: (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect width="20" height="20" rx="5" fill="#010101"/>
                  <path d="M13 4h-1.6v8a1.6 1.6 0 1 1-1.6-1.6V8.8A3.2 3.2 0 1 0 13 12V7.5a4 4 0 0 0 2.2.7V6.6A2.2 2.2 0 0 1 13 4z" fill="white"/>
                </svg>
              )},
              { label: "YouTube", value: youtubeHandle, set: setYoutubeHandle, placeholder: "@channel", icon: (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect width="20" height="20" rx="5" fill="#FF0000"/>
                  <path d="M8 7l5 3-5 3V7z" fill="white"/>
                </svg>
              )},
            ].map(({ label, value, set, placeholder, icon }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="shrink-0">{icon}</span>
                <input value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder}
                  className={INPUT + " flex-1"} style={{ borderColor: "var(--border)" }} />
              </div>
            ))}
          </section>

          {/* ── Your Sound ── */}
          <section className="rounded-2xl border p-6 space-y-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <h2 className="text-sm font-bold text-foreground">Your Sound</h2>

            <Field label="Genre">
              <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Hip-Hop, R&B, Pop, Afrobeats…"
                className={INPUT} style={{ borderColor: "var(--border)" }} />
            </Field>

            <Field label="Project Description">
              <textarea value={projectDesc} onChange={(e) => setProjectDesc(e.target.value)} rows={3}
                placeholder="What are you working on? What vibe are you going for?"
                className={INPUT + " resize-none"} style={{ borderColor: "var(--border)" }} />
            </Field>
          </section>

          {/* ── Reference Tracks ── */}
          <section className="rounded-2xl border p-6 space-y-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Youtube size={14} className="text-red-400" /> Reference Tracks
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Paste YouTube links one at a time — add as many as you want</p>
            </div>

            {refPreviews.length > 0 && (
              <div className="space-y-2">
                {refPreviews.map((ref) => (
                  <div key={ref.videoId} className="flex items-center gap-3 rounded-xl border p-2" style={{ borderColor: "var(--border)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ref.thumbnailUrl} alt={ref.title} className="w-16 h-10 rounded-lg object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{ref.title}</p>
                      <p className="text-[10px] text-muted-foreground">{ref.authorName}</p>
                    </div>
                    <button type="button" onClick={() => setRefPreviews((p) => p.filter((r) => r.videoId !== ref.videoId))}
                      className="p-1.5 text-muted-foreground hover:text-red-400 shrink-0"><X size={13} /></button>
                  </div>
                ))}
              </div>
            )}

            <div className="relative">
              <input value={refInput} onChange={(e) => handleRefInput(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
                className={INPUT + " pr-10"} style={{ borderColor: "var(--border)" }} />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {refFetching
                  ? <Loader2 size={14} className="text-muted-foreground animate-spin" />
                  : refInput
                    ? <button type="button" onClick={() => { setRefInput(""); setRefError(null); }} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
                    : <Plus size={14} className="text-muted-foreground" />
                }
              </div>
            </div>
            {refError && <p className="text-xs text-red-400">{refError}</p>}
            <p className="text-[10px] text-muted-foreground">Each link auto-adds when recognized — search on YouTube, copy the URL, paste here</p>
          </section>

          {/* ── File Uploads ── */}
          <section className="rounded-2xl border p-6 space-y-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div>
              <h2 className="text-sm font-bold text-foreground">Files <span className="text-muted-foreground font-normal">(optional)</span></h2>
              <p className="text-xs text-muted-foreground mt-0.5">Stems, demos, beat files, lyrics — drag & drop or click to upload</p>
            </div>

            {uploadedFiles.length > 0 && (
              <div className="space-y-1.5">
                {uploadedFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)" }}>
                    <span className="text-xs">🎵</span>
                    <p className="flex-1 text-xs text-foreground truncate">{f.name}</p>
                    <button type="button" onClick={() => setUploadedFiles((p) => p.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-red-400 shrink-0"><X size={13} /></button>
                  </div>
                ))}
              </div>
            )}

            <label
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className="rounded-xl border border-dashed p-6 flex flex-col items-center gap-2 cursor-pointer transition-colors"
              style={{ borderColor: dragging ? "#D4A843" : "var(--border)", backgroundColor: dragging ? "#D4A84310" : "transparent", display: "flex" }}
            >
              {filesUploading ? <Loader2 size={22} className="text-accent animate-spin" /> : uploadedFiles.length > 0 ? <CheckCircle2 size={22} className="text-emerald-400" /> : <Upload size={22} className="text-muted-foreground" />}
              <p className="text-sm font-medium" style={{ color: uploadedFiles.length > 0 && !filesUploading ? "var(--color-emerald-400, #34d399)" : "var(--muted-foreground)" }}>
                {filesUploading ? "Uploading…" : uploadedFiles.length > 0 ? `${uploadedFiles.length} file${uploadedFiles.length > 1 ? "s" : ""} added — tap to add more` : "Tap to browse files"}
              </p>
              <p className="text-[10px] text-muted-foreground">MP3 · WAV · FLAC · PDF · up to 128 MB each</p>
              <input type="file" multiple accept="audio/*,.pdf,.mp3,.wav,.flac,.aac,.m4a" onChange={handleFileSelect} disabled={filesUploading} style={{ position: "absolute", width: "1px", height: "1px", opacity: 0, overflow: "hidden" }} />
            </label>
            {filesError && <p className="text-xs text-red-400">{filesError}</p>}

            {/* BPM / Key detected client-side */}
            {(analyzing || detectedBpm || detectedKey) && (
              <div className="flex items-center gap-3 rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--border)", backgroundColor: "rgba(212,168,67,0.07)" }}>
                <Music2 size={14} style={{ color: "#D4A843" }} className="shrink-0" />
                {analyzing ? (
                  <div className="flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin" style={{ color: "#D4A843" }} />
                    <span className="text-xs" style={{ color: "#D4A843" }}>Detecting BPM &amp; Key…</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    {detectedBpm && <span className="text-xs font-semibold" style={{ color: "#D4A843" }}>{detectedBpm} BPM</span>}
                    {detectedKey && <span className="text-xs font-semibold text-blue-400">{detectedKey}</span>}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── Photo Upload ── */}
          <section className="rounded-2xl border p-6 space-y-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div>
              <h2 className="text-sm font-bold text-foreground">Artist Photo <span className="text-muted-foreground font-normal">(optional)</span></h2>
            </div>

            {photoUrl ? (
              <div className="flex items-center gap-3 rounded-xl border p-2" style={{ borderColor: "var(--border)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="Artist photo" className="w-16 h-16 rounded-xl object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{photoName}</p>
                  <p className="text-[10px] text-emerald-400">Uploaded ✓</p>
                </div>
                <button type="button" onClick={() => { setPhotoUrl(null); setPhotoName(null); }}
                  className="p-1.5 text-muted-foreground hover:text-red-400 shrink-0"><X size={13} /></button>
              </div>
            ) : (
              <label
                className="w-full rounded-xl border border-dashed p-5 flex flex-col items-center gap-2 cursor-pointer"
                style={{ borderColor: "var(--border)", opacity: photoUploading ? 0.5 : 1, pointerEvents: photoUploading ? "none" : "auto" }}
              >
                {photoUploading ? <Loader2 size={22} className="text-accent animate-spin" /> : <Camera size={22} className="text-muted-foreground" />}
                <span className="text-sm text-muted-foreground">{photoUploading ? "Uploading…" : "Tap to upload a photo"}</span>
                <input type="file" accept="image/*" onChange={handlePhotoSelect} disabled={photoUploading} style={{ position: "absolute", width: "1px", height: "1px", opacity: 0, overflow: "hidden" }} />
              </label>
            )}
            {photoError && <p className="text-xs text-red-400">{photoError}</p>}

            {photoUrl ? (
              <button
                type="button"
                onClick={() => setAiVideoRequested((v) => !v)}
                className="w-full rounded-xl border-2 px-4 py-3.5 text-left transition-all"
                style={{
                  borderColor: aiVideoRequested ? "#D4A843" : "var(--border)",
                  backgroundColor: aiVideoRequested ? "#D4A84318" : "var(--background)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-foreground">🎬 Add an AI Music Video to your session</p>
                    <p className="text-xs text-muted-foreground mt-0.5">We&apos;ll turn your photo + session audio into a cinematic visual — delivered to your dashboard</p>
                    <p className="text-sm font-bold mt-1.5" style={{ color: "#D4A843" }}>$49</p>
                  </div>
                  <div className={`shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${aiVideoRequested ? "border-accent" : "border-border"}`}>
                    {aiVideoRequested && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#D4A843" }} />}
                  </div>
                </div>
                {aiVideoRequested && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    <p className="text-xs text-emerald-400 font-medium">Added to your session — $49 will be noted for your studio</p>
                  </div>
                )}
              </button>
            ) : (
              <div className="rounded-xl px-4 py-3 space-y-0.5" style={{ backgroundColor: "var(--background)" }}>
                <p className="text-xs font-semibold text-foreground">🎬 Generate an AI music video from your session</p>
                <p className="text-xs text-muted-foreground">Upload a photo above to unlock AI visuals — starting at $49</p>
              </div>
            )}
          </section>

          {/* ── Session Deposit ── */}
          {paymentHandles.length > 0 && (
            <section className="rounded-2xl border p-6 space-y-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <div>
                <h2 className="text-sm font-bold text-foreground">Session Deposit</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {paymentMethod === "stripe"
                    ? "Pay your deposit securely by card after submitting."
                    : "Send your deposit to " + studio.name + ", then confirm below."}
                </p>
              </div>

              <div className="space-y-2">
                {paymentHandles.map(({ label, handle, method, logo }) => (
                  <button key={method} type="button"
                    onTouchStart={() => { savedScrollY.current = window.scrollY; }}
                    onClick={() => {
                      if (savedScrollY.current === null) savedScrollY.current = window.scrollY;
                      const selecting = method !== paymentMethod;
                      setPaymentMethod(selecting ? method : null);
                      setDepositPaid(selecting && method !== "stripe");
                    }}
                    className="w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition-all"
                    style={{
                      borderColor: paymentMethod === method ? "#D4A843" : "var(--border)",
                      backgroundColor: paymentMethod === method ? "#D4A84318" : "transparent",
                    }}>
                    <div className="flex items-center gap-3">
                      <span className="shrink-0">{logo}</span>
                      <div className="text-left">
                        <p className="font-semibold text-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground">{handle}</p>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${paymentMethod === method ? "border-accent" : "border-border"}`}>
                      {paymentMethod === method && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#D4A843" }} />}
                    </div>
                  </button>
                ))}
              </div>

              {/* Manual methods — self-report amount */}
              {depositPaid && paymentMethod !== "stripe" && (
                <>
                  <Field label="How much did you send?">
                    <div className="relative">
                      <DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input type="number" min="0" step="0.01" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="0.00" inputMode="decimal"
                        className={INPUT + " pl-8"} style={{ borderColor: "var(--border)" }} />
                    </div>
                  </Field>
                  <div className="rounded-xl px-3 py-3 space-y-0.5" style={{ backgroundColor: "#10b98118", border: "1px solid rgba(16,185,129,0.2)" }}>
                    <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="shrink-0" />
                      {depositAmount && parseFloat(depositAmount) > 0
                        ? `$${parseFloat(depositAmount).toFixed(2)} sent via ${paymentHandles.find(p => p.method === paymentMethod)?.label}`
                        : `Payment sent via ${paymentHandles.find(p => p.method === paymentMethod)?.label}`}
                    </p>
                    <p className="text-[11px] text-muted-foreground pl-5">
                      {studio.name} will be notified when you submit and will verify receipt.
                    </p>
                  </div>
                </>
              )}

              {/* Stripe — enter amount, paid on checkout */}
              {paymentMethod === "stripe" && (
                <Field label="Deposit amount">
                  <div className="relative">
                    <DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="number" min="0" step="0.01" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="0.00" inputMode="decimal"
                      className={INPUT + " pl-8"} style={{ borderColor: "var(--border)" }} />
                  </div>
                </Field>
              )}
            </section>
          )}

          {/* ── Session Cost summary (repeated below payment so balance is visible) ── */}
          {link.hourlyRate && link.sessionHours && (() => {
            const sessionTotal = link.hourlyRate! * link.sessionHours!;
            const dep = depositPaid ? (parseFloat(depositAmount) || 0) : 0;
            const balance = sessionTotal - dep;
            return (
              <div className="rounded-2xl border p-4 space-y-3" style={{ backgroundColor: "var(--card)", borderColor: "rgba(212,168,67,0.4)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#D4A843" }}>Session Cost Summary</p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {link.sessionHours} hr{link.sessionHours !== 1 ? "s" : ""} × ${link.hourlyRate}/hr
                    </span>
                    <span className="text-sm font-bold text-foreground">${sessionTotal.toFixed(2)}</span>
                  </div>
                  {dep > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Deposit paid</span>
                      <span className="text-sm font-semibold text-emerald-400">−${dep.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t" style={{ borderColor: "rgba(212,168,67,0.2)" }} />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">Balance Due</span>
                    <span className="text-base font-bold" style={{ color: dep > 0 && balance <= 0 ? "#34C759" : "#D4A843" }}>
                      ${balance.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Additional Notes ── */}
          <section className="rounded-2xl border p-6" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <Field label="Additional Notes">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                placeholder="Anything else we should know?"
                className={INPUT + " resize-none"} style={{ borderColor: "var(--border)" }} />
            </Field>
          </section>

          {submitError && <p className="text-sm text-red-400 text-center">{submitError}</p>}

          <button type="button" disabled={submitting || !firstName.trim() || !artistName.trim() || filesUploading || photoUploading}
            onClick={handleSubmit}
            className="w-full py-4 rounded-2xl text-sm font-bold transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
            {submitting ? "Submitting…" : "Submit Intake Form"}
          </button>
        </div>

        {/* ── Studio Follow Section ── */}
        <section className="rounded-2xl border p-5 space-y-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {studioSocials.length > 0 ? `Follow ${studio.name}` : "Follow Us"}
          </p>
          <div className="flex flex-wrap gap-2">
            {studioSocials.map(({ label, url, handle }) => (
              <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs text-foreground hover:border-accent transition-colors"
                style={{ borderColor: "var(--border)" }}>
                <span className="text-muted-foreground">{label}</span>
                {handle} <ExternalLink size={10} className="text-muted-foreground" />
              </a>
            ))}
            <a href="https://instagram.com/indiethisofficial" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs text-foreground hover:border-accent transition-colors"
              style={{ borderColor: "var(--border)" }}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                <defs><linearGradient id="ig-ft" x1="0" y1="20" x2="20" y2="0"><stop offset="0%" stopColor="#f09433"/><stop offset="40%" stopColor="#dc2743"/><stop offset="100%" stopColor="#bc1888"/></linearGradient></defs>
                <rect width="20" height="20" rx="5" fill="url(#ig-ft)"/>
                <rect x="5.5" y="5.5" width="9" height="9" rx="2" stroke="white" strokeWidth="1.4" fill="none"/>
                <circle cx="10" cy="10" r="2.3" stroke="white" strokeWidth="1.4" fill="none"/>
                <circle cx="14" cy="6" r="1" fill="white"/>
              </svg>
              @indiethisofficial <ExternalLink size={10} className="text-muted-foreground" />
            </a>
          </div>
        </section>

        <p className="text-center text-xs text-muted-foreground pb-6">
          Powered by <span className="font-semibold" style={{ color: "#D4A843" }}>IndieThis</span>
        </p>
      </div>
    </div>
  );
}
