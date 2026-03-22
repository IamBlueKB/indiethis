import Link from "next/link";

export default function HomepageFooter() {
  return (
    <footer
      style={{
        backgroundColor: "#050507",
        borderTop: "1px solid rgba(255,255,255,0.04)",
        padding: "20px 24px",
      }}
    >
      <div
        className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3"
        style={{ fontSize: 12, color: "#444" }}
      >
        <span>© 2026 IndieThis LLC</span>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <Link href="/terms" style={{ color: "#444", textDecoration: "none" }} className="hover:text-gray-300 transition-colors">Terms</Link>
          <Link href="/privacy" style={{ color: "#444", textDecoration: "none" }} className="hover:text-gray-300 transition-colors">Privacy</Link>
          <a href="mailto:hello@indiethis.com" style={{ color: "#444", textDecoration: "none" }} className="hover:text-gray-300 transition-colors">hello@indiethis.com</a>
        </div>
      </div>
    </footer>
  );
}
