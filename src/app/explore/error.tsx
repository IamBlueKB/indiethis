"use client";

import { useEffect } from "react";

export default function ExploreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Explore page error:", error);
  }, [error]);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0A0A0A", color: "#f5f5f5", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", fontFamily: "monospace" }}>
      <h2 style={{ color: "#E85D4A", marginBottom: "1rem", fontSize: "1.25rem" }}>Something went wrong on the explore page</h2>
      <pre style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: "12px", padding: "1rem", maxWidth: "700px", width: "100%", overflowX: "auto", fontSize: "12px", color: "#D4A843", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {error?.message || "Unknown error"}
        {"\n\n"}
        {error?.stack || "No stack trace"}
      </pre>
      <p style={{ color: "#888", margin: "1rem 0", fontSize: "12px" }}>Digest: {error?.digest}</p>
      <button
        onClick={reset}
        style={{ marginTop: "1rem", padding: "0.75rem 1.5rem", borderRadius: "12px", backgroundColor: "#D4A843", color: "#0A0A0A", fontWeight: "bold", border: "none", cursor: "pointer" }}
      >
        Try again
      </button>
    </div>
  );
}
