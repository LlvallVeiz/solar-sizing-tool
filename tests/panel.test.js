/**
 * Tests for panel.js — losses and array sizing.
 * Hand checks: at T_amb 28 °C, NOCT 45 °C, G 1000 W/m²:
 *   T_cell = 28 + 25/800×1000 = 59.25 °C
 *   f_temp = 1 − 0.004×(59.25−25) = 0.863
 *   PR (battery 0.90) = 0.863×0.95×0.98×0.95×0.98×0.90 = 0.6732
 *   PR (LFP 0.92)     = 0.6732/0.90×0.92 = 0.6882
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { cellTemperature, temperatureFactor, performanceRatio, sizePanel } = require("../src/panel");

test("cell temperature follows the NOCT model", () => {
  assert.equal(cellTemperature(28), 59.25);
  assert.equal(cellTemperature(25, 45, 800), 50);
});

test("temperature factor at STC is 1, hot cell derates", () => {
  assert.equal(temperatureFactor(25), 1);
  assert.ok(Math.abs(temperatureFactor(59.25) - 0.863) < 1e-9);
  assert.ok(temperatureFactor(75) < temperatureFactor(59.25));
});

test("performance ratio hand-check (default losses, battery 0.90)", () => {
  const { pr, cellTempC, factors } = performanceRatio({ batteryRoundTrip: 0.9 });
  assert.equal(cellTempC, 59.3); // 59.25 rounded to 1 decimal
  assert.ok(Math.abs(factors.temperature - 0.863) < 1e-9);
  assert.ok(Math.abs(pr - 0.6732) < 0.001);
});

test("performance ratio without battery is higher", () => {
  const withBatt = performanceRatio({ batteryRoundTrip: 0.9 }).pr;
  const noBatt = performanceRatio({ includeBattery: false }).pr;
  assert.ok(Math.abs(noBatt - withBatt / 0.9) < 1e-9);
  assert.ok(noBatt > withBatt);
});

test("panel sizing hand-check: rumah-kecil, Jakarta, LFP", () => {
  // PR with LFP round-trip 0.92 ≈ 0.6882; required = 2590/(4.64×0.6882) ≈ 811 Wp
  const panel = sizePanel({ dailyWh: 2590, psh: 4.64, pr: 0.6882, panelW: 550 });
  assert.ok(Math.abs(panel.requiredWp - 811.1) < 1);
  assert.equal(panel.panelCount, 2);
  assert.equal(panel.installedWp, 1100);
  // yield = 1100 × 4.64 × 0.6882 ≈ 3512 Wh
  assert.ok(Math.abs(panel.dailyYieldWh - 3512.5) < 2);
  assert.ok(panel.coverage > 1.3);
});

test("panel count rounds up to at least one panel", () => {
  const tiny = sizePanel({ dailyWh: 50, psh: 5, pr: 0.7, panelW: 550 });
  assert.equal(tiny.panelCount, 1);
  const exact = sizePanel({ dailyWh: 550 * 5 * 0.7, psh: 5, pr: 0.7, panelW: 550 });
  assert.equal(exact.panelCount, 1);
});

test("invalid inputs throw", () => {
  assert.throws(() => sizePanel({ dailyWh: 0, psh: 5, pr: 0.7 }), /> 0 Wh/);
  assert.throws(() => sizePanel({ dailyWh: 100, psh: 0, pr: 0.7 }), /Peak sun hours/);
  assert.throws(() => sizePanel({ dailyWh: 100, psh: 5, pr: 1.5 }), /Performance ratio/);
  assert.throws(() => sizePanel({ dailyWh: 100, psh: 5, pr: 0.7, panelW: 0 }), /Panel wattage/);
});
