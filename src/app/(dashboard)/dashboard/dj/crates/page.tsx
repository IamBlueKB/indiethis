"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Disc3, Plus, Globe, Lock, Trash2, Edit3, X, Check, Loader2, ChevronRight, Bell } from "lucide-react";

type Crate = {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  coverArtUrl: string | null;
  createdAt: string;
  _count: { items: number };
};

type PendingInvite = {
  id: string;
  crateId: string;
  status: string;
  createdAt: string;
  crate: {
    id: string;
    name: string;
    djProfile: {
      slug: string;
      user: { name: string; artistName: string | null; photo: string | null };
    };
  };
};

const TIER_LIMITS: Record<string, number> = {
  LAUNCH: 5,
  PUSH: 15,
  REIGN: 0,
};

export default function DJCratesPage() {
  const [crates, setCrates] = useState<Crate[]>([]);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<string>("LAUNCH");
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingCrate, setEditingCrate] = useState<Crate | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/dj/crates").then(r => r.json()),
      fetch("/api/dashboard/dj/invites").then(r => r.json()).catch(() => ({ invites: [] })),
    ]).then(([crateData, inviteData]) => {
      const cd = crateData as { crates: Crate[]; tier?: string };
      setCrates(cd.crates ?? []);
      setTier(cd.tier ?? "LAUNCH");
      setPendingInvites((inviteData as { invites?: PendingInvite[] }).invites ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const limit = TIER_LIMITS[tier] ?? 5;
  const atLimit = limit > 0 && crates.length >= limit;

  async function handleDelete(id: string) {
    if (!confirm("Delete this crate? This cannot be undone.")) return;
    setDeletingId(id);
    await fetch(`/api/dashboard/dj/crates/${id}`, { method: "DELETE" });
    setCrates(prev => prev.filter(c => c.id !== id));
    setDeletingId(null);
  }

  async function handleAcceptInvite(crateId: string) {
    setAcceptingId(crateId);
    await fetch(`/api/dj/crates/${crateId}/accept-invite`, { method: "POST" });
    setPendingInvites(prev => prev.filter(i => i.crateId !== crateId));
    // Refresh crates list
    const data = await fetch("/api/dashboard/dj/crates").then(r => r.json()) as { crates: Crate[]; tier?: string };
    setCrates(data.crates ?? []);
    setAcceptingId(null);
  }

  async function handleDeclineInvite(crateId: string) {
    setDecliningId(crateId);
    await fetch(`/api/dj/crates/${crateId}/decline-invite`, { method: "POST" });
    setPendingInvites(prev => prev.filter(i => i.crateId !== crateId));
    setDecliningId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="animate-spin" style={{ color: "#D4A843" }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Crates</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {limit > 0
              ? `${crates.length} of ${limit} crates used`
              : `${crates.length} crate${crates.length !== 1 ? "s" : ""}`
            }
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          disabled={atLimit}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          title={atLimit ? `Upgrade to create more than ${limit} crates` : undefined}
        >
          <Plus size={14} /> New Crate
        </button>
      </div>

      {atLimit && (
        <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "rgba(212,168,67,0.3)", backgroundColor: "rgba(212,168,67,0.05)", color: "#D4A843" }}>
          You&apos;ve reached your {limit}-crate limit on the {tier} plan.{" "}
          <Link href="/dashboard/upgrade" className="underline font-semibold">Upgrade</Link> to add more.
        </div>
      )}

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="rounded-xl border p-4 space-y-3" style={{ backgroundColor: "var(--card)", borderColor: "rgba(212,168,67,0.3)" }}>
          <div className="flex items-center gap-2">
            <Bell size={14} style={{ color: "#D4A843" }} />
            <p className="text-sm font-semibold text-foreground">
              Crate Invites ({pendingInvites.length})
            </p>
          </div>
          {pendingInvites.map(invite => {
            const sender = invite.crate.djProfile.user;
            const senderName = sender.artistName ?? sender.name;
            return (
              <div
                key={invite.id}
                className="flex items-center justify-between gap-3 py-2 border-t"
                style={{ borderColor: "var(--border)" }}
              >
                <div>
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">{senderName}</span> invited you to collaborate on &quot;{invite.crate.name}&quot;
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleDeclineInvite(invite.crateId)}
                    disabled={decliningId === invite.crateId}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50"
                    style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                  >
                    {decliningId === invite.crateId ? <Loader2 size={11} className="animate-spin" /> : "Decline"}
                  </button>
                  <button
                    onClick={() => handleAcceptInvite(invite.crateId)}
                    disabled={acceptingId === invite.crateId}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50"
                    style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                  >
                    {acceptingId === invite.crateId ? <Loader2 size={11} className="animate-spin" /> : <><Check size={11} /> Accept</>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {crates.length === 0 ? (
        <div className="rounded-2xl border p-12 text-center space-y-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <Disc3 size={40} className="mx-auto text-muted-foreground opacity-30" />
          <div>
            <p className="font-semibold text-foreground">No crates yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first crate to start organizing tracks.</p>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            <Plus size={14} /> Create Crate
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {crates.map((crate) => (
            <div
              key={crate.id}
              className="rounded-xl border p-4 flex items-center gap-4"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <div
                className="w-14 h-14 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
                style={{ backgroundColor: "var(--background)" }}
              >
                {crate.coverArtUrl
                  ? <img src={crate.coverArtUrl} alt={crate.name} className="w-full h-full object-cover" />
                  : <Disc3 size={24} className="text-muted-foreground opacity-40" />
                }
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground truncate">{crate.name}</p>
                  {crate.isPublic
                    ? <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(52,199,89,0.1)", color: "#34C759" }}><Globe size={9} /> Public</span>
                    : <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "#888" }}><Lock size={9} /> Private</span>
                  }
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{crate._count.items} track{crate._count.items !== 1 ? "s" : ""}</p>
                {crate.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{crate.description}</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setEditingCrate(crate)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
                  title="Edit"
                >
                  <Edit3 size={14} className="text-muted-foreground" />
                </button>
                <button
                  onClick={() => handleDelete(crate.id)}
                  disabled={deletingId === crate.id}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-red-500/10 disabled:opacity-50"
                  title="Delete"
                >
                  {deletingId === crate.id
                    ? <Loader2 size={14} className="animate-spin text-red-400" />
                    : <Trash2 size={14} style={{ color: "#ef4444" }} />
                  }
                </button>
                <Link
                  href={`/dashboard/dj/crates/${crate.id}`}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-accent/10"
                >
                  <ChevronRight size={14} style={{ color: "#D4A843" }} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNewModal && (
        <CrateModal
          onClose={() => setShowNewModal(false)}
          onSave={(crate) => { setCrates(prev => [crate, ...prev]); setShowNewModal(false); }}
        />
      )}

      {editingCrate && (
        <CrateModal
          crate={editingCrate}
          onClose={() => setEditingCrate(null)}
          onSave={(updated) => {
            setCrates(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
            setEditingCrate(null);
          }}
        />
      )}
    </div>
  );
}

function CrateModal({
  crate,
  onClose,
  onSave,
}: {
  crate?: Crate;
  onClose: () => void;
  onSave: (crate: Crate) => void;
}) {
  const [name, setName] = useState(crate?.name ?? "");
  const [description, setDescription] = useState(crate?.description ?? "");
  const [isPublic, setIsPublic] = useState(crate?.isPublic ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) { setError("Crate name is required."); return; }
    setSaving(true);
    setError(null);

    try {
      const url = crate ? `/api/dashboard/dj/crates/${crate.id}` : "/api/dashboard/dj/crates";
      const method = crate ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || null, isPublic }),
      });
      const data = await res.json() as { crate?: Crate; error?: string };
      if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
      if (data.crate) onSave(data.crate);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-md rounded-2xl border p-6 space-y-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">{crate ? "Edit Crate" : "New Crate"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Crate Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Late Night Vibes"
              className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description (optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="What's the vibe?"
              className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none resize-none focus:ring-2 focus:ring-accent/50"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium text-foreground">Public crate</p>
              <p className="text-xs text-muted-foreground">Visible to anyone with the link</p>
            </div>
            <button
              type="button"
              onClick={() => setIsPublic(v => !v)}
              className="relative w-10 h-6 rounded-full transition-colors shrink-0"
              style={{ backgroundColor: isPublic ? "#D4A843" : "var(--border)" }}
            >
              <span
                className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform"
                style={{ transform: isPublic ? "translateX(16px)" : "translateX(0)" }}
              />
            </button>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border text-sm font-semibold"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {crate ? "Save Changes" : "Create Crate"}
          </button>
        </div>
      </div>
    </div>
  );
}
