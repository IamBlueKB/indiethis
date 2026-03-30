"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  Download, Music2, Package, AlertTriangle, Loader2, CheckCircle2,
} from "lucide-react";
import Link from "next/link";

type DownloadInfo = {
  purchase: {
    downloadToken: string;
    downloadCount: number;
    maxDownloads: number;
    remaining: number;
  };
  product: {
    title: string;
    type: string;
  };
  tracks: Array<{
    id: string;
    title: string;
    downloadUrl: string;
  }>;
};

export default function DigitalDownloadPage() {
  const { token }        = useParams<{ token: string }>();
  const searchParams     = useSearchParams();
  const sessionId        = searchParams.get("session_id");

  const [data, setData]         = useState<DownloadInfo | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [downloaded, setDl]     = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!token) return;
    fetch(`/api/dl/digital/${token}`)
      .then((r) => r.json())
      .then((d: DownloadInfo & { error?: string }) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("Failed to load download page"))
      .finally(() => setLoading(false));
  }, [token]);

  function handleDownload(trackId: string, trackTitle: string) {
    // Navigate to the download URL which will redirect to the file
    const url = `/api/dl/digital/${token}?trackId=${trackId}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${trackTitle}.mp3`;
    a.click();
    setDl((prev) => new Set([...prev, trackId]));
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0A0A0A" }}>
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#0A0A0A" }}>
        <div className="text-center max-w-sm">
          <AlertTriangle size={40} className="mx-auto mb-4 text-red-400" />
          <h2 className="text-lg font-semibold text-white mb-2">
            {error.includes("limit") ? "Download Limit Reached" : "Link Not Found"}
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            {error.includes("limit")
              ? "This download link has been used the maximum number of times."
              : "This download link is invalid or has expired."}
          </p>
          <p className="text-xs text-gray-500">
            Need help? Email{" "}
            <a href="mailto:support@indiethis.com" className="underline" style={{ color: "#D4A843" }}>
              support@indiethis.com
            </a>
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { purchase, product, tracks } = data;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0A" }}>
      <div className="max-w-lg mx-auto px-4 py-12">

        {/* Header */}
        <div className="text-center mb-8">
          {sessionId && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-sm"
              style={{ backgroundColor: "rgba(212,168,67,0.15)", color: "#D4A843" }}>
              <CheckCircle2 size={14} />
              Purchase complete!
            </div>
          )}
          <div className="flex items-center justify-center mb-3">
            <div className="w-16 h-16 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "rgba(212,168,67,0.1)" }}>
              <Package size={28} style={{ color: "#D4A843" }} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">{product.title}</h1>
          <p className="text-sm text-gray-400 mt-1">{product.type}</p>
        </div>

        {/* Download Info */}
        <div
          className="rounded-xl border p-4 mb-6"
          style={{ backgroundColor: "#111", borderColor: "#222" }}
        >
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Downloads remaining</span>
            <span className="font-medium" style={{ color: purchase.remaining > 0 ? "#D4A843" : "#f87171" }}>
              {purchase.remaining} of {purchase.maxDownloads}
            </span>
          </div>
          {purchase.remaining <= 1 && purchase.remaining > 0 && (
            <p className="text-xs text-yellow-400/70 mt-2">
              Only {purchase.remaining} download{purchase.remaining === 1 ? "" : "s"} left on this link.
            </p>
          )}
        </div>

        {/* Track List */}
        <div className="space-y-2">
          {tracks.map((track) => (
            <div
              key={track.id}
              className="rounded-xl border p-4 flex items-center gap-3"
              style={{ backgroundColor: "#111", borderColor: "#222" }}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(212,168,67,0.1)" }}>
                <Music2 size={16} style={{ color: "#D4A843" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{track.title}</p>
              </div>
              <button
                onClick={() => handleDownload(track.id, track.title)}
                disabled={purchase.remaining <= 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
                style={
                  downloaded.has(track.id)
                    ? { backgroundColor: "rgba(52,211,153,0.15)", color: "#34d399" }
                    : { backgroundColor: "#D4A843", color: "#0A0A0A" }
                }
              >
                {downloaded.has(track.id) ? (
                  <><CheckCircle2 size={12} /> Downloaded</>
                ) : (
                  <><Download size={12} /> Download</>
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-gray-600">
          <p>Download links are emailed to you for future access.</p>
          <p className="mt-1">
            Need help?{" "}
            <a href="mailto:support@indiethis.com" className="underline" style={{ color: "#D4A843" }}>
              support@indiethis.com
            </a>
          </p>
          <Link href="/" className="block mt-3 hover:text-gray-400 transition-colors">
            Powered by IndieThis
          </Link>
        </div>
      </div>
    </div>
  );
}
