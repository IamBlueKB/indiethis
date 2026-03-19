"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, UserPlus, Eye, EyeOff } from "lucide-react";

type AdminRole = "OPS_ADMIN" | "SUPPORT_ADMIN";

const ROLE_OPTIONS: { value: AdminRole; label: string; description: string }[] = [
  {
    value:       "OPS_ADMIN",
    label:       "Ops Admin",
    description: "Full access to users, studios, moderation, affiliates. View-only on AI usage.",
  },
  {
    value:       "SUPPORT_ADMIN",
    label:       "Support Admin",
    description: "Access to moderation and support chat. View-only on users, studios, dashboard.",
  },
];

export default function CreateAdminModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();

  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [role,     setRole]     = useState<AdminRole>("OPS_ADMIN");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/admin/team", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name, email, password, role }),
      });

      const data = await res.json() as { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      setSuccess(true);
      // Refresh server data, then close
      router.refresh();
      setTimeout(() => onClose(), 1200);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2.5">
            <UserPlus size={17} style={{ color: "#E85D4A" }} />
            <h2 className="text-base font-semibold text-foreground">Create Admin Account</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="px-6 py-10 text-center space-y-2">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ backgroundColor: "rgba(52,199,89,0.12)" }}
            >
              <UserPlus size={20} style={{ color: "#34C759" }} />
            </div>
            <p className="text-base font-semibold text-foreground">Account created!</p>
            <p className="text-sm text-muted-foreground">
              A welcome email with login details has been sent to <strong>{email}</strong>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Full Name <span style={{ color: "#E85D4A" }}>*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                required
                className="w-full px-3 py-2.5 rounded-xl border text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/40"
                style={{ borderColor: "var(--border)" }}
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Email Address <span style={{ color: "#E85D4A" }}>*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@indiethis.com"
                required
                className="w-full px-3 py-2.5 rounded-xl border text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/40"
                style={{ borderColor: "var(--border)" }}
              />
            </div>

            {/* Temporary password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Temporary Password <span style={{ color: "#E85D4A" }}>*</span>
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  required
                  minLength={8}
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
              <p className="text-[11px] text-muted-foreground">
                The new admin will be prompted to change this on first login.
              </p>
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Role <span style={{ color: "#E85D4A" }}>*</span>
              </label>
              <div className="space-y-2">
                {ROLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRole(opt.value)}
                    className="flex items-start gap-3 w-full px-4 py-3 rounded-xl border text-left transition-colors"
                    style={{
                      borderColor:     role === opt.value ? "#E85D4A" : "var(--border)",
                      backgroundColor: role === opt.value ? "rgba(232,93,74,0.06)" : "transparent",
                    }}
                  >
                    <div
                      className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5"
                      style={{ borderColor: role === opt.value ? "#E85D4A" : "var(--border)" }}
                    >
                      {role === opt.value && (
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#E85D4A" }} />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-xs font-medium text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !name || !email || !password}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: "#E85D4A" }}
              >
                {saving ? (
                  <><Loader2 size={14} className="animate-spin" /> Creating…</>
                ) : (
                  <><UserPlus size={14} /> Create Account</>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
