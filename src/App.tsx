import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Index";
import DrugMaster from "@/pages/DrugMaster";
import UploadMingguan from "@/pages/UploadMingguan";
import Terimaan from "@/pages/Terimaan";
import Laporan from "@/pages/Laporan";
import DrugLedger from "@/pages/DrugLedger";
import BinCard from "@/pages/BinCard";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout><Dashboard /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/drugs"
              element={
                <ProtectedRoute>
                  <AppLayout><DrugMaster /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/drugs/:id/ledger"
              element={
                <ProtectedRoute>
                  <AppLayout><DrugLedger /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/upload"
              element={
                <ProtectedRoute>
                  <AppLayout><UploadMingguan /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/terimaan"
              element={
                <ProtectedRoute>
                  <AppLayout><Terimaan /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/laporan"
              element={
                <ProtectedRoute>
                  <AppLayout><Laporan /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
