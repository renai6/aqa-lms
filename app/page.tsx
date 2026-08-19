import SiteHeader from "@/components/homepage/SiteHeader";
import HeroSection from "@/components/homepage/HeroSection";
import AffiliationsBanner from "@/components/homepage/AffiliationsBanner";
import VisionSection from "@/components/homepage/VisionSection";
import ProgramsSection from "@/components/homepage/ProgramsSection";
import EducationalCore from "@/components/homepage/EducationalCore";
import CertificatesSection from "@/components/homepage/CertificatesSection";
import BeforeFooter from "@/components/homepage/BeforeFooter";
import SiteFooter from "@/components/homepage/SiteFooter";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <HeroSection />
        <AffiliationsBanner />
        <VisionSection />
        <ProgramsSection />
        <EducationalCore />
        <CertificatesSection />
        <BeforeFooter />
      </main>
      <SiteFooter />
    </>
  );
}
