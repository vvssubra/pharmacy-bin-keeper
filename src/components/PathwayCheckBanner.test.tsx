import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PathwayCheckBanner from "./PathwayCheckBanner";

describe("PathwayCheckBanner", () => {
  it("renders nothing when idle", () => {
    const { container } = render(
      <PathwayCheckBanner status="idle" verdict={null} explanation="" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows checking indicator", () => {
    render(<PathwayCheckBanner status="checking" verdict={null} explanation="" />);
    expect(screen.getByText(/Checking NAG pathway/i)).toBeInTheDocument();
  });

  it("shows Supported by NAG when verdict is supported", () => {
    render(
      <PathwayCheckBanner status="done" verdict="supported" explanation="Matches UTI pathway Section 3.1" />
    );
    expect(screen.getByText(/Supported by NAG/i)).toBeInTheDocument();
    expect(screen.getByText(/Matches UTI pathway Section 3.1/i)).toBeInTheDocument();
  });

  it("shows Not Supported by NAG when verdict is not_supported", () => {
    render(
      <PathwayCheckBanner status="done" verdict="not_supported" explanation="No pathway supports viral pharyngitis" />
    );
    expect(screen.getByText(/Not Supported by NAG/i)).toBeInTheDocument();
  });

  it("shows unavailable message on error", () => {
    render(<PathwayCheckBanner status="error" verdict={null} explanation="" />);
    expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument();
  });
});
