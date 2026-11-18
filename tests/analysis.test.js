/**
 * Tests for analysis.js — tilt, monthly, sensitivity, feasibility.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { getLocation } = require("../src/locations");
const { optimalTilt, monthlyAnalysis, sensitivityAnalysis, feasibilityCheck } = require("../src/analysis");

test("tilt: Jakarta (lat −6.21°) — 10° annual, faces north", () => {
  const t = optimalTilt(-6.21);
  assert.equal(t.annual, 10);
  assert.equal(t.summer, 0);
  assert.ok(Math.abs(t.winter - 21.2) < 0.05);
  assert.equal(t.facing, "North");
});

test("tilt: Berlin (lat 52.52°) — annual ≈ latitude, faces south", () => {
  const t = optimalTilt(52.52);
  assert.equal(t.annual, 52.5);
  assert.equal(t.summer, 37.5);
  assert.equal(t.winter, 60); // clamped at 60°
  assert.equal(t.facing, "South");
  assert.ok(t.estimatedGainVsHorizontal > 0.1);
});

test("monthly analysis: Jakarta worst month is June, best is September", () => {
  const a = monthlyAnalysis({ dailyWh: 2590, location: getLocation("jakarta"), pr: 0.6882 });
  assert.equal(a.months.length, 12);
  assert.equal(a.worstMonth.month, "Jun");
  assert.equal(a.bestMonth.month, "Sep");
  // Worst month needs more array than the annual-mean case (811 Wp).
  assert.ok(a.worstMonth.requiredWp > 811);
  assert.ok(a.bestMonth.requiredWp < 811);
});

test("monthly analysis with installed array reports coverage and annual production", () => {
  const a = monthlyAnalysis({ dailyWh: 2590, location: getLocation("jakarta"), pr: 0.6882, installedWp: 1100 });
  assert.ok(a.annualProductionKwh > 1200 && a.annualProductionKwh < 1400);
  // 1100 × 4.64 × 0.6882 × 365 / 1000 ≈ 1282 kWh
  assert.ok(Math.abs(a.annualProductionKwh - 1282) < 5);
  assert.ok(a.months.every((m) => m.coverage > 1)); // 1100 Wp covers the load every month
});

test("sensitivity: worst case needs more panels, best case fewer", () => {
  const s = sensitivityAnalysis({ dailyWh: 2590, psh: 4.64, pr: 0.6882, autonomyDays: 2, chemistry: "lifepo4", voltage: 24 });
  assert.equal(s.base.panelCount, 2);
  const worst = s.scenarios.find((x) => x.label.startsWith("Worst case"));
  const best = s.scenarios.find((x) => x.label.startsWith("Best case"));
  // Worst: 3108 Wh / (3.712 × 0.6882) ≈ 1217 Wp → 3 panels
  assert.equal(worst.panelCount, 3);
  assert.ok(worst.requiredWp > 1200 && worst.requiredWp < 1250);
  assert.equal(best.panelCount, 1); // 2072 Wh / (5.568 h × 0.6882) ≈ 541 Wp < 550 W
  assert.ok(best.requiredWp < s.base.requiredWp);
  // Load +20% grows the battery by exactly 20%.
  const loadUp = s.scenarios.find((x) => x.label === "Load +20%");
  assert.ok(Math.abs(loadUp.batteryKwh - s.base.batteryKwh * 1.2) < 0.01);
});

test("feasibility: 2×550 W + 7.68 kWh LFP passes for rumah-kecil in Jakarta", () => {
  const f = feasibilityCheck({
    dailyWh: 2590, location: getLocation("jakarta"), pr: 0.6882,
    installedWp: 1100, batteryKwh: 7.68, chemistry: "lifepo4", autonomyDays: 2,
  });
  assert.equal(f.passed, true);
  assert.equal(f.verdict, "FEASIBLE");
  assert.ok(f.autonomyDaysAchieved > 2);
});

test("feasibility: undersized array fails the worst-month check", () => {
  const f = feasibilityCheck({
    dailyWh: 2590, location: getLocation("jakarta"), pr: 0.6882,
    installedWp: 550, batteryKwh: 7.68, chemistry: "lifepo4", autonomyDays: 2,
  });
  assert.equal(f.passed, false);
  assert.equal(f.checks[0].ok, false); // worst-month balance
  assert.equal(f.checks[2].ok, true); // autonomy still fine
});

test("feasibility: tiny battery fails the autonomy check only", () => {
  const f = feasibilityCheck({
    dailyWh: 2590, location: getLocation("jakarta"), pr: 0.6882,
    installedWp: 1100, batteryKwh: 1.28, chemistry: "lifepo4", autonomyDays: 2,
  });
  assert.equal(f.passed, false);
  assert.equal(f.checks[0].ok, true);
  assert.equal(f.checks[2].ok, false);
});
