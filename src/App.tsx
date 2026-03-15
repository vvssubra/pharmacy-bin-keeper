import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Index";
import DrugMaster from "@/pages/DrugMaster";
import Terimaan from "@/pages/Terimaan";
import Laporan from "@/pages/Laporan";
import DrugLedger from "@/pages/DrugLedger";
import BinCard from "@/pages/BinCard";
import DoctorLanding from "@/pages/DoctorLanding";
import DoctorRequest from "@/pages/DoctorRequest";
import AntibioticForm from "@/pages/AntibioticForm";
import SpecialistDashboard from "@/pages/SpecialistDashboard";
import PharmacistFulfilment from "@/pages/PharmacistFulfilment";
import PatientRegistry from "@/pages/PatientRegistry";
import RoleManagement from "@/pages/RoleManagement";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            {/* Doctor routes */}
            <Route path="/request" element={<ProtectedRoute><AppLayout><DoctorLanding /></AppLayout></ProtectedRoute>} />
            <Route path="/request/ubat" element={<ProtectedRoute><AppLayout><DoctorRequest /></AppLayout></ProtectedRoute>} />
            <Route path="/request/antibiotik" element={<ProtectedRoute><AppLayout><AntibioticForm /></AppLayout></ProtectedRoute>} />
            {/* Specialist */}
            <Route path="/specialist" element={<ProtectedRoute><AppLayout><SpecialistDashboard /></AppLayout></ProtectedRoute>} />
            {/* Pharmacist + Admin routes */}
            <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/drugs" element={<ProtectedRoute><AppLayout><DrugMaster /></AppLayout></ProtectedRoute>} />
            <Route path="/drugs/:id/ledger" element={<ProtectedRoute><AppLayout><DrugLedger /></AppLayout></ProtectedRoute>} />
            <Route path="/drugs/:id/bincard" element={<ProtectedRoute><AppLayout><BinCard /></AppLayout></ProtectedRoute>} />
            <Route path="/terimaan" element={<ProtectedRoute><AppLayout><Terimaan /></AppLayout></ProtectedRoute>} />
            <Route path="/fulfilment" element={<ProtectedRoute><AppLayout><PharmacistFulfilment /></AppLayout></ProtectedRoute>} />
            <Route path="/pesakit" element={<ProtectedRoute><AppLayout><PatientRegistry /></AppLayout></ProtectedRoute>} />
            <Route path="/laporan" element={<ProtectedRoute><AppLayout><Laporan /></AppLayout></ProtectedRoute>} />
            <Route path="/role-management" element={<ProtectedRoute><AppLayout><RoleManagement /></AppLayout></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
