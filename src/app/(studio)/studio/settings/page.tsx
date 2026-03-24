"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Settings, MapPin, Phone, Mail, Clock, FileText, Check,
  Link2, Instagram, Youtube, Facebook, CreditCard,
  ChevronDown, Loader2, CheckCircle2, XCircle, DollarSign, Globe, Lock,
} from "lucide-react";
import { formatPhoneInput } from "@/lib/formatPhone";

// ─── US States ────────────────────────────────────────────────────────────────
const US_STATES = [
  ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],
  ["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["FL","Florida"],["GA","Georgia"],
  ["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],
  ["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],
  ["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],
  ["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],["NJ","New Jersey"],
  ["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],
  ["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],
  ["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],
  ["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"],
];

// ─── Hours JSON type ───────────────────────────────────────────────────────────
const DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as const;
type Day = typeof DAYS[number];
type DayHours = { open: boolean; openTime: string; closeTime: string };
type HoursJson = Record<Day, DayHours>;

const DEFAULT_HOURS: HoursJson = {
  monday:    { open: true,  openTime: "09:00", closeTime: "20:00" },
  tuesday:   { open: true,  openTime: "09:00", closeTime: "20:00" },
  wednesday: { open: true,  openTime: "09:00", closeTime: "20:00" },
  thursday:  { open: true,  openTime: "09:00", closeTime: "20:00" },
  friday:    { open: true,  openTime: "09:00", closeTime: "22:00" },
  saturday:  { open: true,  openTime: "10:00", closeTime: "22:00" },
  sunday:    { open: false, openTime: "10:00", closeTime: "18:00" },
};

function parseHours(raw: string | null): HoursJson {
  if (!raw) return DEFAULT_HOURS;
  try {
    const parsed = JSON.parse(raw);
    // Ensure all 7 days exist
    const result = { ...DEFAULT_HOURS };
    for (const day of DAYS) {
      if (parsed[day]) result[day] = { ...DEFAULT_HOURS[day], ...parsed[day] };
    }
    return result;
  } catch {
    return DEFAULT_HOURS;
  }
}

// ─── Studio type ───────────────────────────────────────────────────────────────
type Studio = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  hours: string | null;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  instagram: string | null;
  tiktok: string | null;
  youtube: string | null;
  facebook: string | null;
  cashAppHandle: string | null;
  zelleHandle: string | null;
  paypalHandle: string | null;
  venmoHandle: string | null;
  stripePaymentsEnabled: boolean;
  averageSessionRate: number;
  studioTier: "PRO" | "ELITE";
  customDomain: string | null;
};

// ─── Input style helper ────────────────────────────────────────────────────────
const inputCls = "w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50";

export default function StudioSettingsPage() {
  const [studio, setStudio] = useState<Studio | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Profile fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");

  // Address fields
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");

  // Hours
  const [hours, setHours] = useState<HoursJson>(DEFAULT_HOURS);

  // Slug
  const [slug, setSlug] = useState("");
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const slugTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originalSlugRef = useRef("");

  // Social handles
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [youtube, setYoutube] = useState("");
  const [facebook, setFacebook] = useState("");

  // Payment handles
  const [cashAppHandle, setCashAppHandle] = useState("");
  const [zelleHandle, setZelleHandle] = useState("");
  const [paypalHandle, setPaypalHandle] = useState("");
  const [venmoHandle, setVenmoHandle] = useState("");
  const [stripePaymentsEnabled, setStripePaymentsEnabled] = useState(false);
  const [averageSessionRate, setAverageSessionRate] = useState(150);
  const [studioTier, setStudioTier] = useState<"PRO" | "ELITE">("PRO");
  const [customDomain, setCustomDomain] = useState("");

  useEffect(() => {
    fetch("/api/studio/settings")
      .then((r) => r.json())
      .then((d) => {
        const s: Studio = d.studio;
        setStudio(s);
        setName(s.name ?? "");
        setPhone(s.phone ?? "");
        setEmail(s.email ?? "");
        setDescription(s.description ?? "");
        setStreetAddress(s.streetAddress ?? "");
        setCity(s.city ?? "");
        setState(s.state ?? "");
        setZipCode(s.zipCode ?? "");
        setHours(parseHours(s.hours));
        setSlug(s.slug ?? "");
        originalSlugRef.current = s.slug ?? "";
        setInstagram(s.instagram ?? "");
        setTiktok(s.tiktok ?? "");
        setYoutube(s.youtube ?? "");
        setFacebook(s.facebook ?? "");
        setCashAppHandle(s.cashAppHandle ?? "");
        setZelleHandle(s.zelleHandle ?? "");
        setPaypalHandle(s.paypalHandle ?? "");
        setVenmoHandle(s.venmoHandle ?? "");
        setStripePaymentsEnabled(s.stripePaymentsEnabled ?? false);
        setAverageSessionRate(s.averageSessionRate ?? 150);
        setStudioTier(s.studioTier ?? "PRO");
        setCustomDomain(s.customDomain ?? "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Slug debounce check
  const checkSlug = useCallback((val: string) => {
    if (!val.trim()) { setSlugAvailable(null); return; }
    if (val === originalSlugRef.current) { setSlugAvailable(true); return; }
    setSlugChecking(true);
    fetch(`/api/studio/settings/slug-check?slug=${encodeURIComponent(val.trim().toLowerCase())}`)
      .then((r) => r.json())
      .then((d) => { setSlugAvailable(d.available ?? false); setSlugChecking(false); })
      .catch(() => { setSlugAvailable(null); setSlugChecking(false); });
  }, []);

  function handleSlugChange(val: string) {
    const clean = val.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSlug(clean);
    setSlugAvailable(null);
    if (slugTimerRef.current) clearTimeout(slugTimerRef.current);
    slugTimerRef.current = setTimeout(() => checkSlug(clean), 600);
  }

  function handleHourChange(day: Day, field: keyof DayHours, value: boolean | string) {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/studio/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, phone, email, description,
          streetAddress, city, state, zipCode,
          slug,
          hours: JSON.stringify(hours),
          instagram, tiktok, youtube, facebook,
          cashAppHandle, zelleHandle, paypalHandle, venmoHandle,
          stripePaymentsEnabled,
          averageSessionRate,
          customDomain: studioTier === "ELITE" ? customDomain : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        originalSlugRef.current = data.studio?.slug ?? slug;
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        setSaveError(data.error ?? "Failed to save.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto pb-16">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Studio Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your studio profile and booking details</p>
      </div>

      {/* ── Profile ── */}
      <Section icon={<Settings size={14} className="text-accent" />} title="Profile">
        <Field icon={<Settings size={13} />} label="Studio Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your studio name"
            className={inputCls}
            style={{ borderColor: "var(--border)" }}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field icon={<Phone size={13} />} label="Phone">
            <input
              value={phone}
              onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
              placeholder="(555) 123-4567"
              inputMode="tel"
              className={inputCls}
              style={{ borderColor: "var(--border)" }}
            />
          </Field>
          <Field icon={<Mail size={13} />} label="Email">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="studio@example.com"
              type="email"
              className={inputCls}
              style={{ borderColor: "var(--border)" }}
            />
          </Field>
        </div>

        <Field icon={<FileText size={13} />} label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Tell artists about your studio…"
            className={`${inputCls} resize-none`}
            style={{ borderColor: "var(--border)" }}
          />
        </Field>
      </Section>

      {/* ── Address ── */}
      <Section icon={<MapPin size={14} className="text-accent" />} title="Address">
        <Field icon={<MapPin size={13} />} label="Street Address">
          <input
            value={streetAddress}
            onChange={(e) => setStreetAddress(e.target.value)}
            placeholder="123 Studio Drive"
            className={inputCls}
            style={{ borderColor: "var(--border)" }}
          />
        </Field>

        <div className="flex gap-3">
          <div className="flex-1">
            <Field icon={null} label="City">
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Atlanta"
                className={inputCls}
                style={{ borderColor: "var(--border)" }}
              />
            </Field>
          </div>
          <div className="w-28">
            <Field icon={null} label="State">
              <div className="relative">
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className={`${inputCls} appearance-none pr-7`}
                  style={{ borderColor: "var(--border)" }}
                >
                  <option value="">—</option>
                  {US_STATES.map(([code, fullName]) => (
                    <option key={code} value={code}>{code} — {fullName}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </Field>
          </div>
          <div className="w-24">
            <Field icon={null} label="Zip">
              <input
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                placeholder="30301"
                inputMode="numeric"
                className={inputCls}
                style={{ borderColor: "var(--border)" }}
              />
            </Field>
          </div>
        </div>
      </Section>

      {/* ── Booking URL ── */}
      <Section icon={<Link2 size={14} className="text-accent" />} title="Booking URL">
        <p className="text-xs text-muted-foreground">Clients use this link to fill out your intake form.</p>
        <Field icon={<Link2 size={13} />} label="Slug">
          <div className="flex items-center gap-0">
            <span
              className="flex-shrink-0 rounded-l-xl border border-r-0 px-3 py-2.5 text-sm text-muted-foreground"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
            >
              indiethis.com/
            </span>
            <div className="relative flex-1">
              <input
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="your-studio"
                className="w-full rounded-r-xl border px-3 py-2.5 pr-8 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                style={{ borderColor: "var(--border)" }}
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                {slugChecking && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
                {!slugChecking && slugAvailable === true && <CheckCircle2 size={14} className="text-green-500" />}
                {!slugChecking && slugAvailable === false && <XCircle size={14} className="text-destructive" />}
              </div>
            </div>
          </div>
          {!slugChecking && slugAvailable === false && (
            <p className="text-xs text-destructive mt-1">That URL is already taken.</p>
          )}
          {!slugChecking && slugAvailable === true && slug !== originalSlugRef.current && (
            <p className="text-xs text-green-600 mt-1">Available!</p>
          )}
        </Field>
        <p className="text-xs text-muted-foreground">
          Full intake URL:{" "}
          <span className="text-foreground font-medium">indiethis.com/{slug}/intake</span>
        </p>
      </Section>

      {/* ── Hours ── */}
      <Section icon={<Clock size={14} className="text-accent" />} title="Hours">
        <div className="space-y-2">
          {DAYS.map((day) => {
            const { open, openTime, closeTime } = hours[day];
            return (
              <div key={day} className="flex items-center gap-3">
                {/* Day label */}
                <span className="w-24 text-xs font-medium capitalize text-muted-foreground">{day}</span>

                {/* Open/Closed toggle */}
                <button
                  type="button"
                  onClick={() => handleHourChange(day, "open", !open)}
                  className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${open ? "" : "bg-muted"}`}
                  style={{ backgroundColor: open ? "#D4A843" : undefined }}
                  aria-pressed={open}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${open ? "translate-x-6" : "translate-x-0"}`}
                  />
                </button>

                {/* Time pickers */}
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="time"
                    value={openTime}
                    onChange={(e) => handleHourChange(day, "openTime", e.target.value)}
                    disabled={!open}
                    className="rounded-lg border px-2 py-1 text-xs bg-transparent text-foreground outline-none focus:ring-1 focus:ring-accent/50 disabled:opacity-30"
                    style={{ borderColor: "var(--border)" }}
                  />
                  <span className="text-xs text-muted-foreground">–</span>
                  <input
                    type="time"
                    value={closeTime}
                    onChange={(e) => handleHourChange(day, "closeTime", e.target.value)}
                    disabled={!open}
                    className="rounded-lg border px-2 py-1 text-xs bg-transparent text-foreground outline-none focus:ring-1 focus:ring-accent/50 disabled:opacity-30"
                    style={{ borderColor: "var(--border)" }}
                  />
                  {!open && <span className="text-xs text-muted-foreground italic">Closed</span>}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── Social Handles ── */}
      <Section icon={<Instagram size={14} className="text-accent" />} title="Social Media">
        <div className="grid grid-cols-2 gap-4">
          <Field icon={<Instagram size={13} />} label="Instagram">
            <input
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="@yourstudio"
              className={inputCls}
              style={{ borderColor: "var(--border)" }}
            />
          </Field>
          <Field icon={<span className="text-[11px] font-bold">TT</span>} label="TikTok">
            <input
              value={tiktok}
              onChange={(e) => setTiktok(e.target.value)}
              placeholder="@yourstudio"
              className={inputCls}
              style={{ borderColor: "var(--border)" }}
            />
          </Field>
          <Field icon={<Youtube size={13} />} label="YouTube">
            <input
              value={youtube}
              onChange={(e) => setYoutube(e.target.value)}
              placeholder="YourStudioChannel"
              className={inputCls}
              style={{ borderColor: "var(--border)" }}
            />
          </Field>
          <Field icon={<Facebook size={13} />} label="Facebook">
            <input
              value={facebook}
              onChange={(e) => setFacebook(e.target.value)}
              placeholder="YourStudioPage"
              className={inputCls}
              style={{ borderColor: "var(--border)" }}
            />
          </Field>
        </div>
      </Section>

      {/* ── Payment Handles ── */}
      <Section icon={<DollarSign size={14} className="text-accent" />} title="Payment Handles">
        <p className="text-xs text-muted-foreground">These are shown to clients on your intake form so they can pay deposits.</p>
        <div className="grid grid-cols-2 gap-4">
          <Field icon={<DollarSign size={13} />} label="CashApp">
            <input
              value={cashAppHandle}
              onChange={(e) => setCashAppHandle(e.target.value)}
              placeholder="$YourCashtag"
              className={inputCls}
              style={{ borderColor: "var(--border)" }}
            />
          </Field>
          <Field icon={<CreditCard size={13} />} label="Zelle">
            <input
              value={zelleHandle}
              onChange={(e) => setZelleHandle(e.target.value)}
              placeholder="(555) 123-4567 or email"
              className={inputCls}
              style={{ borderColor: "var(--border)" }}
            />
          </Field>
          <Field icon={<CreditCard size={13} />} label="PayPal">
            <input
              value={paypalHandle}
              onChange={(e) => setPaypalHandle(e.target.value)}
              placeholder="@yourpaypal"
              className={inputCls}
              style={{ borderColor: "var(--border)" }}
            />
          </Field>
          <Field icon={<CreditCard size={13} />} label="Venmo">
            <input
              value={venmoHandle}
              onChange={(e) => setVenmoHandle(e.target.value)}
              placeholder="@yourvenmo"
              className={inputCls}
              style={{ borderColor: "var(--border)" }}
            />
          </Field>
        </div>

        {/* Stripe Payments toggle */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <p className="text-sm font-medium text-foreground">Stripe Payments</p>
            <p className="text-xs text-muted-foreground">Accept card payments directly through IndieThis</p>
          </div>
          <button
            type="button"
            onClick={() => setStripePaymentsEnabled((v) => !v)}
            className={`w-12 h-6 rounded-full transition-colors flex-shrink-0`}
            style={{ backgroundColor: stripePaymentsEnabled ? "#D4A843" : "var(--muted)" }}
            aria-pressed={stripePaymentsEnabled}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${stripePaymentsEnabled ? "translate-x-6" : "translate-x-0"}`}
            />
          </button>
        </div>
      </Section>

      {/* ── Lead ROI ── */}
      <Section icon={<DollarSign size={14} className="text-accent" />} title="Lead Tracking">
        <Field icon={<DollarSign size={13} />} label="Average Session Rate ($)">
          <input
            value={averageSessionRate}
            onChange={(e) => setAverageSessionRate(Number(e.target.value) || 0)}
            type="number"
            min={0}
            placeholder="150"
            className={inputCls}
            style={{ borderColor: "var(--border)" }}
          />
        </Field>
        <p className="text-xs text-muted-foreground -mt-2">
          What&apos;s your average session rate? This helps us show you the estimated value of leads from IndieThis.
        </p>
      </Section>

      {/* ── Custom Domain ── */}
      <Section icon={<Globe size={15} className="text-muted-foreground" />} title="Custom Domain">
        <p className="text-xs text-muted-foreground -mt-2">Point your own domain to your studio booking page.</p>
        {studioTier === "PRO" ? (
          <div className="flex items-center gap-2 rounded-xl border px-3 py-2.5 opacity-60" style={{ borderColor: "var(--border)" }}>
            <Lock size={12} className="text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground flex-1">yourstudio.com</span>
            <a href="/dashboard/upgrade" className="text-[11px] font-semibold shrink-0" style={{ color: "#D4A843" }}>Elite only — $99/mo →</a>
          </div>
        ) : (
          <Field icon={<Globe size={13} />} label="Custom Domain">
            <input
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="yourstudio.com"
              className={inputCls}
              style={{ borderColor: "var(--border)" }}
            />
          </Field>
        )}
      </Section>

      {/* ── Save ── */}
      {saveError && (
        <p className="text-sm text-destructive">{saveError}</p>
      )}
      <button
        onClick={handleSave}
        disabled={saving || !name.trim() || slugAvailable === false}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-opacity"
        style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
      >
        {saved ? (
          <><Check size={14} /> Saved</>
        ) : saving ? (
          <><Loader2 size={14} className="animate-spin" /> Saving…</>
        ) : (
          "Save Changes"
        )}
      </button>
    </div>
  );
}

// ─── Section wrapper ───────────────────────────────────────────────────────────
function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border p-6 space-y-5"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: "var(--border)" }}>
        {icon}
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ─── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </label>
      {children}
    </div>
  );
}
