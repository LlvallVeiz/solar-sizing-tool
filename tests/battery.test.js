/**
 * Tests for battery.js.
 * Hand checks for rumah-kecil (2590 Wh/day, 2 days autonomy, 28 °C):
 *   LFP:   temp factor 1+0.003×3 = 1.009; nominal = 5180/(0.8×1.009) ≈ 6417 Wh → 267.4 Ah @ 24 V
 *   Lead:  temp factor 1+0.006×3 = 1.018; nominal = 5180/(0.5×1.018) ≈ 10177 Wh → 424.0 Ah @ 24 V
 *   NMC:   nominal = 5180/(0.85×1.009) ≈ 6039 Wh
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { getChemistry, temperatureCapacityFactor, sizeBattery, autonomyFromBank } = require("../src/battery");

test("chemistry table has the documented DoD and round-trip values", () => {
  assert.equal(getChemistry("lead_acid").dod, 0.5);
  assert.equal(getChemistry("lead_acid").roundTrip, 0.8);
  assert.equal(getChemistry("lifepo4").dod, 0.8);
  assert.equal(getChemistry("lifepo4").roundTrip, 0.92);
  assert.equal(getChemistry("nmc").dod, 0.85);
  assert.equal(getChemistry("nmc").roundTrip, 0.9);
});

test("unknown chemistry throws", () => {
  assert.throws(() => getChemistry("sodium"), /Unknown battery chemistry/);
});

test("temperature capacity factor: 1.0 at 25 °C, lead-acid more sensitive", () => {
  assert.equal(temperatureCapacityFactor("lifepo4", 25), 1);
  assert.equal(temperatureCapacityFactor("lead_acid", 25), 1);
  assert.ok(temperatureCapacityFactor("lead_acid", 0) < temperatureCapacityFactor("lifepo4", 0));
  assert.ok(temperatureCapacityFactor("lead_acid", 0) >= 0.7); // clamped
});

test("LiFePO4 sizing hand-check", () => {
  const b = sizeBattery({ dailyWh: 2590, autonomyDays: 2, chemistry: "lifepo4", voltage: 24, ambientC: 28 });
  assert.equal(b.usableWh, 5180);
  assert.ok(Math.abs(b.nominalWh - 6417) < 5);
  assert.ok(Math.abs(b.nominalKwh - 6.417) < 0.01);
  assert.ok(Math.abs(b.capacityAh - 267.4) < 1);
});

test("lead-acid needs roughly twice the nominal capacity of LFP", () => {
  const lfp = sizeBattery({ dailyWh: 2590, autonomyDays: 2, chemistry: "lifepo4", voltage: 24, ambientC: 28 });
  const la = sizeBattery({ dailyWh: 2590, autonomyDays: 2, chemistry: "lead_acid", voltage: 24, ambientC: 28 });
  assert.ok(Math.abs(la.nominalWh - 10177) < 5);
  assert.ok(la.nominalWh / lfp.nominalWh > 1.5);
  assert.ok(Math.abs(la.capacityAh - 424.0) < 1);
});

test("NMC sizing hand-check", () => {
  const b = sizeBattery({ dailyWh: 2590, autonomyDays: 2, chemistry: "nmc", voltage: 48, ambientC: 28 });
  assert.ok(Math.abs(b.nominalWh - 6039) < 5);
  assert.ok(Math.abs(b.capacityAh - 125.8) < 1);
});

test("autonomy scales linearly with bank size", () => {
  const one = autonomyFromBank({ nominalWh: 6417, chemistry: "lifepo4", dailyWh: 2590, ambientC: 28 });
  assert.ok(Math.abs(one.days - 2) < 0.02);
  const half = autonomyFromBank({ nominalWh: 3208.5, chemistry: "lifepo4", dailyWh: 2590, ambientC: 28 });
  assert.ok(Math.abs(half.days - 1) < 0.02);
});

test("invalid voltage and autonomy throw", () => {
  assert.throws(() => sizeBattery({ dailyWh: 100, autonomyDays: 2, voltage: 36 }), /System voltage/);
  assert.throws(() => sizeBattery({ dailyWh: 100, autonomyDays: 0 }), /Autonomy days/);
});
