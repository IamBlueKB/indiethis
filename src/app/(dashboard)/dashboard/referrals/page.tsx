"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Gift, Users, Zap, ArrowRight, Share2 } from "lucide-react";

const REWARDS = [
  { milestone: 1,  label: "First friend",  reward: "1 free AI Credit",      color: "#D4A843" },
  { milestone: 3,  label: "3 friends",     reward: "1 free Mastering job",   color: "#34C759" },
  { milestone: 5,  label: "5 friends",     reward: "1 free Lyric Video",     color: "#5AC8FA" },
  { milestone: 10, label: "10 friends",    reward: "1 free A&R Report",      color: "#E85D4A" },
];

export default function ReferralsPage() {
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard/referrals")
      .then((r) => r.json())
      .then((d) => {
        setReferralCode(d.referralCode ?? null);
        setReferralCount(d.referralCount ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const referralLink = referralCode
    ? `${typeof window !== "undefined" ? window.location.origin : "https://indiethis.com"}/signup?ref=${referralCode}`
    : null;

  async function copyLink() {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const nextReward = REWARDS.find((r) => r.milestone > referralCount);
  const friendsNeeded = nextReward ? nextReward.milestone - referralCount : 0;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Referrals</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Invite friends and earn free credits and tools
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div
          className="rounded-2xl border p-5"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Users size={15} className="text-accent" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Friends Joined</p>
          </div>
          <p className="text-3xl font-bold text-foreground font-display">{referralCount}</p>
          <p className="text-xs text-muted-foreground mt-1">all time</p>
        </div>
        <div
          className="rounded-2xl border p-5"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Gift size={15} className="text-accent" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next Reward</p>
          </div>
          {nextReward ? (
            <>
              <p className="text-sm font-bold text-foreground">{nextReward.reward}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {friendsNeeded} more friend{friendsNeeded !== 1 ? "s" : ""} to unlock
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-foreground">All unlocked! 🎉</p>
              <p className="text-xs text-muted-foreground mt-1">Keep referring for bonus perks</p>
            </>
          )}
        </div>
      </div>

      {/* Referral link card */}
      <div
        className="rounded-2xl border p-5 space-y-4"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <Share2 size={15} style={{ color: "#D4A843" }} />
          <h2 className="text-sm font-semibold text-foreground">Your Referral Link</h2>
        </div>

        {loading ? (
          <div className="h-10 rounded-xl animate-pulse" style={{ backgroundColor: "var(--border)" }} />
        ) : referralLink ? (
          <>
            <div
              className="flex items-center gap-2 rounded-xl border px-3 py-2.5"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
            >
              <p className="text-sm text-muted-foreground flex-1 truncate font-mono">{referralLink}</p>
              <button
                onClick={copyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy Link</>}
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className="px-2 py-0.5 rounded font-mono font-semibold text-xs"
                style={{ backgroundColor: "var(--border)", color: "var(--foreground)" }}
              >
                {referralCode}
              </span>
              <span>Share this link with friends. When they sign up, you both get rewarded.</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Could not load referral link. Refresh to try again.</p>
        )}
      </div>

      {/* Reward milestones */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <Zap size={14} style={{ color: "#D4A843" }} />
            <p className="text-sm font-semibold text-foreground">Reward Milestones</p>
          </div>
        </div>

        {REWARDS.map((reward, i) => {
          const achieved = referralCount >= reward.milestone;
          const isCurrent = !achieved && (i === 0 || referralCount >= REWARDS[i - 1].milestone);
          return (
            <div
              key={reward.milestone}
              className="flex items-center gap-4 px-5 py-4 border-b last:border-b-0"
              style={{ borderColor: "var(--border)", opacity: achieved || isCurrent ? 1 : 0.45 }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm font-display"
                style={{
                  backgroundColor: achieved ? `${reward.color}20` : "var(--border)",
                  color: achieved ? reward.color : "var(--muted-foreground)",
                  border: isCurrent ? `1px solid ${reward.color}60` : "none",
                }}
              >
                {achieved ? <Check size={16} /> : reward.milestone}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{reward.reward}</p>
                <p className="text-xs text-muted-foreground">{reward.label} signed up</p>
              </div>
              {achieved && (
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: `${reward.color}18`, color: reward.color }}
                >
                  Earned
                </span>
              )}
              {isCurrent && !achieved && (
                <div className="flex items-center gap-1 text-xs font-semibold shrink-0" style={{ color: reward.color }}>
                  <ArrowRight size={12} />
                  Next
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* How it works */}
      <div
        className="rounded-2xl border p-5 space-y-3"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">How it works</p>
        <div className="space-y-2.5">
          {[
            { step: "1", text: "Copy your referral link above and share it with other artists." },
            { step: "2", text: "When they sign up using your link, they're linked to your account." },
            { step: "3", text: "Hit the milestones above and the rewards are automatically added to your account." },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-start gap-3">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5"
                style={{ backgroundColor: "rgba(212,168,67,0.15)", color: "#D4A843" }}
              >
                {step}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
