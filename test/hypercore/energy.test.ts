import { describe, expect, it } from "vitest";
import {
  DEGRADATION_ORDER,
  EnergyLedger,
  estimateFromExperts,
  governMode,
  modeProfile,
} from "../../src/hypercore/energy";
import { DEFAULT_ENERGY_BUDGET, type EnergyEstimate } from "../../src/hypercore/types";
import { createDefaultExperts } from "../../src/hypercore/micro-moe";

const within: EnergyEstimate = { estimatedLatencyMs: 100, estimatedEnergyKwh: 0.0001 };
const overLatency: EnergyEstimate = { estimatedLatencyMs: 900, estimatedEnergyKwh: 0.0001 };
const overEnergy: EnergyEstimate = { estimatedLatencyMs: 100, estimatedEnergyKwh: 0.5 };

describe("HyperCore Energy Governor", () => {
  it("exposes a profile per mode", () => {
    for (const mode of ["ECO", "CRUISE", "BOOST", "HYPERBOOST", "OMEGA"] as const) {
      expect(modeProfile(mode).mode).toBe(mode);
    }
  });

  it("selects ECO when energy exceeds the budget", () => {
    expect(governMode({ estimate: overEnergy, budget: DEFAULT_ENERGY_BUDGET, critical: false }).mode).toBe("ECO");
    expect(governMode({ estimate: overEnergy, budget: DEFAULT_ENERGY_BUDGET, critical: true }).mode).toBe("ECO");
  });

  it("escalates to HYPERBOOST for critical work within energy budget", () => {
    expect(governMode({ estimate: within, budget: DEFAULT_ENERGY_BUDGET, critical: true }).mode).toBe("HYPERBOOST");
  });

  it("grants OMEGA only for authorized-critical work", () => {
    expect(
      governMode({ estimate: within, budget: DEFAULT_ENERGY_BUDGET, critical: true, authorizedCritical: true }).mode,
    ).toBe("OMEGA");
  });

  it("cruises within latency and boosts when latency is over target", () => {
    expect(governMode({ estimate: within, budget: DEFAULT_ENERGY_BUDGET, critical: false }).mode).toBe("CRUISE");
    expect(governMode({ estimate: overLatency, budget: DEFAULT_ENERGY_BUDGET, critical: false }).mode).toBe("BOOST");
  });

  it("declares a bounded degradation order", () => {
    expect(DEGRADATION_ORDER.length).toBeGreaterThan(0);
    expect(DEGRADATION_ORDER[0]).toBe("reduce_parallelism");
  });

  it("estimates spend from declared expert metadata", () => {
    const estimate = estimateFromExperts(createDefaultExperts());
    expect(estimate.estimatedEnergyKwh).toBeGreaterThan(0);
    expect(estimate.estimatedLatencyMs).toBeGreaterThan(0);
  });

  it("accounts cumulative energy against the carbon budget", () => {
    const ledger = new EnergyLedger(DEFAULT_ENERGY_BUDGET);
    expect(ledger.canSpend(0.001)).toBe(true);
    ledger.spend(0.001);
    expect(ledger.usedEnergyKwh()).toBeCloseTo(0.001);
    expect(ledger.remainingKwh()).toBeCloseTo(DEFAULT_ENERGY_BUDGET.carbonBudgetDailyKwh - 0.001);
  });
});
