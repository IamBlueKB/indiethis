"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

const MAX_ATTEMPTS = 15;   // 15 × 2s = 30s max wait
const POLL_INTERVAL_MS = 2000;

function CompleteSignupContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const sessionId    = searchParams.get("session_id");

  const [status, setStatus]     = useState<"loading" | "signing-in" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const attempts = useRef(0);

  useEffect(() => {
    if (!sessionId) {
      setErrorMsg("Missing session ID. Please contact support.");
      setStatus("error");
      return;
    }

    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      attempts.current += 1;

      try {
        const res  = await fetch(`/api/auth/complete-signup?session_id=${encodeURIComponent(sessionId!)}`);
        const data = await res.json() as { status: string; token?: string; email?: string; error?: string };

        if (cancelled) return;

        if (data.status === "ready" && data.token) {
          setStatus("signing-in");
          const result = await signIn("credentials", {
            autoSigninToken: data.token,
            redirect: false,
          });

          if (result?.error) {
            setErrorMsg("Signed up but couldn't log you in automatically. Please sign in manually.");
            setStatus("error");
          } else {
            router.push("/signup/setup");
            router.refresh();
          }
          return;
        }

        if (data.status === "error") {
          setErrorMsg(data.error ?? "Something went wrong.");
          setStatus("error");
          return;
        }

        // status === "pending" — retry
        if (attempts.current >= MAX_ATTEMPTS) {
          setErrorMsg("Account setup is taking longer than expected. Please contact support or try signing in.");
          setStatus("error");
          return;
        }

        setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        if (!cancelled) {
          if (attempts.current >= MAX_ATTEMPTS) {
            setErrorMsg("Could not connect. Please check your connection and try again.");
            setStatus("error");
          } else {
            setTimeout(poll, POLL_INTERVAL_MS);
          }
        }
      }
    }

    poll();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: "#0A0A0A" }}
    >
      {/* Logo */}
      <img
        src="/images/brand/indiethis-logo-dark-bg.svg"
        alt="IndieThis"
        style={{ height: 32, width: "auto", marginBottom: 40 }}
      />

      <div
        className="w-full max-w-sm rounded-2xl border p-8 text-center space-y-4"
        style={{ backgroundColor: "#111", borderColor: "#2a2a2a" }}
      >
        {status === "loading" && (
          <>
            <Loader2 size={32} className="animate-spin mx-auto" style={{ color: "#D4A843" }} />
            <h1 className="text-lg font-bold text-white">Setting up your account…</h1>
            <p className="text-sm" style={{ color: "#888" }}>
              This usually takes just a few seconds.
            </p>
          </>
        )}

        {status === "signing-in" && (
          <>
            <Loader2 size={32} className="animate-spin mx-auto" style={{ color: "#34C759" }} />
            <h1 className="text-lg font-bold text-white">Signing you in…</h1>
          </>
        )}

        {status === "error" && (
          <>
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mx-auto text-xl font-bold"
              style={{ backgroundColor: "rgba(232,93,74,0.15)", color: "#E85D4A" }}
            >
              !
            </div>
            <h1 className="text-lg font-bold text-white">Something went wrong</h1>
            <p className="text-sm" style={{ color: "#888" }}>{errorMsg}</p>
            <div className="flex flex-col gap-2 pt-2">
              <a
                href="/login"
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-center transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                Sign in manually
              </a>
              <a
                href="mailto:support@indiethis.com"
                className="text-xs underline"
                style={{ color: "#666" }}
              >
                Contact support
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function CompleteSignupPage() {
  return (
    <Suspense>
      <CompleteSignupContent />
    </Suspense>
  );
}
