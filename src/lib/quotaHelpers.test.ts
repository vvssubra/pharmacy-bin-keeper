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

import { quotaBadgeState, QUOTA_BADGE_CLASS, QUOTA_BADGE_LABEL } from "./quotaHelpers";

describe("quotaBadgeState", () => {
  it("returns 'healthy' when 0/60 used (0%)", () => {
    expect(quotaBadgeState(0, 60)).toBe("healthy");
  });
  it("returns 'healthy' when 47/60 used (78.3% < 80%)", () => {
    expect(quotaBadgeState(47, 60)).toBe("healthy");
  });
  it("returns 'warning' when 48/60 used (80% = threshold)", () => {
    expect(quotaBadgeState(48, 60)).toBe("warning");
  });
  it("returns 'warning' when 59/60 used (98.3%)", () => {
    expect(quotaBadgeState(59, 60)).toBe("warning");
  });
  it("returns 'exhausted' when 60/60 used (100%)", () => {
    expect(quotaBadgeState(60, 60)).toBe("exhausted");
  });
  it("returns 'exhausted' when 65/60 used (over limit)", () => {
    expect(quotaBadgeState(65, 60)).toBe("exhausted");
  });
  it("returns 'no-quota' when limit is null", () => {
    expect(quotaBadgeState(5, null)).toBe("no-quota");
  });
});

describe("QUOTA_BADGE_CLASS", () => {
  it("healthy contains bg-green-100", () => {
    expect(QUOTA_BADGE_CLASS["healthy"]).toContain("bg-green-100");
  });
  it("warning contains bg-amber-100", () => {
    expect(QUOTA_BADGE_CLASS["warning"]).toContain("bg-amber-100");
  });
  it("exhausted contains bg-red-100", () => {
    expect(QUOTA_BADGE_CLASS["exhausted"]).toContain("bg-red-100");
  });
  it("no-quota contains bg-gray-100", () => {
    expect(QUOTA_BADGE_CLASS["no-quota"]).toContain("bg-gray-100");
  });
});

describe("QUOTA_BADGE_LABEL", () => {
  it("healthy returns '45/60 patients'", () => {
    expect(QUOTA_BADGE_LABEL["healthy"](45, 60)).toBe("45/60 patients");
  });
  it("exhausted returns 'Quota Exhausted: 65/60'", () => {
    expect(QUOTA_BADGE_LABEL["exhausted"](65, 60)).toBe("Quota Exhausted: 65/60");
  });
  it("no-quota returns 'No quota set'", () => {
    expect(QUOTA_BADGE_LABEL["no-quota"](0, null)).toBe("No quota set");
  });
});
