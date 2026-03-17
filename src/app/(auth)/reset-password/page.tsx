"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Music2, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <Card className="w-full max-w-[420px]" style={{ backgroundColor: "var(--card)" }}>
        <CardContent className="pt-10 pb-8 text-center space-y-4">
          <XCircle size={40} className="mx-auto text-red-400" />
          <p className="text-sm text-muted-foreground">
            Invalid or missing reset token. Request a new link below.
          </p>
          <Link href="/forgot-password"
            className="inline-block text-sm font-medium no-underline"
            style={{ color: "#D4A843" }}>
            Request a new link →
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className="w-full max-w-[420px]" style={{ backgroundColor: "var(--card)" }}>
        <CardContent className="pt-10 pb-8 text-center space-y-4">
          <CheckCircle2 size={40} className="mx-auto" style={{ color: "#34C759" }} />
          <div>
            <p className="font-semibold text-foreground">Password updated!</p>
            <p className="text-sm text-muted-foreground mt-1">Redirecting you to sign in…</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-[420px]" style={{ backgroundColor: "var(--card)" }}>
      <CardHeader className="text-center pb-2">
        <div className="flex justify-center mb-4">
          <div className="w-11 h-11 rounded-[12px] flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #D4A843, #E85D4A)" }}>
            <Music2 size={22} className="text-white" strokeWidth={2.5} />
          </div>
        </div>
        <h1 className="font-display font-bold text-2xl text-foreground tracking-tight">
          Set new password
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose a strong password for your account.
        </p>
      </CardHeader>

      <CardContent className="pt-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium text-foreground">
              New Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Min. 8 characters"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm" className="text-sm font-medium text-foreground">
              Confirm Password
            </Label>
            <Input
              id="confirm"
              type="password"
              placeholder="Repeat your password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 font-semibold"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            {loading ? (
              <><Loader2 size={16} className="mr-2 animate-spin" /> Updating…</>
            ) : (
              "Update Password"
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-5">
          Remember your password?{" "}
          <Link href="/login" className="font-medium transition-colors no-underline"
            style={{ color: "#D4A843" }}>
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
