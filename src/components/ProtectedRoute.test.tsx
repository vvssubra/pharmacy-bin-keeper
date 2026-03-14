import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

const { useAuth } = await import("@/contexts/AuthContext");

function renderWithRouter(
  path: string,
  auth: { user: object | null; role: string | null; loading: boolean }
) {
  (useAuth as ReturnType<typeof vi.fn>).mockReturnValue(auth);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/specialist" element={<ProtectedRoute><div>Specialist page</div></ProtectedRoute>} />
        <Route path="/fulfilment" element={<ProtectedRoute><div>Permintaan Baharu page</div></ProtectedRoute>} />
        <Route path="/" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("role-based access", () => {
    it("shows no-permission view for staff on /specialist instead of redirecting", () => {
      renderWithRouter("/specialist", { user: { id: "1" }, role: "staff", loading: false });
      expect(screen.getByRole("heading", { name: /Tiada Kebenaran/i })).toBeInTheDocument();
      expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
      expect(screen.queryByText("Specialist page")).not.toBeInTheDocument();
    });

    it("shows no-permission view for staff on /fulfilment instead of redirecting", () => {
      renderWithRouter("/fulfilment", { user: { id: "1" }, role: "staff", loading: false });
      expect(screen.getByRole("heading", { name: /Tiada Kebenaran/i })).toBeInTheDocument();
      expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
      expect(screen.queryByText("Permintaan Baharu page")).not.toBeInTheDocument();
    });

    it("allows specialist role to see /specialist page", () => {
      renderWithRouter("/specialist", { user: { id: "1" }, role: "specialist", loading: false });
      expect(screen.getByText("Specialist page")).toBeInTheDocument();
      expect(screen.queryByText(/Tiada Kebenaran/i)).not.toBeInTheDocument();
    });

    it("allows pharmacist role to see /fulfilment page", () => {
      renderWithRouter("/fulfilment", { user: { id: "1" }, role: "pharmacist", loading: false });
      expect(screen.getByText("Permintaan Baharu page")).toBeInTheDocument();
      expect(screen.queryByText(/Tiada Kebenaran/i)).not.toBeInTheDocument();
    });
  });
});
