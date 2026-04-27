/**
 * LinkStemsMenu — top-bar dropdown for managing linked stem groups.
 *
 * Linked groups: dragging the fader on any member applies the same dB
 * delta to every other member, preserving the relative balance the
 * artist set between them. A role can belong to at most one group.
 *
 * UX:
 *   - "Link Stems" button in the top bar; click opens a panel.
 *   - Lists current groups with members + a Delete X.
 *   - "New group" form: type a name, then check the roles to include.
 *     Save button is disabled until ≥ 2 roles are selected.
 *   - Click-outside closes the panel.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { Link2, Plus, X } from "lucide-react";
import { labelForRole, colorForRole } from "./stem-colors";
import type { StemRole } from "./types";

interface LinkStemsMenuProps {
  roles:   StemRole[];
  groups:  Record<string, StemRole[]>;
  onCreate: (name: string, members: StemRole[]) => void;
  onDelete: (name: string) => void;
}

export function LinkStemsMenu({ roles, groups, onCreate, onDelete }: LinkStemsMenuProps) {
  const [open, setOpen]               = useState(false);
  const [creating, setCreating]       = useState(false);
  const [newName, setNewName]         = useState("");
  const [newMembers, setNewMembers]   = useState<Set<StemRole>>(new Set());
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Click-outside.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function reset() {
    setCreating(false);
    setNewName("");
    setNewMembers(new Set());
  }

  function toggleMember(role: StemRole) {
    setNewMembers((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else                next.add(role);
      return next;
    });
  }

  function commit() {
    const name = newName.trim();
    if (!name || newMembers.size < 2) return;
    onCreate(name, Array.from(newMembers));
    reset();
  }

  // Roles already linked elsewhere are disabled when picking new members
  // (a role belongs to at most one group at a time).
  const linkedRoles = new Set<StemRole>();
  for (const members of Object.values(groups)) {
    for (const m of members) linkedRoles.add(m);
  }

  const groupNames = Object.keys(groups);
  const canCommit  = newName.trim().length > 0 && newMembers.size >= 2;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Link stems"
        title="Group stems so faders move together"
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors"
        style={{
          backgroundColor: open ? "#1A1612" : "transparent",
          color:           groupNames.length > 0 ? "#D4A843" : "#888",
          border:          "1px solid #2A2824",
        }}
      >
        <Link2 size={11} />
        Link
        {groupNames.length > 0 && (
          <span
            className="ml-0.5 inline-flex items-center justify-center text-[9px] rounded-full"
            style={{
              backgroundColor: "#D4A843",
              color:           "#0A0A0A",
              minWidth:         14,
              height:           14,
              padding:          "0 4px",
            }}
          >
            {groupNames.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-30 rounded-lg shadow-xl"
          style={{
            backgroundColor: "#1A1612",
            border:          "1px solid #2A2824",
            minWidth:        280,
            maxWidth:        360,
          }}
        >
          <div className="px-3 py-2 border-b" style={{ borderColor: "#2A2824" }}>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#888" }}>
              Linked stem groups
            </span>
          </div>

          {/* Existing groups */}
          {groupNames.length === 0 && !creating && (
            <div className="px-3 py-3 text-[11px]" style={{ color: "#666" }}>
              No groups yet. Create one to move stems together.
            </div>
          )}

          {groupNames.map((name) => (
            <div
              key={name}
              className="flex items-start gap-2 px-3 py-2 border-b"
              style={{ borderColor: "#2A2824" }}
            >
              <div className="flex-1">
                <div className="text-[12px] font-semibold" style={{ color: "#E8C97A" }}>
                  {name}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {groups[name].map((r) => (
                    <span
                      key={r}
                      className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: "#0E0C0A",
                        color:           colorForRole(r),
                        border:          `1px solid ${colorForRole(r)}55`,
                      }}
                    >
                      {labelForRole(r)}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDelete(name)}
                aria-label={`Delete group ${name}`}
                className="p-1 rounded transition-colors"
                style={{ color: "#666" }}
              >
                <X size={12} />
              </button>
            </div>
          ))}

          {/* New group form */}
          {creating ? (
            <div className="p-3 flex flex-col gap-2">
              <input
                type="text"
                placeholder="Group name (e.g. Drums)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-2 py-1.5 text-[12px] rounded outline-none"
                style={{
                  backgroundColor: "#0E0C0A",
                  border:          "1px solid #2A2824",
                  color:           "#E8C97A",
                }}
                autoFocus
              />
              <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                {roles.map((role) => {
                  const disabled = linkedRoles.has(role) && !newMembers.has(role);
                  const checked  = newMembers.has(role);
                  return (
                    <label
                      key={role}
                      className="flex items-center gap-2 px-1 py-1 rounded cursor-pointer text-[11px]"
                      style={{
                        opacity: disabled ? 0.35 : 1,
                        cursor:  disabled ? "not-allowed" : "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleMember(role)}
                      />
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: colorForRole(role) }}
                      />
                      <span style={{ color: "#E8C97A" }}>{labelForRole(role)}</span>
                      {disabled && (
                        <span className="text-[9px] ml-auto" style={{ color: "#666" }}>
                          already linked
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={commit}
                  disabled={!canCommit}
                  className="flex-1 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded transition-colors"
                  style={{
                    backgroundColor: canCommit ? "#D4A843" : "#2A2824",
                    color:           canCommit ? "#0A0A0A" : "#666",
                    cursor:          canCommit ? "pointer" : "default",
                  }}
                >
                  Save group
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="text-[10px] uppercase tracking-wider px-3 py-1.5 rounded"
                  style={{ color: "#888", border: "1px solid #2A2824" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="w-full flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-semibold transition-colors"
              style={{ color: "#D4A843" }}
            >
              <Plus size={12} />
              New group
            </button>
          )}
        </div>
      )}
    </div>
  );
}
