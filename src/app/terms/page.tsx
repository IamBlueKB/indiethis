import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — IndieThis",
  description: "IndieThis Terms of Service. Read our terms before using the platform.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: "#fff", marginBottom: 10 }}>{title}</h2>
      <p style={{ fontSize: 14, color: "#aaa", lineHeight: 1.75 }}>{children}</p>
    </div>
  );
}

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p style={{ fontSize: 13, color: "#555", marginBottom: 48 }}>
          Effective Date: March 22, 2026 &nbsp;·&nbsp; Last Updated: March 22, 2026
        </p>

        <Section title="1. Agreement to Terms">
          By accessing or using IndieThis (indiethis.com), operated by IndieThis LLC, you agree to be bound by
          these Terms of Service. If you do not agree, do not use the platform.
        </Section>

        <Section title="2. Eligibility">
          You must be at least 18 years old to create an account. By using IndieThis, you represent that you are
          at least 18 years of age and have the legal capacity to enter into these terms.
        </Section>

        <Section title="3. Account Registration">
          You are responsible for maintaining the confidentiality of your account credentials. You are responsible
          for all activity that occurs under your account. You must provide accurate and complete information during
          registration. We reserve the right to suspend or terminate accounts that violate these terms.
        </Section>

        <Section title="4. Subscription Plans and Billing">
          IndieThis offers subscription plans (Launch, Push, Reign for artists; Pro, Elite for studios) billed
          monthly through Stripe. Pay-per-use AI tools are available without a subscription. All prices are listed
          in US dollars. Subscriptions renew automatically each month unless cancelled. You may cancel at any time
          through your account settings. Cancellation takes effect at the end of the current billing period — no
          refunds are issued for partial months. We reserve the right to change pricing with 30 days notice to
          active subscribers.
        </Section>

        <Section title="5. Content Ownership">
          You retain full ownership of all content you upload to IndieThis, including music, artwork, videos, and
          written content. You retain full ownership of your master recordings. By uploading content, you grant
          IndieThis a non-exclusive, worldwide license to host, display, and distribute your content within the
          platform as necessary to provide our services. This license terminates when you delete your content or
          close your account. AI-generated content created through our tools is owned by you upon purchase.
        </Section>

        <Section title="6. Prohibited Content and Conduct">
          You may not upload content that infringes on the intellectual property rights of others, is illegal,
          defamatory, obscene, or promotes violence or hate. You may not use the platform to distribute malware or
          engage in phishing. You may not create multiple accounts to circumvent platform limits, scrape or automate
          access without written permission, or resell platform access. We reserve the right to remove content and
          suspend accounts that violate these rules.
        </Section>

        <Section title="7. Merch Storefront">
          IndieThis provides merch storefront tools. You are responsible for the accuracy of your product
          descriptions and fulfillment. IndieThis takes a platform cut on merch sales as specified in your
          subscription tier. You are responsible for applicable sales tax obligations in your jurisdiction.
        </Section>

        <Section title="8. Beat Marketplace">
          Beat licensing agreements are between the buyer and seller. IndieThis facilitates the transaction and
          provides standard licensing templates. IndieThis takes a platform cut on beat sales as specified in your
          subscription tier. Sellers are responsible for ensuring they have the rights to sell the beats they list.
        </Section>

        <Section title="9. Payments and Earnings">
          Payments are processed through Stripe. Earnings from merch sales, beat sales, tips, and other revenue are
          paid to your connected Stripe account. IndieThis is not responsible for Stripe fees or payment processing
          delays. You are responsible for reporting and paying taxes on your earnings.
        </Section>

        <Section title="10. AI Tools">
          AI-generated content is created using third-party AI providers. Results may vary. We do not guarantee
          that AI-generated content will be free of errors or suitable for any specific purpose. You are responsible
          for reviewing AI-generated content before publishing or distributing it. AI tool credits and usage limits
          are determined by your subscription tier.
        </Section>

        <Section title="11. Studio Services">
          Studio accounts manage client relationships, bookings, and file delivery through the platform. Studios
          are responsible for the services they provide to their clients. IndieThis is not a party to agreements
          between studios and their clients.
        </Section>

        <Section title="12. Promo Codes and Ambassador Program">
          Promo codes are issued at the sole discretion of IndieThis and may be revoked at any time. Ambassador
          rewards are earned based on the terms set at the time of enrollment and may be modified with notice.
          Ambassador credit balances and payouts are subject to the terms of the ambassador agreement.
        </Section>

        <Section title="13. Privacy">
          Your use of IndieThis is also governed by our{" "}
          <Link href="/privacy" style={{ color: "#D4A843", textDecoration: "none" }}>
            Privacy Policy
          </Link>
          . Please review it to understand how we collect, use, and protect your information.
        </Section>

        <Section title="14. Intellectual Property">
          The IndieThis name, logo, and brand elements are the property of IndieThis LLC. You may not use our
          branding without written permission. The &quot;Powered by IndieThis&quot; attribution on public pages
          is a condition of using the platform.
        </Section>

        <Section title="15. Limitation of Liability">
          IndieThis is provided &quot;as is&quot; without warranties of any kind, express or implied. We are not
          liable for any indirect, incidental, special, or consequential damages arising from your use of the
          platform. Our total liability to you for any claim shall not exceed the amount you paid us in the
          12 months preceding the claim.
        </Section>

        <Section title="16. Termination">
          We may suspend or terminate your account at any time for violation of these terms. You may close your
          account at any time through your account settings. Upon termination, your content will be retained for
          30 days to allow you to export it, after which it may be permanently deleted.
        </Section>

        <Section title="17. Changes to Terms">
          We may update these terms from time to time. We will notify active users of material changes via email.
          Continued use of the platform after changes take effect constitutes acceptance of the updated terms.
        </Section>

        <Section title="18. Governing Law">
          These terms are governed by the laws of the State of Illinois, United States. Any disputes shall be
          resolved in the courts of Cook County, Illinois.
        </Section>

        <Section title="19. Contact">
          For questions about these terms, contact us at{" "}
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
            <Link href="/terms" style={{ color: "#D4A843", textDecoration: "none" }}>Terms</Link>
            <Link href="/privacy" style={{ color: "#444", textDecoration: "none" }}>Privacy</Link>
            <a href="mailto:hello@indiethis.com" style={{ color: "#444", textDecoration: "none" }}>
              hello@indiethis.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
