/**
 * Contextual feature promotions for transactional emails.
 * Rule: NEVER promote the same tool the user just used. Always promote the logical next step.
 */

export type EmailPromotion = {
  heading: string;
  text:    string;
  ctaText: string;
  ctaUrl:  string;
};

export type PromotionUserData = {
  artistSlug?:   string;
  referralSlug?: string;
  unsubscribeUrl?: string;
};

const APP_URL = "https://indiethis.com";

export function getFeaturePromotion(
  context:  string,
  userData: PromotionUserData = {},
): EmailPromotion {
  const artistUrl = userData.artistSlug ? `${APP_URL}/${userData.artistSlug}` : APP_URL;

  switch (context) {
    case "DIGITAL_PURCHASE_RECEIPT":
      // Fan just bought music — promote artist's merch or other releases
      return {
        heading: "More from this artist",
        text:    "Check out their merch and other releases.",
        ctaText: "Visit Store",
        ctaUrl:  artistUrl,
      };

    case "COVER_ART_COMPLETE":
      // Just made cover art — promote canvas video
      return {
        heading: "Bring it to life",
        text:    "Generate a canvas video for your new artwork — just $1.99.",
        ctaText: "Create Canvas",
        ctaUrl:  `${APP_URL}/dashboard/music`,
      };

    case "MASTERING_COMPLETE":
      // Just mastered — promote release prep
      return {
        heading: "Ready to release?",
        text:    "Generate a press kit to send to blogs and playlists.",
        ctaText: "Create Press Kit",
        ctaUrl:  `${APP_URL}/dashboard/ai/press-kit`,
      };

    case "MERCH_ORDER_CONFIRMATION":
      // Fan bought merch — promote the artist's music
      return {
        heading: "Listen to their music",
        text:    "Discover more from this artist on IndieThis.",
        ctaText: "Explore",
        ctaUrl:  artistUrl,
      };

    case "MERCH_SHIPPED":
      // Order is shipped — promote other artists while they wait
      return {
        heading: "More music while you wait",
        text:    "Discover independent artists and support them on IndieThis.",
        ctaText: "Explore Artists",
        ctaUrl:  `${APP_URL}/explore`,
      };

    case "MERCH_DELIVERED":
      // Order arrived — prompt them to explore more
      return {
        heading: "Shop more merch",
        text:    "Browse more merch from independent artists on IndieThis.",
        ctaText: "Shop Merch",
        ctaUrl:  `${APP_URL}/explore`,
      };

    case "SUBSCRIPTION_WELCOME":
      // New subscriber — get them started
      return {
        heading: "First steps",
        text:    "Upload your first track and set up your public page.",
        ctaText: "Get Started",
        ctaUrl:  `${APP_URL}/dashboard`,
      };

    case "VOCAL_REMOVAL_COMPLETE":
      // Stems ready — promote mastering
      return {
        heading: "Next up",
        text:    "Try our AI mastering to get your stems release-ready — $7.99.",
        ctaText: "Master Now",
        ctaUrl:  `${APP_URL}/dashboard/ai/mastering`,
      };

    case "LYRIC_VIDEO_COMPLETE":
      // Lyric video done — promote sharing/public page
      return {
        heading: "Share it with the world",
        text:    "Add your lyric video to your public artist page and grow your audience.",
        ctaText: "View Your Page",
        ctaUrl:  artistUrl,
      };

    case "PRESS_KIT_COMPLETE":
      // Press kit done — promote distribution / beat marketplace
      return {
        heading: "Reach more blogs",
        text:    "Submit your press kit to curators and playlist editors directly from your dashboard.",
        ctaText: "Open Dashboard",
        ctaUrl:  `${APP_URL}/dashboard`,
      };

    case "FAN_FUNDING_RECEIPT":
      // Fan sent support — encourage them to discover more artists
      return {
        heading: "Discover more artists",
        text:    "Find independent artists who need your support on IndieThis.",
        ctaText: "Explore",
        ctaUrl:  `${APP_URL}/explore`,
      };

    case "FAN_FUNDING_RECEIVED":
      // Artist received a tip — encourage using credits
      return {
        heading: "Put those credits to work",
        text:    "Use your credits for AI tools, merch production, or your subscription.",
        ctaText: "View Balance",
        ctaUrl:  `${APP_URL}/dashboard/earnings`,
      };

    case "ARTIST_SALE_NOTIFICATION":
      // Artist made a sale — encourage adding more content
      return {
        heading: "Keep the momentum going",
        text:    "Upload more tracks and beats to grow your catalog and earnings.",
        ctaText: "Upload Music",
        ctaUrl:  `${APP_URL}/dashboard/music`,
      };

    case "ARTIST_MERCH_ORDER":
      // Artist has a new order to fulfill — promote adding more products
      return {
        heading: "Expand your merch line",
        text:    "Add more products to your store — print-on-demand means zero upfront cost.",
        ctaText: "Add Products",
        ctaUrl:  `${APP_URL}/dashboard/merch`,
      };

    case "BEAT_PURCHASE_RECEIPT":
      // Producer's beat was purchased — promote licensing dashboard
      return {
        heading: "Protect your catalog",
        text:    "Track Shield monitors for unauthorized use of your beats across the web.",
        ctaText: "Try Track Shield",
        ctaUrl:  `${APP_URL}/dashboard/ai`,
      };

    case "TRACK_SHIELD_COMPLETE":
      // Shield scan done — promote split sheets if issues found
      return {
        heading: "Protect your splits too",
        text:    "Create a digital split sheet to lock in your credits and royalty shares.",
        ctaText: "Create Split Sheet",
        ctaUrl:  `${APP_URL}/dashboard/music`,
      };

    case "SESSION_FOLLOWUP":
      // Studio session complete — promote next booking or music upload
      return {
        heading: "Share what you recorded",
        text:    "Upload your session tracks and start selling or sharing on IndieThis.",
        ctaText: "Upload Music",
        ctaUrl:  `${APP_URL}/dashboard/music`,
      };

    default:
      return {
        heading: "Explore IndieThis",
        text:    "Discover new tools to grow your music career.",
        ctaText: "Explore",
        ctaUrl:  `${APP_URL}/explore`,
      };
  }
}
