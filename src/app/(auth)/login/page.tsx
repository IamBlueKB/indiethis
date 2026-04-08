"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "facebook" | null>(null);
  const [showPw, setShowPw]   = useState(false);

  async function handleSocial(provider: "google" | "facebook") {
    setSocialLoading(provider);
    setError("");
    try {
      await signIn(provider, { callbackUrl: "/dashboard" });
    } catch {
      setError("Something went wrong. Please try again.");
      setSocialLoading(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password. Please try again.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-[420px]" style={{ backgroundColor: "var(--card)" }}>
      <CardHeader className="text-center pb-2">
        <div className="flex justify-center mb-4">
          <img src="/images/brand/indiethis-icon.svg" alt="IndieThis" style={{ width: "44px", height: "44px" }} />
        </div>
        <h1 className="font-display font-bold text-2xl text-foreground tracking-tight">
          Welcome back
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sign in to your IndieThis account
        </p>
      </CardHeader>

      <CardContent className="pt-4">
        {/* ── Social login buttons ── */}
        <div className="space-y-3 mb-5">
          {/* Google */}
          <button
            type="button"
            onClick={() => handleSocial("google")}
            disabled={!!socialLoading || loading}
            className="w-full flex items-center justify-center gap-3 h-11 rounded-lg border border-input bg-white text-[#0A0A0A] text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {socialLoading === "google" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
            )}
            Continue with Google
          </button>

          {/* Facebook */}
          <button
            type="button"
            onClick={() => handleSocial("facebook")}
            disabled={!!socialLoading || loading}
            className="w-full flex items-center justify-center gap-3 h-11 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "#1877F2" }}
          >
            {socialLoading === "facebook" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            )}
            Continue with Facebook
          </button>
        </div>

        {/* ── Divider ── */}
        <div className="relative flex items-center mb-5">
          <div className="flex-1 border-t border-border" />
          <span className="mx-3 text-xs text-muted-foreground">or</span>
          <div className="flex-1 border-t border-border" />
        </div>

        {/* ── Email / password form ── */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium text-foreground">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </Label>
              <Link
                href="/forgot-password"
                className="text-xs text-accent hover:text-accent/80 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <div className="flex items-center rounded-md border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              <input
                id="password"
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 px-3 py-2 text-sm bg-transparent text-foreground outline-none min-w-0 h-9"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                tabIndex={-1}
                className="flex items-center justify-center w-10 h-9 shrink-0 border-l border-input text-muted-foreground transition-colors hover:bg-muted"
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading || !!socialLoading}
            className="w-full h-11 font-semibold bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-5">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="text-accent hover:text-accent/80 font-medium transition-colors"
          >
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
