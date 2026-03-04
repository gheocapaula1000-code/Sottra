import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ScanHistoryProvider } from "@/contexts/ScanHistoryContext";
import Index from "./pages/Index";

const Scan = lazy(() => import("./pages/Scan"));
const Result = lazy(() => import("./pages/Result"));
const History = lazy(() => import("./pages/History"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ScanHistoryProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<div className="flex min-h-svh items-center justify-center bg-background"><div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" /></div>}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/scan" element={<Scan />} />
                <Route path="/result" element={<Result />} />
                <Route path="/history" element={<History />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ScanHistoryProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
