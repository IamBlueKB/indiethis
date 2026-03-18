"use client";

import { useState } from "react";
import Link from "next/link";
import { Instagram, Twitter, Youtube, Facebook } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const footerLinks = {
  Platform: [
    { label: "Features",         href: "#features" },
    { label: "Pricing",          href: "#pricing" },
    { label: "For Studios",      href: "#studios" },
    { label: "Artist Pages",     href: "#" },
    { label: "Beat Marketplace", href: "#" },
  ],
  Artists: [
    { label: "Sign Up",          href: "/signup" },
    { label: "AI Music Videos",  href: "#" },
    { label: "AI Cover Art",     href: "#" },
    { label: "AI Mastering",     href: "#" },
    { label: "Merch Store",      href: "#" },
  ],
  Studios: [
    { label: "Onboard Your Studio", href: "/studios" },
    { label: "Clear Ear Studios",   href: "/clearearstudios" },
    { label: "Studio Features",     href: "#" },
    { label: "Contact Us",          href: "#" },
  ],
  Legal: [
    { label: "Terms of Service",  href: "#" },
    { label: "Privacy Policy",    href: "#" },
    { label: "Cookie Policy",     href: "#" },
    { label: "Artist Agreement",  href: "#" },
  ],
};

const socials = [
  { icon: Instagram, label: "Instagram", href: "#" },
  { icon: Twitter,   label: "Twitter",   href: "#" },
  { icon: Youtube,   label: "YouTube",   href: "#" },
  { icon: Facebook,  label: "Facebook",  href: "#" },
];

export default function Footer() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) { setSubmitted(true); setEmail(""); }
  };

  return (
    <footer
      className="border-t border-border-subtle pt-16 pb-8 px-6"
      style={{ backgroundColor: "#050507" }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-16">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5 no-underline mb-4">
              <img src="/images/brand/indiethis-logo-dark-bg.svg" alt="IndieThis" style={{ height: "28px", width: "auto" }} />
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[320px] mb-6">
              The platform built for independent music artists and recording studios.
              AI tools, merch, bookings, and sales — all in one place.
            </p>
            <div className="flex gap-2">
              {socials.map(({ icon: Icon, label, href }) => (
                <a key={label} href={href} aria-label={label}
                  className={cn(buttonVariants({ variant: "outline", size: "icon" }),
                    "rounded-lg text-muted-foreground hover:text-accent hover:border-accent/40 transition-colors")}>
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-display font-bold text-lg text-foreground tracking-tight mb-2">Stay in the loop</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              Platform updates, AI tool launches, and tips for independent artists. No spam. Unsubscribe anytime.
            </p>
            {submitted ? (
              <div className="rounded-xl border border-success/30 bg-success/10 px-5 py-3.5 text-sm font-medium text-success">
                You&apos;re in! We&apos;ll be in touch.
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex gap-2">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com" required
                  className="rounded-full bg-card border-border h-10 flex-1" />
                <Button type="submit"
                  className="rounded-full h-10 px-5 font-semibold bg-accent text-accent-foreground hover:bg-accent/90 shrink-0">
                  Subscribe
                </Button>
              </form>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-12 pb-12 border-b border-border-subtle">
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.1em] mb-4">{category}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-muted-foreground hover:text-foreground no-underline transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-text-muted">© {new Date().getFullYear()} IndieThis LLC. All rights reserved.</p>
          <div className="flex gap-6">
            {["Terms", "Privacy", "Cookies"].map((label) => (
              <Link key={label} href="#"
                className="text-xs text-text-muted hover:text-muted-foreground no-underline transition-colors">
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
