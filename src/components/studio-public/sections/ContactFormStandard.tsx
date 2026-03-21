"use client";

import { useState } from "react";
import { Mail, Phone, CheckCircle, AlertCircle } from "lucide-react";
import type { SectionSharedProps } from "../ConfigRenderer";

export function ContactFormStandard({ content, studio, socials }: SectionSharedProps) {
  const { headline = "Get in Touch", eyebrow = "Contact" } = content;
  const A = "var(--studio-accent)";
  const slug = studio.slug;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass = "w-full rounded-xl px-4 py-3 text-sm font-medium outline-none transition-colors bg-[#111] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(255,255,255,0.25)] text-white placeholder-[rgba(255,255,255,0.25)]";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/studio/${studio.id}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim() || undefined, message: message.trim(), website: honeypot }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to send message.");
      }
      setSuccess(true);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="contact" className="py-24 px-6" style={{ backgroundColor: "#0d0d0d" }}>
      <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-16 items-start">
        <div>
          {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3" style={{ color: A }}>{eyebrow}</p>}
          <h2 className="font-bold mb-6" style={{ fontSize: "clamp(2rem,4vw,3rem)" }}>{headline}</h2>
          <p className="text-base leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.55)" }}>
            Ready to book studio time? Send us a message and we&apos;ll get back to you within a few hours.
          </p>
          <div className="space-y-4">
            {studio.phone && (
              <a href={`tel:${studio.phone}`} className="flex items-center gap-4 no-underline group">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${A}18` }}>
                  <Phone size={16} style={{ color: A }} />
                </div>
                <span className="text-base group-hover:opacity-70 transition-opacity">{studio.phone}</span>
              </a>
            )}
            {studio.email && (
              <a href={`mailto:${studio.email}`} className="flex items-center gap-4 no-underline group">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${A}18` }}>
                  <Mail size={16} style={{ color: A }} />
                </div>
                <span className="text-base group-hover:opacity-70 transition-opacity">{studio.email}</span>
              </a>
            )}
          </div>
          {socials.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-8">
              {socials.map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg text-xs font-semibold border no-underline transition-colors hover:opacity-80"
                  style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}
                >
                  {label}
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl p-8 border" style={{ backgroundColor: "#111", borderColor: "rgba(255,255,255,0.08)" }}>
          {success ? (
            <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
              <CheckCircle size={40} style={{ color: A }} />
              <p className="font-bold text-lg">Message Sent!</p>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>We&apos;ll get back to you soon.</p>
              <a
                href={`/${slug}/intake`}
                className="mt-4 px-6 py-3 rounded-xl font-bold text-sm no-underline hover:opacity-90 transition-opacity"
                style={{ backgroundColor: A, color: "#0A0A0A" }}
              >
                Book a Session →
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div style={{ position: "absolute", left: "-9999px", opacity: 0, height: 0, overflow: "hidden" }} aria-hidden>
                <input type="text" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>Name *</label>
                <input type="text" className={inputClass} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required disabled={submitting} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>Email *</label>
                <input type="email" className={inputClass} placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={submitting} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Phone <span style={{ color: "rgba(255,255,255,0.25)" }}>(optional)</span>
                </label>
                <input type="tel" className={inputClass} placeholder="(555) 123-4567" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={submitting} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>Message *</label>
                <textarea className={`${inputClass} resize-none`} rows={4} placeholder="Tell us about your project..." value={message} onChange={(e) => setMessage(e.target.value)} required disabled={submitting} />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-sm" style={{ color: "#f87171" }}>
                  <AlertCircle size={14} /><span>{error}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={submitting || !name.trim() || !email.trim() || !message.trim()}
                className="w-full py-4 rounded-xl font-bold text-sm transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: A, color: "#0A0A0A" }}
              >
                {submitting ? "Sending…" : "Send Message"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
