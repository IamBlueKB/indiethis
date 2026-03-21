"use client";

interface Props {
  message:    string;
  actionText?: string;
  actionUrl?:  string;
}

export default function PinnedAnnouncement({ message, actionText, actionUrl }: Props) {
  return (
    <div
      className="flex items-center gap-3 rounded-[10px] px-4 py-3"
      style={{
        background: "linear-gradient(135deg, rgba(232,93,74,0.15), rgba(212,168,67,0.10))",
        border:     "1px solid rgba(232,93,74,0.20)",
      }}
    >
      {/* Red dot indicator */}
      <div
        className="shrink-0 rounded-full"
        style={{ width: 8, height: 8, backgroundColor: "#E85D4A" }}
      />

      {/* Message */}
      <p className="flex-1 text-[12px] text-[#F5F5F5] leading-snug">{message}</p>

      {/* Action button */}
      {actionText && actionUrl && (
        <a
          href={actionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 px-3 py-1 rounded-full text-[10px] no-underline transition-all hover:bg-[rgba(232,93,74,0.15)]"
          style={{
            color:  "#E85D4A",
            border: "1px solid rgba(232,93,74,0.30)",
          }}
        >
          {actionText}
        </a>
      )}
    </div>
  );
}
