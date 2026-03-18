/**
 * PressKitPDF.tsx — @react-pdf/renderer component for AI-generated press kits.
 *
 * Rendered server-side via renderToBuffer in the on-demand PDF route:
 *   GET /api/ai-jobs/[id]/press-kit-pdf
 */

import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Link,
} from "@react-pdf/renderer";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PressKitContent = {
  artistName: string;
  tagline?: string;
  genre?: string;
  location?: string;
  bio: {
    short:  string;
    medium: string;
    long:   string;
  };
  achievements:  string[];
  pressQuotes:   { quote: string; source: string }[];
  technicalRider?: string;
  contact: {
    email?:        string;
    bookingEmail?: string;
    phone?:        string;
  };
  socialLinks: {
    instagram?:  string;
    tiktok?:     string;
    youtube?:    string;
    spotify?:    string;
    appleMusic?: string;
  };
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const GOLD    = "#D4A843";
const BLACK   = "#0A0A0A";
const DARK    = "#1A1A1A";
const GRAY    = "#666666";
const LIGHT   = "#F5F5F5";
const WHITE   = "#FFFFFF";

const styles = StyleSheet.create({
  page: {
    fontFamily:      "Helvetica",
    fontSize:        10,
    backgroundColor: WHITE,
    color:           BLACK,
  },

  // ── Hero ──
  hero: {
    backgroundColor: DARK,
    padding:         40,
    paddingBottom:   32,
    flexDirection:   "row",
    alignItems:      "flex-start",
    gap:             24,
  },
  heroPhoto: {
    width:        100,
    height:       100,
    borderRadius: 8,
    objectFit:    "cover",
  },
  heroPhotoPlaceholder: {
    width:           100,
    height:          100,
    borderRadius:    8,
    backgroundColor: GOLD,
    justifyContent:  "center",
    alignItems:      "center",
  },
  heroPhotoInitial: {
    fontFamily: "Helvetica-Bold",
    fontSize:   36,
    color:      BLACK,
  },
  heroText: {
    flex: 1,
  },
  heroName: {
    fontFamily:  "Helvetica-Bold",
    fontSize:    28,
    color:       WHITE,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  heroTagline: {
    fontSize:  12,
    color:     GOLD,
    marginBottom: 6,
  },
  heroMeta: {
    fontSize: 10,
    color:    "#999999",
  },
  heroBadge: {
    backgroundColor: GOLD,
    color:           BLACK,
    fontFamily:      "Helvetica-Bold",
    fontSize:        9,
    padding:         "3 8",
    borderRadius:    3,
    alignSelf:       "flex-start",
    marginTop:       10,
    textTransform:   "uppercase",
    letterSpacing:   0.5,
  },

  // ── Body ──
  body: {
    padding: 40,
  },

  // ── Sections ──
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection:  "row",
    alignItems:     "center",
    marginBottom:   10,
    gap:            8,
  },
  sectionAccent: {
    width:           3,
    height:          14,
    backgroundColor: GOLD,
    borderRadius:    2,
  },
  sectionTitle: {
    fontFamily:    "Helvetica-Bold",
    fontSize:      11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color:         BLACK,
  },

  // ── Bio ──
  bioLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize:   9,
    color:      GRAY,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom:  4,
    marginTop:     10,
  },
  bioText: {
    fontSize:   10,
    color:      DARK,
    lineHeight: 1.6,
  },

  // ── Achievements ──
  bulletRow: {
    flexDirection: "row",
    marginBottom:  5,
    gap:           8,
  },
  bulletDot: {
    width:       6,
    height:      6,
    borderRadius: 3,
    backgroundColor: GOLD,
    marginTop:    4,
    flexShrink:   0,
  },
  bulletText: {
    flex:       1,
    fontSize:   10,
    color:      DARK,
    lineHeight: 1.5,
  },

  // ── Press Quotes ──
  quoteBlock: {
    backgroundColor: LIGHT,
    borderLeft:      "3px solid " + GOLD,
    padding:         "10 14",
    borderRadius:    "0 4 4 0",
    marginBottom:    10,
  },
  quoteText: {
    fontSize:    11,
    color:       DARK,
    lineHeight:  1.6,
    fontFamily:  "Helvetica-Oblique",
    marginBottom: 5,
  },
  quoteSource: {
    fontSize:   9,
    color:      GRAY,
    fontFamily: "Helvetica-Bold",
  },

  // ── Rider ──
  riderText: {
    fontSize:   10,
    color:      DARK,
    lineHeight: 1.5,
  },

  // ── Contact / Socials ──
  contactGrid: {
    flexDirection: "row",
    gap:           20,
  },
  contactColumn: {
    flex: 1,
  },
  contactRow: {
    flexDirection: "row",
    marginBottom:  5,
    gap:           8,
  },
  contactLabel: {
    width:      70,
    fontSize:   9,
    color:      GRAY,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    flexShrink: 0,
  },
  contactValue: {
    flex:     1,
    fontSize: 10,
    color:    DARK,
  },
  contactLink: {
    flex:     1,
    fontSize: 10,
    color:    GOLD,
  },

  // ── Divider ──
  divider: {
    borderTop:    "1px solid #EEEEEE",
    marginBottom: 24,
  },

  // ── Footer ──
  footer: {
    position:    "absolute",
    bottom:      24,
    left:        40,
    right:       40,
    borderTop:   "1px solid #EEEEEE",
    paddingTop:  10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems:  "center",
  },
  footerText: {
    fontSize: 8,
    color:    "#AAAAAA",
  },
  footerBrand: {
    fontSize:   8,
    color:      GOLD,
    fontFamily: "Helvetica-Bold",
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionAccent} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

type PressKitPDFProps = {
  content:  PressKitContent;
  photoUrl?: string;
  jobId:    string;
};

export default function PressKitPDF({ content, photoUrl, jobId }: PressKitPDFProps) {
  const initial = (content.artistName ?? "A").charAt(0).toUpperCase();
  const today   = new Date().toLocaleDateString("en-US", {
    month: "long", year: "numeric",
  });

  const hasSocials = Object.values(content.socialLinks ?? {}).some(Boolean);
  const hasContact = Object.values(content.contact ?? {}).some(Boolean);

  return (
    <Document
      title={`${content.artistName} — Press Kit`}
      author="IndieThis"
    >
      <Page size="A4" style={styles.page}>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          {/* Photo or initial placeholder */}
          {photoUrl ? (
            <Image style={styles.heroPhoto} src={photoUrl} />
          ) : (
            <View style={styles.heroPhotoPlaceholder}>
              <Text style={styles.heroPhotoInitial}>{initial}</Text>
            </View>
          )}

          <View style={styles.heroText}>
            <Text style={styles.heroName}>{content.artistName}</Text>
            {content.tagline && (
              <Text style={styles.heroTagline}>{content.tagline}</Text>
            )}
            <Text style={styles.heroMeta}>
              {[content.genre, content.location].filter(Boolean).join("  ·  ")}
            </Text>
            <Text style={styles.heroBadge}>Press Kit · {today}</Text>
          </View>
        </View>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <View style={styles.body}>

          {/* Bio */}
          <View style={styles.section}>
            <SectionHeader title="Artist Bio" />

            <Text style={styles.bioLabel}>Short Bio</Text>
            <Text style={styles.bioText}>{content.bio?.short}</Text>

            <Text style={styles.bioLabel}>Full Bio</Text>
            <Text style={styles.bioText}>{content.bio?.long}</Text>
          </View>

          <View style={styles.divider} />

          {/* Achievements */}
          {content.achievements?.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="Key Highlights" />
              {content.achievements.map((a, i) => (
                <Bullet key={i} text={a} />
              ))}
            </View>
          )}

          {/* Press Quotes */}
          {content.pressQuotes?.length > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.section}>
                <SectionHeader title="Press" />
                {content.pressQuotes.map((q, i) => (
                  <View key={i} style={styles.quoteBlock}>
                    <Text style={styles.quoteText}>"{q.quote}"</Text>
                    <Text style={styles.quoteSource}>— {q.source}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Technical Rider */}
          {content.technicalRider && (
            <>
              <View style={styles.divider} />
              <View style={styles.section}>
                <SectionHeader title="Technical Requirements" />
                <Text style={styles.riderText}>{content.technicalRider}</Text>
              </View>
            </>
          )}

          {/* Contact & Socials */}
          {(hasContact || hasSocials) && (
            <>
              <View style={styles.divider} />
              <View style={styles.section}>
                <SectionHeader title="Contact & Links" />
                <View style={styles.contactGrid}>

                  {hasContact && (
                    <View style={styles.contactColumn}>
                      {content.contact.email && (
                        <View style={styles.contactRow}>
                          <Text style={styles.contactLabel}>Email</Text>
                          <Text style={styles.contactValue}>{content.contact.email}</Text>
                        </View>
                      )}
                      {content.contact.bookingEmail && (
                        <View style={styles.contactRow}>
                          <Text style={styles.contactLabel}>Booking</Text>
                          <Text style={styles.contactValue}>{content.contact.bookingEmail}</Text>
                        </View>
                      )}
                      {content.contact.phone && (
                        <View style={styles.contactRow}>
                          <Text style={styles.contactLabel}>Phone</Text>
                          <Text style={styles.contactValue}>{content.contact.phone}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {hasSocials && (
                    <View style={styles.contactColumn}>
                      {content.socialLinks.instagram && (
                        <View style={styles.contactRow}>
                          <Text style={styles.contactLabel}>Instagram</Text>
                          <Link src={`https://instagram.com/${content.socialLinks.instagram}`} style={styles.contactLink}>
                            @{content.socialLinks.instagram}
                          </Link>
                        </View>
                      )}
                      {content.socialLinks.tiktok && (
                        <View style={styles.contactRow}>
                          <Text style={styles.contactLabel}>TikTok</Text>
                          <Link src={`https://tiktok.com/@${content.socialLinks.tiktok}`} style={styles.contactLink}>
                            @{content.socialLinks.tiktok}
                          </Link>
                        </View>
                      )}
                      {content.socialLinks.spotify && (
                        <View style={styles.contactRow}>
                          <Text style={styles.contactLabel}>Spotify</Text>
                          <Link src={content.socialLinks.spotify} style={styles.contactLink}>
                            {content.socialLinks.spotify.replace("https://", "")}
                          </Link>
                        </View>
                      )}
                      {content.socialLinks.youtube && (
                        <View style={styles.contactRow}>
                          <Text style={styles.contactLabel}>YouTube</Text>
                          <Link src={content.socialLinks.youtube} style={styles.contactLink}>
                            {content.socialLinks.youtube.replace("https://", "")}
                          </Link>
                        </View>
                      )}
                      {content.socialLinks.appleMusic && (
                        <View style={styles.contactRow}>
                          <Text style={styles.contactLabel}>Apple Music</Text>
                          <Link src={content.socialLinks.appleMusic} style={styles.contactLink}>
                            {content.socialLinks.appleMusic.replace("https://", "")}
                          </Link>
                        </View>
                      )}
                    </View>
                  )}

                </View>
              </View>
            </>
          )}

        </View>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Generated by IndieThis · Job #{jobId.slice(-8).toUpperCase()}
          </Text>
          <Text style={styles.footerBrand}>IndieThis · indiethis.com</Text>
        </View>

      </Page>
    </Document>
  );
}
