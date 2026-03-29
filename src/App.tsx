import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ScanHistoryProvider } from "@/contexts/ScanHistoryContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import CookieBanner from "@/components/CookieBanner";
import ProtectedRoute from "@/components/ProtectedRoute";
import ProtectedAdminRoute from "@/components/ProtectedAdminRoute";
import TrialProtectedRoute from "@/components/TrialProtectedRoute";
import AppDashboardGate from "@/components/AppDashboardGate";
import PwaUpdateBanner from "@/components/PwaUpdateBanner";
import OfflineBanner from "@/components/OfflineBanner";
import { BUILD_VERSION } from "@/lib/buildInfo";
import { isChunkLoadError, recoverFromChunkError } from "@/lib/chunkErrorRecovery";
import Index from "./pages/Index";

if (import.meta.env.DEV) console.log(`[Sottra] build ${BUILD_VERSION}`);

// Lazy-loaded routes with chunk error recovery
function lazyWithRecovery(factory: () => Promise<{ default: React.ComponentType }>) {
  return lazy(() =>
    factory().catch((err) => {
      if (isChunkLoadError(err)) {
        recoverFromChunkError();
        // Return a placeholder while reloading
        return { default: () => null } as { default: React.ComponentType };
      }
      throw err;
    })
  );
}

const AdminDashboard = lazyWithRecovery(() => import("./pages/AdminDashboard"));
const Scan = lazyWithRecovery(() => import("./pages/Scan"));
const Result = lazyWithRecovery(() => import("./pages/Result"));
const History = lazyWithRecovery(() => import("./pages/History"));
const Login = lazyWithRecovery(() => import("./pages/Login"));
const Signup = lazyWithRecovery(() => import("./pages/Signup"));
const PrivacyPolicy = lazyWithRecovery(() => import("./pages/PrivacyPolicy"));
const CookiePolicy = lazyWithRecovery(() => import("./pages/CookiePolicy"));
const TerminiCondizioni = lazyWithRecovery(() => import("./pages/TerminiCondizioni"));
const NoteLegali = lazyWithRecovery(() => import("./pages/NoteLegali"));
const ForgotPassword = lazyWithRecovery(() => import("./pages/ForgotPassword"));
const ResetPassword = lazyWithRecovery(() => import("./pages/ResetPassword"));
const NotFound = lazyWithRecovery(() => import("./pages/NotFound"));
const Diagnostics = lazyWithRecovery(() => import("./pages/Diagnostics"));
const AdminOmiIngest = lazyWithRecovery(() => import("./pages/AdminOmiIngest"));
const AdminOmiKmlIngest = lazyWithRecovery(() => import("./pages/AdminOmiKmlIngest"));
const AdminDemographicImport = lazyWithRecovery(() => import("./pages/AdminDemographicImport"));
const ImportedDrafts = lazyWithRecovery(() => import("./pages/ImportedDrafts"));
const ImportedDraftDetail = lazyWithRecovery(() => import("./pages/ImportedDraftDetail"));
const AdminSubMunicipal = lazyWithRecovery(() => import("./pages/AdminSubMunicipal"));
const AdminDataBackbone = lazyWithRecovery(() => import("./pages/AdminDataBackbone"));
const AdminGeoBackbone = lazyWithRecovery(() => import("./pages/AdminGeoBackbone"));
const AdminTerritorialBackbone = lazyWithRecovery(() => import("./pages/AdminTerritorialBackbone"));
const TerritorialReport = lazyWithRecovery(() => import("./pages/TerritorialReport"));
const AdminZoneProfile = lazyWithRecovery(() => import("./pages/AdminZoneProfile"));
const AdminBuildingProfile = lazyWithRecovery(() => import("./pages/AdminBuildingProfile"));
const AdminAddressResolution = lazyWithRecovery(() => import("./pages/AdminAddressResolution"));
const AdminSourcesRoadmap = lazyWithRecovery(() => import("./pages/AdminSourcesRoadmap"));
const AdminAnncsuReadiness = lazyWithRecovery(() => import("./pages/AdminAnncsuReadiness"));
const AdminAnncsuMatchAudit = lazyWithRecovery(() => import("./pages/AdminAnncsuMatchAudit"));
const AdminZoneCorrespondence = lazyWithRecovery(() => import("./pages/AdminZoneCorrespondence"));
const AdminZoneUrbanTransformations = lazyWithRecovery(() => import("./pages/AdminZoneUrbanTransformations"));
const AdminZoneAttractorsPressure = lazyWithRecovery(() => import("./pages/AdminZoneAttractorsPressure"));
const AdminZoneBoundaries = lazyWithRecovery(() => import("./pages/AdminZoneBoundaries"));
const AdminZoneValue = lazyWithRecovery(() => import("./pages/AdminZoneValue"));
const AdminZoneOutlook = lazyWithRecovery(() => import("./pages/AdminZoneOutlook"));

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <SubscriptionProvider>
            <ScanHistoryProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Suspense fallback={<div className="flex min-h-svh items-center justify-center bg-background"><div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" /></div>}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/app" element={<AppDashboardGate />} />
                    <Route path="/app/diagnostics" element={<ProtectedAdminRoute><Diagnostics /></ProtectedAdminRoute>} />
                    <Route path="/admin" element={<ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute>} />
                    <Route path="/admin/diagnostics" element={<ProtectedAdminRoute><Diagnostics /></ProtectedAdminRoute>} />
                    <Route path="/admin/omi-ingest" element={<ProtectedAdminRoute><AdminOmiIngest /></ProtectedAdminRoute>} />
                    <Route path="/admin/omi-kml" element={<ProtectedAdminRoute><AdminOmiKmlIngest /></ProtectedAdminRoute>} />
                    <Route path="/admin/demographic-import" element={<ProtectedAdminRoute><AdminDemographicImport /></ProtectedAdminRoute>} />
                    <Route path="/admin/sub-municipal" element={<ProtectedAdminRoute><AdminSubMunicipal /></ProtectedAdminRoute>} />
                    <Route path="/admin/data-backbone" element={<ProtectedAdminRoute><AdminDataBackbone /></ProtectedAdminRoute>} />
                    <Route path="/admin/geo-backbone" element={<ProtectedAdminRoute><AdminGeoBackbone /></ProtectedAdminRoute>} />
                    <Route path="/admin/territorial-backbone" element={<ProtectedAdminRoute><AdminTerritorialBackbone /></ProtectedAdminRoute>} />
                    <Route path="/admin/zone-profile" element={<ProtectedAdminRoute><AdminZoneProfile /></ProtectedAdminRoute>} />
                    <Route path="/admin/building-profile" element={<ProtectedAdminRoute><AdminBuildingProfile /></ProtectedAdminRoute>} />
                    <Route path="/admin/address-resolution" element={<ProtectedAdminRoute><AdminAddressResolution /></ProtectedAdminRoute>} />
                    <Route path="/admin/sources-roadmap" element={<ProtectedAdminRoute><AdminSourcesRoadmap /></ProtectedAdminRoute>} />
                    <Route path="/admin/anncsu-readiness" element={<ProtectedAdminRoute><AdminAnncsuReadiness /></ProtectedAdminRoute>} />
                    <Route path="/admin/anncsu-match-audit" element={<ProtectedAdminRoute><AdminAnncsuMatchAudit /></ProtectedAdminRoute>} />
                    <Route path="/admin/zone-correspondence" element={<ProtectedAdminRoute><AdminZoneCorrespondence /></ProtectedAdminRoute>} />
                    <Route path="/admin/zone-urban-transformations" element={<ProtectedAdminRoute><AdminZoneUrbanTransformations /></ProtectedAdminRoute>} />
                    <Route path="/admin/zone-attractors-pressure" element={<ProtectedAdminRoute><AdminZoneAttractorsPressure /></ProtectedAdminRoute>} />
                    <Route path="/admin/zone-boundaries" element={<ProtectedAdminRoute><AdminZoneBoundaries /></ProtectedAdminRoute>} />
                    <Route path="/admin/zone-value" element={<ProtectedAdminRoute><AdminZoneValue /></ProtectedAdminRoute>} />
                    <Route path="/admin/zone-outlook" element={<ProtectedAdminRoute><AdminZoneOutlook /></ProtectedAdminRoute>} />
                    <Route path="/territorial-report" element={<ProtectedRoute><TerritorialReport /></ProtectedRoute>} />
                    <Route path="/scan" element={<TrialProtectedRoute><Scan /></TrialProtectedRoute>} />
                    <Route path="/result" element={<TrialProtectedRoute><Result /></TrialProtectedRoute>} />
                    <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
                    <Route path="/app/imports" element={<ProtectedRoute><ImportedDrafts /></ProtectedRoute>} />
                    <Route path="/app/imports/:id" element={<ProtectedRoute><ImportedDraftDetail /></ProtectedRoute>} />
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                    <Route path="/cookie-policy" element={<CookiePolicy />} />
                    <Route path="/termini-condizioni" element={<TerminiCondizioni />} />
                    <Route path="/note-legali" element={<NoteLegali />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
                <OfflineBanner />
                <PwaUpdateBanner />
                <CookieBanner />
              </BrowserRouter>
            </ScanHistoryProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
