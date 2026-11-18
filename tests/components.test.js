/**
 * Tests for components.js — controller, inverter, cable.
 * Hand checks:
 * - Controller: 2 × 550 W panels in parallel, Isc 14 A each → array Isc 28 A,
 *   required = 28 × 1.25 = 35 A; Voc 49.6 V → max input 62 V.
 * - Inverter: peak 320 W → continuous 400 W, surge 960 W (3× default).
 * - Cable: 28 A, 10 m, 24 V → 16 mm² is the smallest standard size with
 *   drop ≤ 3% (drop at 16 mm² = 28×2×10×0.0171/16 = 0.599 V = 2.49%).
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { sizeController, sizeInverter, cableVoltageDrop, pickCable } = require("../src/components");

test("controller current follows NEC 690.8 (Isc × 1.25)", () => {
  const c = sizeController({ panelIsc: 14, panelVoc: 49.6, panelsSeries: 1, panelsParallel: 2, systemVoltage: 24, arrayVmp: 41.7, arrayWp: 1100 });
  assert.equal(c.arrayIscA, 28);
  assert.equal(c.requiredCurrentA, 35);
  assert.equal(c.recommendedCurrentA, 35);
  assert.equal(c.arrayVocV, 49.6);
  assert.equal(c.maxInputVoltageV, 62);
  assert.equal(c.type, "MPPT");
});

test("small 12 V array with Vmp near battery voltage may use PWM", () => {
  const c = sizeController({ panelIsc: 6.11, panelVoc: 21.6, panelsSeries: 1, panelsParallel: 1, systemVoltage: 12, arrayVmp: 17.8, arrayWp: 100 });
  assert.equal(c.type, "PWM");
});

test("inverter sizing: 1.25× continuous, 3× surge by default", () => {
  const inv = sizeInverter({ peakW: 320 });
  assert.equal(inv.continuousW, 400);
  assert.equal(inv.surgeW, 960);
  assert.equal(inv.recommendedContinuousW, 400);
});

test("inverter respects an explicit surge value", () => {
  const inv = sizeInverter({ peakW: 1400, surgeW: 5000 });
  assert.equal(inv.continuousW, 1750);
  assert.equal(inv.surgeW, 5000);
});

test("cable voltage drop hand-check", () => {
  const d = cableVoltageDrop({ currentA: 28, lengthM: 10, areaMm2: 16, voltageV: 24 });
  assert.ok(Math.abs(d.dropV - 0.599) < 0.01);
  assert.ok(Math.abs(d.dropPct - 2.49) < 0.02);
  assert.equal(d.ok, true);
  const thin = cableVoltageDrop({ currentA: 28, lengthM: 10, areaMm2: 4, voltageV: 24 });
  assert.equal(thin.ok, false);
  assert.ok(thin.dropPct > 3);
});

test("pickCable returns the smallest passing standard size", () => {
  const c = pickCable({ currentA: 28, lengthM: 10, voltageV: 24 });
  assert.equal(c.areaMm2, 16);
  assert.equal(c.ok, true);
  const small = pickCable({ currentA: 5, lengthM: 5, voltageV: 24 });
  assert.equal(small.areaMm2, 1.5);
});

test("invalid inputs throw", () => {
  assert.throws(() => sizeController({ panelIsc: 0, panelVoc: 20 }), /Isc/);
  assert.throws(() => sizeInverter({ peakW: 0 }), /Peak load/);
  assert.throws(() => cableVoltageDrop({ currentA: 5, lengthM: 0, areaMm2: 4, voltageV: 24 }), /length/);
});
