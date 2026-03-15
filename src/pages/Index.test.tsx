import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Index from "./Index";

// Mock Supabase — return real drugs/transactions so computed stock runs
// The component falls back to generateMockDrugs() when drugs query returns empty/undefined,
// and that mock data includes KRITIKAL, RENDAH, LEBIHAN statuses (uppercase Malay).
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          is: vi.fn(() => Promise.resolve({ data: [], error: null, count: 0 })),
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));


function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderIndex() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <QueryClientProvider client={makeQueryClient()}>
        <Index />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("Index dashboard English text", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders status badge 'CRITICAL' (currently 'KRITIKAL')", () => {
    renderIndex();
    // Mock data generates drugs with status "KRITIKAL" — FAILS until ENGL-03 translation
    const criticalBadges = screen.getAllByText("CRITICAL");
    expect(criticalBadges.length).toBeGreaterThan(0);
  });

  it("renders status badge 'LOW' (currently 'RENDAH')", () => {
    renderIndex();
    // Mock data generates drugs with status "RENDAH" — FAILS until ENGL-03 translation
    const lowBadges = screen.getAllByText("LOW");
    expect(lowBadges.length).toBeGreaterThan(0);
  });

  it("renders status badge 'EXCESS' (currently 'LEBIHAN')", () => {
    renderIndex();
    // Mock data generates drugs with status "LEBIHAN" — FAILS until ENGL-03 translation
    const excessBadges = screen.getAllByText("EXCESS");
    expect(excessBadges.length).toBeGreaterThan(0);
  });

  it("renders column header 'Drug Name' (currently 'Nama Ubat')", () => {
    renderIndex();
    // Table header — FAILS until ENGL-03 translation
    expect(screen.getByRole("columnheader", { name: "Drug Name" })).toBeInTheDocument();
  });

  it("renders column header 'Actions' (currently 'Tindakan')", () => {
    renderIndex();
    // Table header — FAILS until ENGL-03 translation
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();
  });
});
