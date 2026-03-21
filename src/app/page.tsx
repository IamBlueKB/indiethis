import Navbar from "@/components/layout/Navbar";
import Hero from "@/components/public/Hero";
import Features from "@/components/public/Features";
import HowItWorks from "@/components/public/HowItWorks";
import Pricing from "@/components/public/Pricing";
import ForArtists from "@/components/public/ForArtists";
import ForStudios from "@/components/public/ForStudios";
import SocialProof from "@/components/public/SocialProof";
import Footer from "@/components/layout/Footer";
import { getPricing, PRICING_DEFAULTS } from "@/lib/pricing";

export default async function HomePage() {
  const pricing = await getPricing();

  // Build a simple prices object for client components
  const p = {
    planLaunch:    pricing.PLAN_LAUNCH?.value     ?? PRICING_DEFAULTS.PLAN_LAUNCH.value,
    planPush:      pricing.PLAN_PUSH?.value        ?? PRICING_DEFAULTS.PLAN_PUSH.value,
    planReign:     pricing.PLAN_REIGN?.value       ?? PRICING_DEFAULTS.PLAN_REIGN.value,
    studioPro:     pricing.STUDIO_PRO?.value       ?? PRICING_DEFAULTS.STUDIO_PRO.value,
    studioElite:   pricing.STUDIO_ELITE?.value     ?? PRICING_DEFAULTS.STUDIO_ELITE.value,
    coverArt:      pricing.AI_COVER_ART?.display   ?? PRICING_DEFAULTS.AI_COVER_ART.display,
    mastering:     pricing.AI_MASTERING?.display   ?? PRICING_DEFAULTS.AI_MASTERING.display,
    lyricVideo:    pricing.AI_LYRIC_VIDEO?.display ?? PRICING_DEFAULTS.AI_LYRIC_VIDEO.display,
    aarReport:     pricing.AI_AAR_REPORT?.display  ?? PRICING_DEFAULTS.AI_AAR_REPORT.display,
    pressKit:      pricing.AI_PRESS_KIT?.display   ?? PRICING_DEFAULTS.AI_PRESS_KIT.display,
    videoShort:    pricing.AI_VIDEO_SHORT?.display ?? PRICING_DEFAULTS.AI_VIDEO_SHORT.display,
    videoMedium:   pricing.AI_VIDEO_MEDIUM?.display ?? PRICING_DEFAULTS.AI_VIDEO_MEDIUM.display,
    videoLong:     pricing.AI_VIDEO_LONG?.display  ?? PRICING_DEFAULTS.AI_VIDEO_LONG.display,
    cutMerchPush:  pricing.CUT_MERCH_PUSH?.display ?? PRICING_DEFAULTS.CUT_MERCH_PUSH.display,
    cutMerchReign: pricing.CUT_MERCH_REIGN?.display ?? PRICING_DEFAULTS.CUT_MERCH_REIGN.display,
    cutMusic:      pricing.CUT_MUSIC_SALES?.display ?? PRICING_DEFAULTS.CUT_MUSIC_SALES.display,
  };

  return (
    <main style={{ backgroundColor: "#0A0A0B", minHeight: "100vh" }}>
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing pricing={p} />
      <ForArtists pricing={p} />
      <ForStudios />
      <SocialProof />
      <Footer />
    </main>
  );
}
