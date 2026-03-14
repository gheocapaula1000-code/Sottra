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
import PwaUpdateBanner from "@/components/PwaUpdateBanner";
import { BUILD_VERSION } from "@/lib/buildInfo";
import Index from "./pages/Index";

if (import.meta.env.DEV) console.log(`[Sottra] build ${BUILD_VERSION}`);

const Dashboard = lazy(() => import("./pages/Dashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Scan = lazy(() => import("./pages/Scan"));
const Result = lazy(() => import("./pages/Result"));
const History = lazy(() => import("./pages/History"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const CookiePolicy = lazy(() => import("./pages/CookiePolicy"));
const TerminiCondizioni = lazy(() => import("./pages/TerminiCondizioni"));
const NoteLegali = lazy(() => import("./pages/NoteLegali"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Diagnostics = lazy(() => import("./pages/Diagnostics"));
const AdminOmiIngest = lazy(() => import("./pages/AdminOmiIngest"));

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
                    <Route path="/app" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                    <Route path="/app/diagnostics" element={<ProtectedRoute><Diagnostics /></ProtectedRoute>} />
                    <Route path="/admin" element={<ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute>} />
                    <Route path="/admin/diagnostics" element={<ProtectedAdminRoute><Diagnostics /></ProtectedAdminRoute>} />
                    <Route path="/scan" element={<TrialProtectedRoute><Scan /></TrialProtectedRoute>} />
                    <Route path="/result" element={<TrialProtectedRoute><Result /></TrialProtectedRoute>} />
                    <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                    <Route path="/cookie-policy" element={<CookiePolicy />} />
                    <Route path="/termini-condizioni" element={<TerminiCondizioni />} />
                    <Route path="/note-legali" element={<NoteLegali />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
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
