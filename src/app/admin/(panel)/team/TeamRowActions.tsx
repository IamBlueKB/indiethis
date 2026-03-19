"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  ShieldCheck,
  UserX,
  UserCheck,
  KeyRound,
  Loader2,
} from "lucide-react";

type AdminRole = "SUPER_ADMIN" | "OPS_ADMIN" | "SUPPORT_ADMIN";

interface Props {
  targetId:      string;
  targetName:    string;
  targetRole:    AdminRole;
  targetActive:  boolean;
  sessionId:     string;
  sessionRole:   AdminRole;
}

type Action = "role" | "deactivate" | "reactivate" | "reset-password";

// ─── Role-change sub-menu ──────────────────────────────────────────────────

function RoleChangeModal({
  targetName,
  currentRole,
  onConfirm,
  onClose,
}: {
  targetName:  string;
  currentRole: AdminRole;
  onConfirm:   (role: "OPS_ADMIN" | "SUPPORT_ADMIN") => void;
  onClose:     () => void;
}) {
  const other = currentRole === "OPS_ADMIN" ? "SUPPORT_ADMIN" : "OPS_ADMIN";
  const otherLabel = other === "OPS_ADMIN" ? "Ops Admin" : "Support Admin";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border shadow-2xl p-6 space-y-4"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2.5">
          <ShieldCheck size={17} style={{ color: "#E85D4A" }} />
          <h2 className="text-base font-semibold text-foreground">Change Role</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Change <strong className="text-foreground">{targetName}</strong>'s role to{" "}
          <strong className="text-foreground">{otherLabel}</strong>?
        </p>
        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(other)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#E85D4A" }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm modal (deactivate / reset) ───────────────────────────────────

function ConfirmModal({
  title,
  description,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  title:        string;
  description:  string;
  confirmLabel: string;
  danger?:      boolean;
  onConfirm:    () => void;
  onClose:      () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border shadow-2xl p-6 space-y-4"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: danger ? "#E85D4A" : "#34C759" }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export default function TeamRowActions({
  targetId,
  targetName,
  targetRole,
  targetActive,
  sessionId,
  sessionRole,
}: Props) {
  const router = useRouter();
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState<Action | null>(null);
  const [modal,   setModal]   = useState<Action | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Visibility rules ────────────────────────────────────────────────────
  // Non-super-admins see no actions
  if (sessionRole !== "SUPER_ADMIN") return null;

  // Super Admins can only act on themselves for their own account
  const isSelf         = targetId === sessionId;
  const isTargetSuper  = targetRole === "SUPER_ADMIN";

  // A super admin cannot modify other super admins
  const canModify = !isTargetSuper || isSelf;
  if (!canModify) return null;

  // What actions are available?
  const canChangeRole    = !isTargetSuper; // can't change SUPER_ADMIN role
  const canDeactivate    = targetActive && (!isTargetSuper || isSelf);
  const canReactivate    = !targetActive;
  const canResetPassword = true; // always available if canModify

  // ── Action executor ─────────────────────────────────────────────────────
  async function execute(action: Action, role?: "OPS_ADMIN" | "SUPPORT_ADMIN") {
    setLoading(action);
    setError(null);
    setModal(null);
    setOpen(false);

    try {
      let res: Response;

      if (action === "role") {
        res = await fetch(`/api/admin/team/${targetId}/role`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ role }),
        });
      } else {
        res = await fetch(`/api/admin/team/${targetId}/${action}`, { method: "POST" });
      }

      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  const busy = loading !== null;

  return (
    <>
      {/* Dropdown trigger */}
      <div ref={menuRef} className="relative">
        <button
          onClick={() => { setOpen((v) => !v); setError(null); }}
          disabled={busy}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-white/5 disabled:opacity-40"
          title="Actions"
        >
          {busy ? (
            <Loader2 size={14} className="animate-spin text-muted-foreground" />
          ) : (
            <MoreHorizontal size={16} className="text-muted-foreground" />
          )}
        </button>

        {open && (
          <div
            className="absolute right-0 top-full mt-1 z-30 w-48 rounded-xl border shadow-xl overflow-hidden"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            {canChangeRole && (
              <MenuItem
                icon={<ShieldCheck size={13} />}
                label="Edit Role"
                onClick={() => { setOpen(false); setModal("role"); }}
              />
            )}
            {canDeactivate && (
              <MenuItem
                icon={<UserX size={13} />}
                label="Deactivate"
                danger
                onClick={() => { setOpen(false); setModal("deactivate"); }}
              />
            )}
            {canReactivate && (
              <MenuItem
                icon={<UserCheck size={13} />}
                label="Reactivate"
                onClick={() => { setOpen(false); setModal("reactivate"); }}
              />
            )}
            {canResetPassword && (
              <MenuItem
                icon={<KeyRound size={13} />}
                label="Reset Password"
                onClick={() => { setOpen(false); setModal("reset-password"); }}
              />
            )}
          </div>
        )}
      </div>

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-4 right-4 z-50 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium px-4 py-2 rounded-xl shadow-lg">
          {error}
        </div>
      )}

      {/* Role change modal */}
      {modal === "role" && (
        <RoleChangeModal
          targetName={targetName}
          currentRole={targetRole}
          onConfirm={(role) => execute("role", role)}
          onClose={() => setModal(null)}
        />
      )}

      {/* Deactivate confirm */}
      {modal === "deactivate" && (
        <ConfirmModal
          title="Deactivate Account"
          description={`Deactivate ${targetName}? They will no longer be able to log in until reactivated.`}
          confirmLabel="Deactivate"
          danger
          onConfirm={() => execute("deactivate")}
          onClose={() => setModal(null)}
        />
      )}

      {/* Reactivate confirm */}
      {modal === "reactivate" && (
        <ConfirmModal
          title="Reactivate Account"
          description={`Reactivate ${targetName}? They will be able to log in again.`}
          confirmLabel="Reactivate"
          onConfirm={() => execute("reactivate")}
          onClose={() => setModal(null)}
        />
      )}

      {/* Reset password confirm */}
      {modal === "reset-password" && (
        <ConfirmModal
          title="Reset Password"
          description={`Generate a new temporary password for ${targetName} and send it via email?`}
          confirmLabel="Reset & Email"
          danger
          onConfirm={() => execute("reset-password")}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

// ─── Menu item helper ──────────────────────────────────────────────────────

function MenuItem({
  icon,
  label,
  danger,
  onClick,
}: {
  icon:    React.ReactNode;
  label:   string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-white/5 text-left"
      style={{ color: danger ? "#E85D4A" : "var(--foreground)" }}
    >
      {icon}
      {label}
    </button>
  );
}
