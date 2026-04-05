import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — IndieThis",
  description: "IndieThis Privacy Policy. Learn how we collect, use, and protect your information.",
};

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <div id={id} style={{ marginBottom: 36, scrollMarginTop: 80 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: "#fff", marginBottom: 10 }}>{title}</h2>
      <div style={{ fontSize: 14, color: "#aaa", lineHeight: 1.75 }}>{children}</div>
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
          Last Updated: April 2026
        </p>

        <Section title="1. Information We Collect">
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: "#ccc" }}>Account Information:</strong> Name, email address, password (hashed), profile photo, artist/stage name, genre, city/location, bio, social media links, phone number (for studios). If you sign up via Google or Facebook, we receive your name, email, and profile photo from those services.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: "#ccc" }}>Payment Information:</strong> Billing details are processed by Stripe. We do not store credit card numbers, bank account details, or payment credentials on our servers. Stripe Connect account information is stored for users who set up payouts (DJs, producers, affiliates).
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: "#ccc" }}>Content You Upload:</strong> Music files, cover art, videos, canvas videos, merch designs, sample packs, session files, documents, and any other files you upload to the Platform.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: "#ccc" }}>Audio Data:</strong> When you upload audio, we automatically analyze it to extract acoustic fingerprints, BPM, musical key, and audio features (energy, danceability, valence, acousticness, instrumentalness, speechiness, liveness, loudness). This data is used for platform features and stored alongside your content.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: "#ccc" }}>Usage Data:</strong> Pages visited, features used, tracks played, searches performed, buttons clicked, AI tools used, time spent on pages, device type, browser type, IP address, referring URLs.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: "#ccc" }}>Communication Data:</strong> Email campaigns sent, SMS broadcasts sent, fan contacts, booking inquiries, intake form submissions, invoice communications.
          </p>
          <p>
            <strong style={{ color: "#ccc" }}>Transaction Data:</strong> Purchases, sales, subscriptions, PPU charges, merch orders, beat licenses, fan funding transactions, DJ earnings, affiliate commissions, withdrawal history.
          </p>
        </Section>

        <Section title="2. How We Use Your Information">
          We use your information to: operate and maintain your account; process payments and payouts; provide AI-powered tools and services; display your public profile and content; send transactional emails (receipts, confirmations, notifications); send marketing emails you opted into; run platform agents that provide recommendations and alerts; calculate quality scores and rankings for the explore page; match artists with producers, collaborators, and opportunities; detect and prevent fraud, abuse, and terms violations; analyze platform usage to improve features; generate anonymized aggregate analytics.
        </Section>

        <Section title="3. Information We Share">
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: "#ccc" }}>Public Information:</strong> Your artist name, bio, genre, city, social links, profile photo, track titles, cover art, and merch listings are publicly visible on your profile page. Play counts and &quot;Picked by DJs&quot; badges are publicly visible.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: "#ccc" }}>With Service Providers:</strong> We share data with third-party services that help operate the Platform: Stripe (payment processing), Brevo (email and SMS), Printful (merch fulfillment), Uploadthing and AWS S3 (file storage), Supabase (database), Vercel (hosting), ACRCloud (audio fingerprinting), AudD (content recognition), Anthropic Claude (AI text generation), fal.ai (AI image and video generation), Replicate (vocal removal, transcription), Auphonic (audio mastering), PostHog (analytics and error tracking).
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: "#ccc" }}>With Buyers:</strong> When someone purchases your music, merch, or beats, they receive your artist name, track/product information, and download access. For self-fulfilled merch orders, buyers receive shipping updates from you.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: "#ccc" }}>With Studios:</strong> When you submit an intake form or booking request, the studio receives the information you provided in the form.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: "#ccc" }}>With DJs:</strong> DJs can see tracks in their crates and public track information. DJs do not see which artists have opted into DJ discovery attribution or the attribution percentage.
          </p>
          <p>
            <strong style={{ color: "#ccc" }}>We Do Not Sell Your Data.</strong> We do not sell, rent, or trade your personal information to third parties for their marketing purposes.
          </p>
        </Section>

        <Section title="4. Data Storage and Security">
          Your data is stored on servers operated by Supabase (PostgreSQL database) and AWS (file storage) in the United States. We use encryption in transit (HTTPS/TLS) and follow security best practices. Passwords are hashed using bcrypt and never stored in plain text. OAuth users (Google, Facebook) do not have passwords stored. While we take reasonable measures to protect your data, no method of electronic storage is 100% secure.
        </Section>

        <Section title="5. Your Rights and Choices">
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: "#ccc" }}>Access and Download:</strong> You can access your account data through your dashboard at any time. You can download your uploaded content at any time.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: "#ccc" }}>Update:</strong> You can update your profile information, bio, social links, and settings through your dashboard.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: "#ccc" }}>Delete:</strong> You can request account deletion by contacting us at{" "}
            <a href="mailto:blue@clearearstudios.com" style={{ color: "#D4A843", textDecoration: "none" }}>
              blue@clearearstudios.com
            </a>
            . Upon deletion, your public page will be taken offline, your content will be removed within 30 days, and your personal data will be purged from our systems except where retention is required by law or for completed transactions.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: "#ccc" }}>Email Opt-Out:</strong> You can unsubscribe from marketing emails using the unsubscribe link in any email. Transactional emails (receipts, security alerts, payment notifications) cannot be opted out of while you have an active account.
          </p>
          <p>
            <strong style={{ color: "#ccc" }}>SMS Opt-Out:</strong> Reply STOP to any SMS message to unsubscribe from SMS communications.
          </p>
        </Section>

        <Section title="6. Cookies and Tracking" id="cookies">
          We use cookies and similar technologies for: session management (keeping you logged in), DJ attribution tracking (30-day attribution cookies), analytics (PostHog), preference storage (popup dismissals, settings). We do not use third-party advertising cookies. We do not display ads on the Platform.
        </Section>

        <Section title="7. Children's Privacy">
          IndieThis is not intended for users under 18 years of age. We do not knowingly collect personal information from children. If we learn that we have collected data from a user under 18, we will delete that information promptly.
        </Section>

        <Section title="8. California Residents (CCPA)">
          If you are a California resident, you have the right to: know what personal information we collect and how it is used; request deletion of your personal information; opt out of the sale of personal information (we do not sell your data); not be discriminated against for exercising your privacy rights. To exercise these rights, contact us at{" "}
          <a href="mailto:blue@clearearstudios.com" style={{ color: "#D4A843", textDecoration: "none" }}>
            blue@clearearstudios.com
          </a>
          .
        </Section>

        <Section title="9. International Users">
          IndieThis is operated in the United States. If you access the Platform from outside the US, your data will be transferred to and processed in the United States. By using the Platform, you consent to this transfer.
        </Section>

        <Section title="10. Data Retention">
          We retain your account data for as long as your account is active. After account deletion, personal data is purged within 30 days except: transaction records (retained for 7 years for tax and legal compliance), anonymized analytics data (retained indefinitely), content involved in completed purchases (retained for buyer access).
        </Section>

        <Section title="11. Third-Party Links">
          The Platform may contain links to external websites (Spotify, Apple Music, Instagram, TikTok, YouTube, etc.). We are not responsible for the privacy practices of external sites. Review their privacy policies before sharing information with them.
        </Section>

        <Section title="12. Facebook Data">
          If you sign up or log in with Facebook, we receive your name, email, and profile photo. We use this only for account creation and profile display. You can request deletion of your Facebook-connected data at any time. We provide a data deletion callback endpoint as required by Meta&apos;s platform policies.
        </Section>

        <Section title="13. Changes to This Policy">
          We may update this Privacy Policy at any time. Material changes will be communicated via email and in-app notification. The &quot;Last Updated&quot; date at the top reflects the most recent revision.
        </Section>

        <Section title="14. Contact">
          For privacy questions or data requests, contact us at{" "}
          <a href="mailto:blue@clearearstudios.com" style={{ color: "#D4A843", textDecoration: "none" }}>
            blue@clearearstudios.com
          </a>
          .<br /><br />
          Clear Ear Studios LLC<br />
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
          <span>© 2026 Clear Ear Studios LLC</span>
          <div style={{ display: "flex", gap: 20 }}>
            <Link href="/terms" style={{ color: "#444", textDecoration: "none" }}>Terms</Link>
            <Link href="/privacy" style={{ color: "#D4A843", textDecoration: "none" }}>Privacy</Link>
            <a href="mailto:blue@clearearstudios.com" style={{ color: "#444", textDecoration: "none" }}>
              blue@clearearstudios.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
