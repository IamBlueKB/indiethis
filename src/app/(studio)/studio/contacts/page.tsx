"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, UserCircle2, Mail, Phone, DollarSign } from "lucide-react";
import { formatPhoneInput } from "@/lib/formatPhone";

type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  genre: string | null;
  source: string;
  totalSpent: number;
  lastSessionDate: string | null;
  createdAt: string;
};

const SOURCE_LABEL: Record<string, string> = {
  MANUAL: "Manual",
  INTAKE_FORM: "Intake Form",
  BOOKING: "Booking",
  REFERRAL: "Referral",
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  // Add form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [genre, setGenre] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const q = search ? `?search=${encodeURIComponent(search)}` : "";
    fetch(`/api/studio/contacts${q}`)
      .then((r) => r.json())
      .then((d) => {
        setContacts(d.contacts ?? []);
        setLoading(false);
      });
  }, [search]);

  async function handleAdd() {
    if (!name.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/studio/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, genre }),
      });
      if (res.ok) {
        const data = await res.json();
        setContacts((prev) => [data.contact, ...prev]);
        setShowAdd(false);
        setName(""); setEmail(""); setPhone(""); setGenre("");
      }
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your studio CRM</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          <Plus size={15} />
          {showAdd ? "Cancel" : "Add Contact"}
        </button>
      </div>

      {/* Add contact form */}
      {showAdd && (
        <div
          className="rounded-2xl border p-5 space-y-4"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <h2 className="text-sm font-semibold text-foreground">New Contact</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Name *", value: name, set: setName, placeholder: "Full name" },
              { label: "Email", value: email, set: setEmail, placeholder: "email@example.com" },
              { label: "Phone", value: phone, set: setPhone, placeholder: "(555) 000-0000" },
              { label: "Genre", value: genre, set: setGenre, placeholder: "e.g. Hip-Hop, R&B" },
            ].map(({ label, value, set, placeholder }) => (
              <div key={label} className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {label}
                </label>
                <input
                  value={value}
                  onChange={(e) => set(label === "Phone" ? formatPhoneInput(e.target.value) : e.target.value)}
                  placeholder={placeholder}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleAdd}
            disabled={adding || !name.trim()}
            className="px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            {adding ? "Adding…" : "Add Contact"}
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or phone…"
          className="w-full rounded-xl border pl-9 pr-4 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        />
      </div>

      {/* Contacts table */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div
          className="grid grid-cols-[1fr_180px_120px_100px_80px] gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <span>Contact</span>
          <span>Contact Info</span>
          <span>Genre</span>
          <span className="text-right">Spent</span>
          <span>Source</span>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : contacts.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <UserCircle2 size={32} className="mx-auto text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">
              {search ? "No contacts match your search." : "No contacts yet. Add your first one above."}
            </p>
          </div>
        ) : (
          contacts.map((c) => (
            <Link
              key={c.id}
              href={`/studio/contacts/${c.id}`}
              className="grid grid-cols-[1fr_180px_120px_100px_80px] gap-4 px-5 py-4 items-center border-b last:border-b-0 hover:bg-white/3 transition-colors no-underline"
              style={{ borderColor: "var(--border)" }}
            >
              <div>
                <p className="text-sm font-semibold text-foreground">{c.name}</p>
                {c.lastSessionDate && (
                  <p className="text-xs text-muted-foreground">
                    Last session{" "}
                    {new Date(c.lastSessionDate).toLocaleDateString("en-US", {
                      month: "short", day: "numeric",
                    })}
                  </p>
                )}
              </div>
              <div className="space-y-0.5">
                {c.email && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail size={11} />
                    <span className="truncate">{c.email}</span>
                  </div>
                )}
                {c.phone && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone size={11} />
                    <span>{c.phone}</span>
                  </div>
                )}
              </div>
              <span className="text-sm text-muted-foreground">{c.genre ?? "—"}</span>
              <div className="flex items-center gap-1 text-sm font-semibold text-emerald-400 justify-end">
                <DollarSign size={12} />
                {c.totalSpent.toFixed(2)}
              </div>
              <span className="text-xs text-muted-foreground">
                {SOURCE_LABEL[c.source] ?? c.source}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
