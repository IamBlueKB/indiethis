"use client";

import { useState, useEffect, useRef } from "react";
import { Activity, Loader2 } from "lucide-react";

interface Stats {
  total:     number;
  analyzed:  number;
  remaining: number;
}

interface BatchResult {
  processed:  number;
  total:      number;
  hasMore:    boolean;
  nextOffset: number;
}

export default function AudioFeaturesBackfillContent() {
  const [stats,     setStats]     = useState<Stats | null>(null);
  const [running,   setRunning]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [processed, setProcessed] = useState(0);
  const [error,     setError]     = useState<string | null>(null);

  const abortRef = useRef(false);

  async function fetchStats() {
    try {
      const res = await fetch("/api/admin/audio-features/backfill");
      if (!res.ok) throw new Error("Failed to fetch stats");
      const data = await res.json() as Stats;
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }

  useEffect(() => {
    void fetchStats();
  }, []);

  async function runBatch(offset: number): Promise<void> {
    if (abortRef.current) return;

    const res = await fetch("/api/admin/audio-features/backfill", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ offset }),
    });

    if (!res.ok) throw new Error(`Batch failed: ${res.status}`);
    const data = await res.json() as BatchResult;

    setProcessed((prev) => prev + data.processed);

    if (data.hasMore && !abortRef.current) {
      // Wait 1 second before next batch
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      await runBatch(data.nextOffset);
    } else {
      setDone(true);
      setRunning(false);
      await fetchStats();
    }
  }

  async function handleStart() {
    setRunning(true);
    setDone(false);
    setProcessed(0);
    setError(null);
    abortRef.current = false;

    try {
      await runBatch(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setRunning(false);
    }
  }

  function handleStop() {
    abortRef.current = true;
    setRunning(false);
  }

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Activity size={24} style={{ color: "#E85D4A" }} />
        <h1 className="text-2xl font-semibold text-foreground">AudioFeatures Backfill</h1>
      </div>

      {/* Stats */}
      {stats ? (
        <div
          className="rounded-xl border p-6 mb-8 grid grid-cols-3 gap-6"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          <div className="text-center">
            <p className="text-3xl font-bold text-foreground">{stats.total.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground mt-1">Total Tracks</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold" style={{ color: "#34C759" }}>
              {stats.analyzed.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Analyzed</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold" style={{ color: "#D4A843" }}>
              {stats.remaining.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Remaining</p>
          </div>
        </div>
      ) : (
        <div
          className="rounded-xl border p-6 mb-8 flex items-center justify-center"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Progress */}
      {(running || done || processed > 0) && (
        <div
          className="rounded-xl border p-4 mb-6 text-sm"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          {running && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 size={16} className="animate-spin shrink-0" />
              <span>
                Running… processed <span className="font-semibold text-foreground">{processed}</span> tracks so far.
              </span>
            </div>
          )}
          {!running && done && (
            <p className="text-foreground font-medium">
              Done! Processed{" "}
              <span className="font-semibold" style={{ color: "#34C759" }}>{processed}</span> tracks.
            </p>
          )}
          {!running && !done && processed > 0 && (
            <p className="text-muted-foreground">
              Stopped after processing{" "}
              <span className="font-semibold text-foreground">{processed}</span> tracks.
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="rounded-xl border p-4 mb-6 text-sm"
          style={{ borderColor: "#E85D4A44", backgroundColor: "#E85D4A11", color: "#E85D4A" }}
        >
          Error: {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => void handleStart()}
          disabled={running || stats?.remaining === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: "#E85D4A", color: "#fff" }}
        >
          {running ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Running…
            </>
          ) : (
            <>
              <Activity size={16} />
              Run Backfill Batch (50 tracks)
            </>
          )}
        </button>

        {running && (
          <button
            onClick={handleStop}
            className="px-5 py-2.5 rounded-lg text-sm font-medium border transition-colors hover:bg-white/5"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            Stop
          </button>
        )}
      </div>
    </div>
  );
}
