import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MoDashboard from "./MoDashboard";

const resolved = (data: unknown[] = []) => Promise.resolve({ data, error: null });

const mockChain = () => {
  const chain: Record<string, unknown> = {};
  const terminal = () => resolved();
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => terminal());
  chain.gte = vi.fn(() => chain);
  chain.lt = vi.fn(() => terminal());
  // make chain itself a thenable so Promise.all works
  (chain as unknown as Promise<unknown>).then = (res: (v: unknown) => unknown) =>
    resolved().then(res);
  (chain as unknown as Promise<unknown>).catch = (_: unknown) => resolved();
  return chain;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => mockChain()),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    user: { id: "mo-1" },
    role: "mo",
    profile: { full_name: "Dr. Azman" },
    loading: false,
  })),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

describe("MoDashboard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders Quota Remaining column header", async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={makeQC()}>
          <MoDashboard />
        </QueryClientProvider>
      </MemoryRouter>
    );
    // Wait for async queries to resolve and table to render
    const header = await screen.findByText(/Quota Remaining/i);
    expect(header).toBeInTheDocument();
  });
});
