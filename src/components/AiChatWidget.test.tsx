import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AiChatWidget from "./AiChatWidget";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: { access_token: "tok" } }, error: null })
      ),
    },
    functions: {
      invoke: vi.fn(() => Promise.resolve({ data: { answer: "Test answer" }, error: null })),
    },
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(() => ({ role: "fms", user: { id: "u1" } })),
}));

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("AiChatWidget", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders floating chat button", () => {
    render(
      <QueryClientProvider client={makeQC()}>
        <AiChatWidget />
      </QueryClientProvider>
    );
    expect(screen.getByRole("button", { name: /ask ai/i })).toBeInTheDocument();
  });

  it("opens panel when button clicked", () => {
    render(
      <QueryClientProvider client={makeQC()}>
        <AiChatWidget />
      </QueryClientProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: /ask ai/i }));
    expect(screen.getByPlaceholderText(/ask a question/i)).toBeInTheDocument();
  });

  it("shows character count", () => {
    render(
      <QueryClientProvider client={makeQC()}>
        <AiChatWidget />
      </QueryClientProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: /ask ai/i }));
    const input = screen.getByPlaceholderText(/ask a question/i);
    fireEvent.change(input, { target: { value: "Hello" } });
    expect(screen.getByText(/5 \/ 500/)).toBeInTheDocument();
  });
});
