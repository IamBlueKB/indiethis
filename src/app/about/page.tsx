import HomepageNav from "@/components/layout/HomepageNav";
import HomepageHero from "@/components/public/HomepageHero";
import LiveActivityBar from "@/components/public/LiveActivityBar";
import ImmersivePlayerCard from "@/components/public/ImmersivePlayerCard";
import AIDemoSection from "@/components/public/AIDemoSection";
import TransformationSection from "@/components/public/TransformationSection";
import TimelineSection from "@/components/public/TimelineSection";
import TestimonialsSection from "@/components/public/TestimonialsSection";
import StudioStrip from "@/components/public/StudioStrip";
import FinalCTA from "@/components/public/FinalCTA";
import HomepageFooter from "@/components/public/HomepageFooter";
import Pricing from "@/components/public/Pricing";
import Features from "@/components/public/Features";
import ForArtists from "@/components/public/ForArtists";
import { getPricing, PRICING_DEFAULTS } from "@/lib/pricing";

export const metadata = {
  title: "About IndieThis — The Label You Don't Need",
  description:
    "AI music videos, cover art, mastering, merch, beat sales, and your own website. One platform, total independence.",
};

export default async function AboutPage() {
  const pricing = await getPricing();

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
    <main style={{ backgroundColor: "#0A0A0A", minHeight: "100vh" }}>
      <HomepageNav />
      <HomepageHero />
      <LiveActivityBar />
      <ImmersivePlayerCard />
      <AIDemoSection />
      <TransformationSection />
      <section id="features" style={{ scrollMarginTop: "72px" }}>
        <Features />
      </section>
      <TimelineSection />
      <TestimonialsSection />
      <section id="artists" style={{ backgroundColor: "#0D0D0F", scrollMarginTop: "72px" }}>
        <ForArtists pricing={p} />
      </section>
      <StudioStrip />
      <section id="pricing" style={{ backgroundColor: "#0A0A0A", scrollMarginTop: "72px" }}>
        <Pricing pricing={p} />
      </section>
      <FinalCTA />
      <HomepageFooter />
    </main>
  );
}
