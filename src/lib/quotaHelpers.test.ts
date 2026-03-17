import { describe, it, expect } from "vitest";
import { quotaStatus, forecastStatus, projectedExhaustion, daysRemaining } from "./quotaHelpers";

describe("quotaStatus", () => {
  it("returns 'no-quota' when quota row does not exist", () => {
    expect(quotaStatus(null, null)).toBe("no-quota");
  });
  it("returns 'critical' when quota_limit is 0 (exhausted)", () => {
    expect(quotaStatus(0, 0)).toBe("critical");
  });
  it("returns 'critical' when ≤10% remaining", () => {
    expect(quotaStatus(5, 60)).toBe("critical");
  });
  it("returns 'warning' when ≤25% remaining", () => {
    expect(quotaStatus(12, 60)).toBe("warning");
  });
  it("returns 'healthy' when >25% remaining", () => {
    expect(quotaStatus(20, 60)).toBe("healthy");
  });
});

describe("forecastStatus", () => {
  it("returns 'no-data' when days is null", () => {
    expect(forecastStatus(null)).toBe("no-data");
  });
  it("returns 'critical' when <7 days", () => {
    expect(forecastStatus(6)).toBe("critical");
  });
  it("returns 'warning' when <14 days", () => {
    expect(forecastStatus(10)).toBe("warning");
  });
  it("returns 'healthy' when ≥14 days", () => {
    expect(forecastStatus(14)).toBe("healthy");
  });
});

describe("daysRemaining", () => {
  it("returns null when avgDaily is 0", () => {
    expect(daysRemaining(100, 0)).toBeNull();
  });
  it("returns floor of stock / avgDaily", () => {
    expect(daysRemaining(100, 10)).toBe(10);
  });
});

describe("projectedExhaustion", () => {
  it("returns Exhausted when remaining <= 0", () => {
    expect(projectedExhaustion(0, 5)).toBe("Exhausted");
  });
  it("returns No usage data when avgPerMonth is 0", () => {
    expect(projectedExhaustion(10, 0)).toBe("No usage data");
  });
});
