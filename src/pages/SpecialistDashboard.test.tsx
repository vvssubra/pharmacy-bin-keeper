import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SpecialistDashboard from "./SpecialistDashboard";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          in: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        in: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(() => ({ role: "fms", user: { id: "u1" }, profile: null, loading: false })),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

describe("SpecialistDashboard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders 'NAG Check' column header in antibiotic forms table", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <QueryClientProvider client={makeQC()}>
          <SpecialistDashboard />
        </QueryClientProvider>
      </MemoryRouter>
    );
    // Click the Antibiotik tab to reveal that table
    await user.click(screen.getByRole("tab", { name: /antibiotic form/i }));
    expect(screen.getByText(/NAG Check/i)).toBeInTheDocument();
  });
});
