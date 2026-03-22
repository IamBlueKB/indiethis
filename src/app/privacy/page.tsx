import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — IndieThis",
  description: "IndieThis Privacy Policy. Learn how we collect, use, and protect your information.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: "#fff", marginBottom: 10 }}>{title}</h2>
      <p style={{ fontSize: 14, color: "#aaa", lineHeight: 1.75 }}>{children}</p>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <div style={{ backgroundColor: "#0A0A0A", minHeight: "100vh", color: "#e5e5e5" }}>
      {/* Nav */}
      <header
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link href="/" style={{ textDecoration: "none" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/brand/indiethis-logo-dark-bg.svg" alt="IndieThis" style={{ height: 32 }} />
        </Link>
        <Link href="/" style={{ fontSize: 13, color: "#888", textDecoration: "none" }}>
          ← Back to home
        </Link>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px 80px" }}>
        <p style={{ fontSize: 12, color: "#555", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Legal
        </p>
        <h1 style={{ fontSize: 36, fontWeight: 700, color: "#fff", marginBottom: 8, lineHeight: 1.15 }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize: 13, color: "#555", marginBottom: 48 }}>
          Effective Date: March 22, 2026 &nbsp;·&nbsp; Last Updated: March 22, 2026
        </p>

        <Section title="1. Introduction">
          IndieThis LLC operates the IndieThis platform at indiethis.com. This Privacy Policy explains how we
          collect, use, share, and protect your personal information when you use our platform.
        </Section>

        <Section title="2. Information We Collect">
          <strong style={{ color: "#ccc" }}>Information you provide:</strong> Name, email address, phone number
          (optional), payment information (processed by Stripe — we do not store card numbers), profile information
          (bio, photos, social media links), uploaded content (music, images, videos), booking and contact form
          submissions.
          <br /><br />
          <strong style={{ color: "#ccc" }}>Information collected automatically:</strong> IP address (hashed for
          analytics, not stored in raw form), device type and browser information, pages visited and features used,
          timestamps of activity, approximate location (city-level, derived from IP for analytics).
          <br /><br />
          <strong style={{ color: "#ccc" }}>Information from third parties:</strong> Stripe (payment status and
          transaction records), Brevo (email delivery and engagement metrics), AI service providers (job completion
          status only — your content is not retained by AI providers after processing).
        </Section>

        <Section title="3. How We Use Your Information">
          We use your information to provide and improve the IndieThis platform, process payments and manage
          subscriptions, send transactional emails (account confirmations, file delivery notifications, booking
          confirmations), send marketing emails (platform updates, feature announcements — you can unsubscribe at
          any time), display your public profile and artist/studio page, generate analytics for your dashboard,
          facilitate communication between studios and artists, process AI tool requests, and prevent fraud and
          enforce our Terms of Service.
        </Section>

        <Section title="4. Fan and Contact Data">
          Artists and studios collect fan and contact information through their IndieThis pages (email signups,
          phone numbers, booking inquiries). This contact data belongs to the artist or studio who collected it,
          not to IndieThis. Artists and studios are responsible for their own compliance with applicable email and
          SMS marketing laws (CAN-SPAM, TCPA). IndieThis provides the tools — the artist or studio is the data
          controller for their collected contacts.
        </Section>

        <Section title="5. How We Share Your Information">
          We do not sell your personal information. We share information only in these circumstances: with Stripe
          to process payments, with Brevo to deliver emails and SMS messages, with AI service providers to process
          your tool requests (content is sent for processing and not retained by providers), with Cloudflare to
          store and deliver your uploaded files, with law enforcement when required by law, and with your consent.
        </Section>

        <Section title="6. Public Information">
          Information you make public on your artist or studio page is visible to anyone on the internet. This
          includes your display name, bio, photos, music, videos, merch listings, show dates, and any other content
          you publish on your public page. You control what is published through your dashboard settings.
        </Section>

        <Section title="7. Data Retention">
          We retain your account data for as long as your account is active. If you delete your account, we will
          delete your personal data within 30 days, except where we are required by law to retain it (e.g.,
          financial records for tax purposes). Uploaded content (music, images, videos) is deleted from our storage
          within 30 days of account deletion. Anonymized analytics data may be retained indefinitely.
        </Section>

        <Section title="8. Data Security">
          We use industry-standard security measures to protect your information, including encrypted connections
          (HTTPS), secure authentication with hashed passwords, payment processing through PCI-compliant Stripe,
          and hashed IP addresses for analytics. No system is 100% secure. We cannot guarantee absolute security
          of your data.
        </Section>

        <Section title="9. Your Rights">
          You have the right to access the personal information we hold about you, correct inaccurate information,
          delete your account and associated data, export your content (music, images, contact lists), opt out of
          marketing emails at any time, and request information about how your data is used. To exercise these
          rights, contact us at{" "}
          <a href="mailto:hello@indiethis.com" style={{ color: "#D4A843", textDecoration: "none" }}>
            hello@indiethis.com
          </a>
          .
        </Section>

        <Section title="10. Cookies">
          IndieThis uses essential cookies for authentication and session management. We use analytics to understand
          platform usage. We do not use third-party advertising cookies. We do not display ads on the platform.
        </Section>

        <Section title="11. Children's Privacy">
          IndieThis is not intended for users under 18 years of age. We do not knowingly collect information from
          children. If we learn that we have collected information from a child under 18, we will delete it promptly.
        </Section>

        <Section title="12. California Residents (CCPA)">
          If you are a California resident, you have additional rights under the California Consumer Privacy Act.
          You may request disclosure of the categories of personal information we collect and their purposes. You
          may request deletion of your personal information. You may opt out of the sale of personal information —
          we do not sell personal information. To make a CCPA request, contact us at{" "}
          <a href="mailto:hello@indiethis.com" style={{ color: "#D4A843", textDecoration: "none" }}>
            hello@indiethis.com
          </a>
          .
        </Section>

        <Section title="13. Illinois Residents (BIPA)">
          IndieThis does not collect biometric data (fingerprints, facial geometry, voiceprints, etc.). Photo
          uploads are stored as standard image files and are not processed for biometric identification.
        </Section>

        <Section title="14. International Users">
          IndieThis is operated from the United States. If you access the platform from outside the US, your
          information will be transferred to and processed in the United States. By using the platform, you consent
          to this transfer.
        </Section>

        <Section title="15. Changes to This Policy">
          We may update this Privacy Policy from time to time. We will notify active users of material changes via
          email. The updated policy will be posted on this page with a new &quot;Last Updated&quot; date.
        </Section>

        <Section title="16. Contact">
          For questions about this Privacy Policy, contact us at{" "}
          <a href="mailto:hello@indiethis.com" style={{ color: "#D4A843", textDecoration: "none" }}>
            hello@indiethis.com
          </a>
          .<br /><br />
          IndieThis LLC<br />
          Chicago, Illinois
        </Section>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.04)", padding: "20px 24px" }}>
        <div
          style={{
            maxWidth: 760,
            margin: "0 auto",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            fontSize: 12,
            color: "#444",
          }}
        >
          <span>© 2026 IndieThis LLC</span>
          <div style={{ display: "flex", gap: 20 }}>
            <Link href="/terms" style={{ color: "#444", textDecoration: "none" }}>Terms</Link>
            <Link href="/privacy" style={{ color: "#D4A843", textDecoration: "none" }}>Privacy</Link>
            <a href="mailto:hello@indiethis.com" style={{ color: "#444", textDecoration: "none" }}>
              hello@indiethis.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
