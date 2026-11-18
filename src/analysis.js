/**
 * analysis.js — tilt optimisation, monthly variation, sensitivity and
 * feasibility checks.
 *
 * Tilt (rules of thumb, see docs/RESEARCH.md):
 * - Annual fixed tilt ≈ |latitude|; winter ≈ |latitude| + 15°,
 *   summer ≈ |latitude| − 15° (clamped to [0°, 60°]).
 * - Within ~15° of the equator the gain from tilting is small, so a
 *   10–15° tilt is recommended mainly so rain washes dust off.
 * - The rough tilt-gain estimate (gain over a horizontal array) is
 *   0.01 + 0.002 × |lat|, capped at 0.15 — a planning heuristic, not a
 *   transposition-model result; PVGIS/SAM should be used for a bankable
 *   number.
 *
 * Monthly: recompute the required array size for each month's PSH and
 * the expected annual production of an installed array.
 *
 * Sensitivity: recompute panel + battery size while sweeping PSH
 * (±20%) and load (±20%), one factor at a time plus the worst corner.
 *
 * Feasibility ("check"): given an installed array (Wp) and battery
 * (kWh), decide whether the autonomy target is met in the worst month.
 */
"use strict";

const { InputError } = require("./errors");
const { round } = require("./units");
const { MONTHS } = require("./locations");
const { sizePanel } = require("./panel");
const { sizeBattery, autonomyFromBank } = require("./battery");

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Optimal fixed tilt angles for a latitude (degrees). */
function optimalTilt(latitude) {
  const abs = Math.abs(latitude);
  const annual = abs < 15 ? 10 : round(abs, 1);
  return {
    latitude: round(latitude, 2),
    annual,
    summer: Math.max(0, round(abs - 15, 1)),
    winter: Math.min(60, round(abs + 15, 1)),
    // Facing the equator: south in the northern hemisphere, north in the southern.
    facing: latitude >= 0 ? "South" : "North",
    // Rough planning heuristic for the gain of an optimally tilted fixed
    // array over a horizontal one (fraction, not a simulated value).
    estimatedGainVsHorizontal: round(Math.min(0.15, 0.01 + 0.002 * abs), 3),
  };
}

/**
 * Monthly sizing table: required array Wp per month and the expected
 * production of a given installed array.
 */
function monthlyAnalysis({ dailyWh, location, pr, installedWp = null }) {
  if (!(dailyWh > 0)) throw new InputError(`Daily energy must be > 0 Wh, got ${dailyWh}.`);
  const months = location.monthly.map((psh, i) => {
    const required = sizePanel({ dailyWh, psh, pr, panelW: 550 });
    const productionWh = installedWp !== null ? installedWp * psh * pr : null;
    return {
      month: MONTHS[i],
      psh,
      requiredWp: required.requiredWp,
      panelCount550W: required.panelCount,
      productionWhPerDay: productionWh !== null ? round(productionWh, 1) : null,
      coverage: productionWh !== null ? round(productionWh / dailyWh, 3) : null,
    };
  });
  const worst = months.reduce((a, b) => (a.psh < b.psh ? a : b));
  const best = months.reduce((a, b) => (a.psh > b.psh ? a : b));
  const annualProductionKwh = installedWp !== null
    ? round(
        months.reduce((sum, m, i) => sum + installedWp * m.psh * pr * DAYS_IN_MONTH[i], 0) / 1000,
        1
      )
    : null;
  return { months, worstMonth: worst, bestMonth: best, annualProductionKwh };
}

/** One-factor-at-a-time sensitivity of the array and battery size. */
function sensitivityAnalysis({ dailyWh, psh, pr, autonomyDays, chemistry, voltage, panelW = 550 }) {
  const basePanel = sizePanel({ dailyWh, psh, pr, panelW });
  const baseBattery = sizeBattery({ dailyWh, autonomyDays, chemistry, voltage });
  const scenarios = [];
  const cases = [
    { label: "PSH −20%", pshFactor: 0.8, loadFactor: 1 },
    { label: "PSH +20%", pshFactor: 1.2, loadFactor: 1 },
    { label: "Load −20%", pshFactor: 1, loadFactor: 0.8 },
    { label: "Load +20%", pshFactor: 1, loadFactor: 1.2 },
    { label: "Worst case (PSH −20%, load +20%)", pshFactor: 0.8, loadFactor: 1.2 },
    { label: "Best case (PSH +20%, load −20%)", pshFactor: 1.2, loadFactor: 0.8 },
  ];
  for (const c of cases) {
    const load = dailyWh * c.loadFactor;
    const panel = sizePanel({ dailyWh: load, psh: psh * c.pshFactor, pr, panelW });
    const battery = sizeBattery({ dailyWh: load, autonomyDays, chemistry, voltage });
    scenarios.push({
      label: c.label,
      dailyWh: round(load, 1),
      psh: round(psh * c.pshFactor, 2),
      requiredWp: panel.requiredWp,
      panelCount: panel.panelCount,
      batteryKwh: battery.nominalKwh,
      batteryAh: battery.capacityAh,
    });
  }
  return {
    base: {
      dailyWh, psh, requiredWp: basePanel.requiredWp, panelCount: basePanel.panelCount,
      batteryKwh: baseBattery.nominalKwh, batteryAh: baseBattery.capacityAh,
    },
    scenarios,
  };
}

/**
 * Feasibility check for an existing/planned installation.
 * `batteryKwh` is the nominal (nameplate) bank size.
 */
function feasibilityCheck({ dailyWh, location, pr, installedWp, batteryKwh, chemistry, autonomyDays, voltage = 24 }) {
  if (!(installedWp > 0)) throw new InputError(`Installed array must be > 0 Wp, got ${installedWp}.`);
  if (!(batteryKwh > 0)) throw new InputError(`Battery size must be > 0 kWh, got ${batteryKwh}.`);
  const worst = Math.min(...location.monthly);
  const worstYield = installedWp * worst * pr;
  const annualYield = installedWp * location.annual * pr;
  const autonomy = autonomyFromBank({ nominalWh: batteryKwh * 1000, chemistry, dailyWh });
  const checks = [];
  checks.push({
    name: "Worst-month energy balance",
    ok: worstYield >= dailyWh,
    detail: `Worst month yields ${round(worstYield, 0)} Wh/day vs ${round(dailyWh, 0)} Wh/day needed.`,
  });
  checks.push({
    name: "Annual energy balance",
    ok: annualYield >= dailyWh,
    detail: `Annual average yields ${round(annualYield, 0)} Wh/day vs ${round(dailyWh, 0)} Wh/day needed.`,
  });
  checks.push({
    name: `Autonomy target (${autonomyDays} day${autonomyDays > 1 ? "s" : ""})`,
    ok: autonomy.days >= autonomyDays,
    detail: `Bank provides ${autonomy.days} days of autonomy (${autonomy.usableWh} Wh usable).`,
  });
  const passed = checks.every((c) => c.ok);
  return {
    passed,
    verdict: passed ? "FEASIBLE" : "NOT FEASIBLE",
    worstMonthPsh: worst,
    worstMonthYieldWh: round(worstYield, 1),
    annualYieldWh: round(annualYield, 1),
    autonomyDaysAchieved: autonomy.days,
    usableBatteryWh: autonomy.usableWh,
    checks,
  };
}

module.exports = { DAYS_IN_MONTH, optimalTilt, monthlyAnalysis, sensitivityAnalysis, feasibilityCheck };
