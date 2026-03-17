"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download, Music2, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

type DownloadData = {
  senderName: string;
  message: string | null;
  fileUrls: string[];
  expiresAt: string;
  downloadedAt: string | null;
};

export default function DownloadPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<DownloadData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
fetch(`/api/dl/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("Failed to load files."));
  }, [token]);

  const isExpired = data ? new Date(data.expiresAt) < new Date() : false;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
        <div className="text-center space-y-3">
          <AlertTriangle size={40} className="mx-auto text-red-400" />
          <p className="text-foreground font-semibold">{error}</p>
          <p className="text-sm text-muted-foreground">This link may have expired or is invalid.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10 px-4" style={{ backgroundColor: "var(--background)" }}>
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
          >
            <Music2 size={24} className="text-accent" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Files from {data.senderName}</h1>
          {data.message && (
            <p className="text-sm text-muted-foreground leading-relaxed">{data.message}</p>
          )}
        </div>

        {/* Expiry notice */}
        <div
          className="rounded-xl border px-4 py-3 flex items-center gap-2.5"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          {isExpired ? (
            <>
              <AlertTriangle size={14} className="text-red-400 shrink-0" />
              <p className="text-xs text-red-400">This link has expired.</p>
            </>
          ) : data.downloadedAt ? (
            <>
              <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Downloaded on{" "}
                {new Date(data.downloadedAt).toLocaleDateString("en-US", {
                  month: "long", day: "numeric", year: "numeric",
                })}
              </p>
            </>
          ) : (
            <>
              <Clock size={14} className="text-yellow-400 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Link expires{" "}
                {new Date(data.expiresAt).toLocaleDateString("en-US", {
                  month: "long", day: "numeric", year: "numeric",
                })}
              </p>
            </>
          )}
        </div>

        {/* Files */}
        {!isExpired && (
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {data.fileUrls.length} File{data.fileUrls.length !== 1 ? "s" : ""}
              </p>
            </div>
            {data.fileUrls.map((url, i) => {
              const filename = url.split("/").pop() ?? `File ${i + 1}`;
              return (
                <a
                  key={i}
                  href={url}
                  download
                  onClick={() => setDownloading(true)}
                  className="flex items-center justify-between px-5 py-4 border-b last:border-b-0 hover:bg-white/3 transition-colors no-underline group"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "var(--border)" }}
                    >
                      <Music2 size={14} className="text-muted-foreground" />
                    </div>
                    <p className="text-sm text-foreground truncate">{filename}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 ml-4">
                    <Download size={14} />
                    <span className="text-xs">Download</span>
                  </div>
                </a>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground pb-6">
          Powered by{" "}
          <span className="font-semibold" style={{ color: "#D4A843" }}>
            IndieThis
          </span>
        </p>
      </div>
    </div>
  );
}
