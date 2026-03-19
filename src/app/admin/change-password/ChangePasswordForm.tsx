"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

// ─── Strength indicator ────────────────────────────────────────────────────

function getStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (pw.length === 0)  return { level: 0, label: "",        color: "transparent" };
  const hasLen    = pw.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(pw);
  const hasDigit  = /[0-9]/.test(pw);
  const hasSymbol = /[^a-zA-Z0-9]/.test(pw);
  const score     = [hasLen, hasLetter, hasDigit, hasSymbol].filter(Boolean).length;
  if (score <= 2) return { level: 1, label: "Weak",   color: "#E85D4A" };
  if (score === 3) return { level: 2, label: "Good",   color: "#D4A843" };
  return             { level: 3, label: "Strong", color: "#34C759" };
}

// ─── Rules checklist ──────────────────────────────────────────────────────

function Rule({ met, label }: { met: boolean; label: string }) {
  return (
    <li className="flex items-center gap-1.5 text-xs" style={{ color: met ? "#34C759" : "var(--muted-foreground)" }}>
      <CheckCircle2 size={11} style={{ opacity: met ? 1 : 0.3 }} />
      {label}
    </li>
  );
}

// ─── Component ────────────────────────────────────────────────────────────

export default function ChangePasswordForm({ name }: { name: string }) {
  const router = useRouter();

  const [password, setPassword]     = useState("");
  const [confirm,  setConfirm]      = useState("");
  const [showPw,   setShowPw]       = useState(false);
  const [showCf,   setShowCf]       = useState(false);
  const [saving,   setSaving]       = useState(false);
  const [error,    setError]        = useState<string | null>(null);
  const [success,  setSuccess]      = useState(false);

  const strength    = getStrength(password);
  const hasLen      = password.length >= 8;
  const hasLetter   = /[a-zA-Z]/.test(password);
  const hasDigit    = /[0-9]/.test(password);
  const passwordsMatch = password === confirm && confirm.length > 0;
  const canSubmit   = hasLen && hasLetter && hasDigit && passwordsMatch && !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/admin/auth/change-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ password, confirmPassword: confirm }),
      });

      const data = await res.json() as { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/admin"), 1500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div
        className="px-6 py-5 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2.5 mb-1">
          <KeyRound size={18} style={{ color: "#E85D4A" }} />
          <h1 className="text-base font-semibold text-foreground">Set Your Password</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Hi {name} — please set a permanent password before continuing.
        </p>
      </div>

      {success ? (
        <div className="px-6 py-12 text-center space-y-2">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ backgroundColor: "rgba(52,199,89,0.12)" }}
          >
            <CheckCircle2 size={22} style={{ color: "#34C759" }} />
          </div>
          <p className="text-base font-semibold text-foreground">Password updated!</p>
          <p className="text-sm text-muted-foreground">Taking you to the admin panel…</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* New password */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              New Password <span style={{ color: "#E85D4A" }}>*</span>
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                required
                className="w-full px-3 py-2.5 pr-10 rounded-xl border text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/40"
                style={{ borderColor: "var(--border)" }}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            {/* Strength bar */}
            {password.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex gap-1 h-1">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-full transition-colors"
                      style={{
                        backgroundColor: strength.level >= i ? strength.color : "rgba(255,255,255,0.1)",
                      }}
                    />
                  ))}
                </div>
                <p className="text-[11px] font-medium" style={{ color: strength.color }}>
                  {strength.label}
                </p>
              </div>
            )}

            {/* Requirements */}
            <ul className="space-y-1 pt-0.5">
              <Rule met={hasLen}    label="At least 8 characters" />
              <Rule met={hasLetter} label="At least one letter" />
              <Rule met={hasDigit}  label="At least one number" />
            </ul>
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Confirm Password <span style={{ color: "#E85D4A" }}>*</span>
            </label>
            <div className="relative">
              <input
                type={showCf ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter your password"
                required
                className="w-full px-3 py-2.5 pr-10 rounded-xl border text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/40"
                style={{
                  borderColor: confirm.length > 0
                    ? (passwordsMatch ? "#34C759" : "#E85D4A")
                    : "var(--border)",
                }}
              />
              <button
                type="button"
                onClick={() => setShowCf((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCf ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {confirm.length > 0 && !passwordsMatch && (
              <p className="text-[11px] text-red-400 flex items-center gap-1">
                <AlertCircle size={11} /> Passwords do not match
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs font-medium text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#E85D4A" }}
          >
            {saving ? (
              <><Loader2 size={14} className="animate-spin" /> Saving…</>
            ) : (
              <><KeyRound size={14} /> Set Password & Continue</>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
