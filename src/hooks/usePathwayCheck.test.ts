import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePathwayCheck } from "./usePathwayCheck";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: { access_token: "tok" } }, error: null })
      ),
    },
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("usePathwayCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() =>
      usePathwayCheck({ diagnosis: "", antibiotic: "", indication: "" })
    );
    expect(result.current.status).toBe("idle");
  });

  it("stays idle when no trigger fields are set", () => {
    const { result } = renderHook(() =>
      usePathwayCheck({ diagnosis: "", antibiotic: "", indication: "" })
    );
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.status).toBe("idle");
  });

  it("transitions to done after debounce when fields are set", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ verdict: "supported", explanation: "Matches UTI pathway" }),
    });

    const { result } = renderHook(() =>
      usePathwayCheck({ diagnosis: "UTI", antibiotic: "Trimethoprim", indication: "Dysuria" })
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.status).toBe("done");
    expect(result.current.verdict).toBe("supported");
    expect(result.current.explanation).toBe("Matches UTI pathway");
  });

  it("sets unavailable status on 503 response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503, json: () => Promise.resolve({}) });

    const { result } = renderHook(() =>
      usePathwayCheck({ diagnosis: "URTI", antibiotic: "Amoxicillin", indication: "Fever" })
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.status).toBe("unavailable");
  });

  it("sets unavailable status on 429 response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429, json: () => Promise.resolve({}) });

    const { result } = renderHook(() =>
      usePathwayCheck({ diagnosis: "UTI", antibiotic: "Trimethoprim", indication: "Dysuria" })
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.status).toBe("unavailable");
  });
});
