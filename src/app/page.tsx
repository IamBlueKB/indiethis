"use client";

import Navbar from "@/components/layout/Navbar";
import Hero from "@/components/public/Hero";
import Features from "@/components/public/Features";
import HowItWorks from "@/components/public/HowItWorks";
import Pricing from "@/components/public/Pricing";
import ForArtists from "@/components/public/ForArtists";
import ForStudios from "@/components/public/ForStudios";
import SocialProof from "@/components/public/SocialProof";
import Footer from "@/components/layout/Footer";

export default function HomePage() {
  return (
    <main style={{ backgroundColor: "#0A0A0B", minHeight: "100vh" }}>
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
      <ForArtists />
      <ForStudios />
      <SocialProof />
      <Footer />
    </main>
  );
}
