import Navbar from "@/components/homepage/Navbar";
import HeroSection from "@/components/homepage/HeroSection";
import AffiliationsBanner from "@/components/homepage/AffiliationsBanner";
import Footer from "@/components/homepage/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <AffiliationsBanner />
      </main>
      <Footer />
    </>
  );
}
