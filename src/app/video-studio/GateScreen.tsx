"use client";

/**
 * GateScreen — shown to non-subscribers before the creation wizard.
 *
 * Collects email (+ optional name) via form or Google OAuth.
 * On submit: sets `indiethis_guest_email` cookie (7-day) then redirects to ?start=1.
 * If the user is already authenticated via Google the cookie is set with their profile data.
 */

import { useState }      from "react";
import { useRouter }     from "next/navigation";
import { signIn }        from "next-auth/react";
import { Film, Mail, User, ArrowRight, Music2 } from "lucide-react";

interface Props {
  initialMode?: "QUICK" | "DIRECTOR";
}

export default function GateScreen({ initialMode }: Props) {
  const router = useRouter();
  const mode   = initialMode ?? "QUICK";

  const [email,      setEmail]      = useState("");
  const [name,       setName]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // ── Email + name submit ───────────────────────────────────────────────────────

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    const trimEmail = email.trim();
    if (!trimEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      // Store in cookie — server reads this to skip gate on next visit
      const payload = JSON.stringify({ email: trimEmail, name: name.trim() || null });
      document.cookie = `indiethis_guest_email=${encodeURIComponent(payload)}; max-age=604800; path=/; SameSite=Lax`;
      router.push(`/video-studio?start=1&mode=${mode}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  // ── Google OAuth ──────────────────────────────────────────────────────────────

  function handleGoogle() {
    signIn("google", { callbackUrl: `/video-studio?start=1&mode=${mode}` });
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#0A0A0A", color: "#F0F0F0" }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b px-6 h-16 flex items-center"
        style={{ backgroundColor: "rgba(10,10,10,0.95)", borderColor: "#1A1A1A", backdropFilter: "blur(12px)" }}
      >
        <a href="/video-studio" className="flex items-center gap-2 no-underline">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "rgba(212,168,67,0.15)" }}
          >
            <Film size={14} style={{ color: "#D4A843" }} />
          </div>
          <span className="text-sm font-bold text-white">Music Video Studio</span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-semibold hidden sm:block"
            style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}
          >
            by IndieThis
          </span>
        </a>
      </header>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm space-y-6">

          {/* Icon + headline */}
          <div className="text-center space-y-2">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
              style={{ backgroundColor: "rgba(212,168,67,0.12)", border: "1px solid rgba(212,168,67,0.2)" }}
            >
              <Film size={22} style={{ color: "#D4A843" }} />
            </div>
            <h1 className="text-2xl font-black text-white">Get Started</h1>
            <p className="text-sm" style={{ color: "#888" }}>
              Enter your email so we can send your finished video.
            </p>
          </div>

          {/* Google button */}
          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border text-sm font-semibold transition-all hover:border-white/30"
            style={{ borderColor: "#2A2A2A", backgroundColor: "#111", color: "#eee" }}
          >
            {/* Google G icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* OR divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ backgroundColor: "#222" }} />
            <span className="text-xs font-medium" style={{ color: "#555" }}>OR</span>
            <div className="flex-1 h-px" style={{ backgroundColor: "#222" }} />
          </div>

          {/* Email + name form */}
          <form onSubmit={handleContinue} className="space-y-3">
            {/* Email */}
            <div className="relative">
              <Mail
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2"
                style={{ color: "#555" }}
              />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(null); }}
                required
                className="w-full rounded-xl border pl-10 pr-4 py-3 text-sm bg-transparent text-white outline-none transition-all"
                style={{ borderColor: "#2A2A2A" }}
                onFocus={e => (e.target.style.borderColor = "#D4A843")}
                onBlur={e => (e.target.style.borderColor = "#2A2A2A")}
              />
            </div>

            {/* Name (optional) */}
            <div className="relative">
              <User
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2"
                style={{ color: "#555" }}
              />
              <input
                type="text"
                placeholder="Your name (optional)"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full rounded-xl border pl-10 pr-4 py-3 text-sm bg-transparent text-white outline-none transition-all"
                style={{ borderColor: "#2A2A2A" }}
                onFocus={e => (e.target.style.borderColor = "#D4A843")}
                onBlur={e => (e.target.style.borderColor = "#2A2A2A")}
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-xs" style={{ color: "#E85D4A" }}>{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              {submitting ? "Starting…" : (
                <>Continue <ArrowRight size={15} /></>
              )}
            </button>
          </form>

          {/* Privacy note */}
          <p className="text-center text-xs" style={{ color: "#555" }}>
            No account required. We&apos;ll only use your email to send your video.
          </p>

          {/* Explore link */}
          <div className="text-center">
            <a
              href="/explore"
              className="inline-flex items-center gap-1.5 text-xs transition-colors hover:opacity-80"
              style={{ color: "#888" }}
            >
              <Music2 size={12} />
              Just want to listen? Explore music &rarr;
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
