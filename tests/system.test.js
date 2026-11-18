/**
 * Tests for catalog.js, compare.js and the end-to-end sizeSystem() API.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const lib = require("../src/index");
const { estimateCost, fmtIdr, PANELS, BATTERIES } = require("../src/catalog");

const rumahKecil = {
  name: "Rumah tangga kecil",
  hourly: [50, 50, 50, 50, 50, 50, 150, 180, 120, 80, 60, 60, 90, 60, 60, 70, 90, 220, 320, 280, 200, 120, 80, 50],
  dailyWh: 2590, peakW: 320, peakHour: 18, nightWh: 1350,
};

test("sizeSystem end-to-end: rumah-kecil @ Jakarta, LFP, 24 V", () => {
  const s = lib.sizeSystem(rumahKecil, { location: "jakarta" });
  assert.equal(s.panel.panelCount, 2);
  assert.equal(s.panel.installedWp, 1100);
  assert.ok(Math.abs(s.panel.requiredWp - 811) < 5);
  assert.equal(s.battery.chemistry, "lifepo4");
  assert.ok(Math.abs(s.battery.nominalKwh - 6.417) < 0.02);
  assert.equal(s.controller.type, "MPPT");
  assert.equal(s.controller.requiredCurrentA, 35);
  assert.equal(s.inverter.continuousW, 400);
  assert.equal(s.cable.areaMm2, 16);
  assert.equal(s.tilt.annual, 10);
  assert.ok(s.cost.totalIdr > 0);
});

test("sizeSystem with worst-month sizing needs a bigger array in Berlin", () => {
  const annual = lib.sizeSystem(rumahKecil, { location: "berlin" });
  const worst = lib.sizeSystem(rumahKecil, { location: "berlin", useWorstMonth: true });
  assert.ok(worst.panel.requiredWp > annual.panel.requiredWp);
  // Berlin December PSH 0.48 h: 2590/(0.48×PR) is huge — sanity only.
  assert.ok(worst.panel.panelCount >= 8);
});

test("lead-acid system costs more in batteries than LFP for the same autonomy", () => {
  const lfp = lib.sizeSystem(rumahKecil, { location: "jakarta", chemistry: "lifepo4" });
  const la = lib.sizeSystem(rumahKecil, { location: "jakarta", chemistry: "lead_acid" });
  assert.ok(la.battery.nominalKwh > lfp.battery.nominalKwh);
});

test("48 V system halves the battery amp-hours vs 24 V", () => {
  const v24 = lib.sizeSystem(rumahKecil, { location: "jakarta", voltage: 24 });
  const v48 = lib.sizeSystem(rumahKecil, { location: "jakarta", voltage: 48 });
  assert.ok(Math.abs(v48.battery.capacityAh - v24.battery.capacityAh / 2) < 0.2);
});

test("IoT node needs a single small panel", () => {
  const iot = lib.getPreset("iot-offgrid");
  const profile = { name: iot.name, hourly: iot.hourly, dailyWh: 325, peakW: 25, peakHour: 18, nightWh: 198 };
  const s = lib.sizeSystem(profile, { location: "denpasar", panelW: 100, voltage: 12 });
  assert.equal(s.panel.panelCount, 1);
  assert.equal(s.panel.installedWp, 100);
  assert.ok(s.battery.nominalKwh < 1);
});

test("catalog prices are labelled as examples and IDR formatting works", () => {
  assert.match(estimateCost(lib.sizeSystem(rumahKecil, { location: "jakarta" })).disclaimer, /NOT live market prices/);
  assert.equal(fmtIdr(1234567), "Rp1.234.567");
  assert.equal(fmtIdr(2750000), "Rp2.750.000");
  assert.ok(PANELS.length >= 3 && BATTERIES.length >= 3);
});

test("cost estimate adds 15% balance-of-system on top of the subtotal", () => {
  const s = lib.sizeSystem(rumahKecil, { location: "jakarta" });
  assert.equal(s.cost.bosIdr, Math.round(s.cost.subtotalIdr * 0.15));
  assert.equal(s.cost.totalIdr, s.cost.subtotalIdr + s.cost.bosIdr);
  assert.ok(s.cost.costPerWpIdr > 0);
});

test("compareSystems ranks by cost and reports the array spread", () => {
  const a = lib.sizeSystem(rumahKecil, { location: "jakarta" });
  const b = lib.sizeSystem(rumahKecil, { location: "berlin" });
  const cmp = lib.compareSystems([
    { label: "Jakarta", sizing: a },
    { label: "Berlin", sizing: b },
  ]);
  assert.equal(cmp.cheapestLabel, "Jakarta");
  assert.equal(cmp.smallestArrayLabel, "Jakarta");
  assert.ok(cmp.requiredWpSpread.ratio > 1.5);
});

test("compareSystems needs at least two entries", () => {
  assert.throws(() => lib.compareSystems([{ label: "x", sizing: {} }]), /at least 2/);
});

test("sizeSystem rejects a bad profile and an unknown location", () => {
  assert.throws(() => lib.sizeSystem(null), /parsed profile/);
  assert.throws(() => lib.sizeSystem(rumahKecil, { location: "atlantis" }), /Unknown location/);
});
