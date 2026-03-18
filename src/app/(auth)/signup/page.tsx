"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, Mic2, Building2, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type RoleOption = "ARTIST" | "STUDIO_ADMIN";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = searchParams.get("role") === "STUDIO_ADMIN" ? "STUDIO_ADMIN" : "ARTIST";
  const refCode = searchParams.get("ref") ?? undefined;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<RoleOption>(initialRole);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role, referralCode: refCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      // Auto-sign-in after successful registration
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        // Registration succeeded but sign-in failed — redirect to login
        router.push("/login?registered=1");
      } else {
        router.push(role === "STUDIO_ADMIN" ? "/studio" : "/dashboard");
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const roleOptions: { value: RoleOption; label: string; description: string; icon: React.ReactNode }[] = [
    {
      value: "ARTIST",
      label: "Independent Artist",
      description: "Create, sell, and grow your music career",
      icon: <Mic2 size={20} />,
    },
    {
      value: "STUDIO_ADMIN",
      label: "Studio Owner",
      description: "Manage bookings, artists, and file delivery",
      icon: <Building2 size={20} />,
    },
  ];

  return (
    <Card className="w-full max-w-[460px]" style={{ backgroundColor: "var(--card)" }}>
      <CardHeader className="text-center pb-2">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <img src="/images/brand/indiethis-icon.svg" alt="IndieThis" style={{ width: "44px", height: "44px" }} />
        </div>
        <h1 className="font-display font-bold text-2xl text-foreground tracking-tight">
          Create your account
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Join IndieThis — your music, your platform
        </p>
      </CardHeader>

      <CardContent className="pt-4">
        {/* Referral banner */}
        {refCode && (
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-4 text-xs font-medium"
            style={{ backgroundColor: "rgba(212,168,67,0.1)", border: "1px solid rgba(212,168,67,0.25)", color: "#D4A843" }}
          >
            <Gift size={13} className="shrink-0" />
            You were invited by a friend! You&apos;ll both get a bonus when you join.
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">I am a…</Label>
            <div className="grid grid-cols-2 gap-3">
              {roleOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  className={cn(
                    "flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all",
                    role === opt.value
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-background/50 text-muted-foreground hover:border-border/80"
                  )}
                >
                  <span className={cn(role === opt.value ? "text-accent" : "text-muted-foreground")}>
                    {opt.icon}
                  </span>
                  <span className="text-sm font-semibold text-foreground leading-tight">
                    {opt.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground leading-tight">
                    {opt.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm font-medium text-foreground">
              Full Name
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="Your name"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

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
            <Label htmlFor="password" className="text-sm font-medium text-foreground">
              Password
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
            <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
              Confirm Password
            </Label>
            <Input
              id="confirmPassword"
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
            className="w-full h-11 font-semibold bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Creating account…
              </>
            ) : (
              "Create Account"
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            By creating an account you agree to our{" "}
            <Link href="/terms" className="text-accent hover:text-accent/80 transition-colors">
              Terms of Service
            </Link>
          </p>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-5">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-accent hover:text-accent/80 font-medium transition-colors"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
