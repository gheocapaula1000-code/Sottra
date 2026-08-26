import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import HeroSection from "@/components/landing/HeroSection";
import HomepageWowDemo from "@/components/landing/HomepageWowDemo";
import ValueModules from "@/components/landing/ValueModules";
import MultiLevel from "@/components/landing/MultiLevel";
import HowItWorks from "@/components/landing/HowItWorks";
import TrustBlock from "@/components/landing/TrustBlock";
import TargetAudience from "@/components/landing/TargetAudience";
import PricingSection from "@/components/landing/PricingSection";
import CtaFinal from "@/components/landing/CtaFinal";
import Footer from "@/components/landing/Footer";

const Index = () => {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) {
      navigate("/app", { replace: true });
    }
  }, [session, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background overflow-x-hidden">
      <HeroSection />
      <HomepageWowDemo />
      <ValueModules />
      <MultiLevel />
      <HowItWorks />
      <TrustBlock />
      <TargetAudience />
      <PricingSection />
      <CtaFinal />
      <Footer />
    </div>
  );
};

export default Index;
