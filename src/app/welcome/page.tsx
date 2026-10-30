import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { CommunityPreview } from "@/features/landing/sections/community-preview";
import { FinalCta } from "@/features/landing/sections/final-cta";
import { Hero } from "@/features/landing/sections/hero";
import { Mentorship } from "@/features/landing/sections/mentorship";
import { Stages } from "@/features/landing/sections/stages";
import { Vision } from "@/features/landing/sections/vision";
import { WhatYouCanDo } from "@/features/landing/sections/what-you-can-do";
import { Why } from "@/features/landing/sections/why";

// The public welcome page. The root address (/) is the member home; visitors who are not signed
// in are sent here from there.
export const metadata: Metadata = { alternates: { canonical: "/welcome" } };

export default function WelcomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <Hero />
        <Why />
        <Stages />
        <WhatYouCanDo />
        <Mentorship />
        <CommunityPreview />
        <Vision />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
