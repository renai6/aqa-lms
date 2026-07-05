import Navbar from "@/components/homepage/Navbar";
import HeroSection from "@/components/homepage/HeroSection";
import Ticker from "@/components/homepage/Ticker";
import AffiliationsBanner from "@/components/homepage/AffiliationsBanner";
import FeaturedCourses from "@/components/homepage/FeaturedCourses";
import Footer from "@/components/homepage/Footer";
import BeforeFooter from "@/components/homepage/BeforeFooter";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <Ticker />
        <AffiliationsBanner />
        <FeaturedCourses />
        <BeforeFooter />
      </main>
      <Footer />
    </>
  );
}
