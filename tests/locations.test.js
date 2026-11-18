/**
 * Tests for locations.js — NASA POWER reference data.
 * Values were fetched from the NASA POWER API (ALLSKY_SFC_SW_DWN,
 * monthly means 2020–2024) on 2026-11-18; see docs/RESEARCH.md.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { getLocation, listLocations, worstMonthPsh, LOCATIONS } = require("../src/locations");

test("every location has 12 monthly values in a sane range", () => {
  for (const [key, loc] of Object.entries(LOCATIONS)) {
    assert.equal(loc.monthly.length, 12, key);
    for (const v of loc.monthly) assert.ok(v > 0 && v < 10, `${key}: ${v}`);
    assert.ok(loc.annual > 0 && loc.annual < 10, key);
  }
});

test("annual is the mean of the 12 monthly values (Jakarta)", () => {
  const jkt = getLocation("jakarta");
  const sum = jkt.monthly.reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(jkt.annual - sum / 12) < 1e-9);
  assert.ok(Math.abs(jkt.annual - 4.64) < 0.01); // hand sum: 55.68/12 = 4.64
});

test("Jakarta monthly values match the NASA POWER fetch", () => {
  const jkt = getLocation("jakarta");
  assert.deepEqual(jkt.monthly, [4.37, 4.29, 4.65, 4.75, 4.41, 4.22, 4.59, 5.01, 5.29, 5.11, 4.58, 4.41]);
});

test("worst month of Jakarta is June (4.22 h)", () => {
  const worst = worstMonthPsh(getLocation("jakarta"));
  assert.equal(worst.month, "Jun");
  assert.equal(worst.psh, 4.22);
});

test("Berlin shows strong seasonality, Denpasar the highest Indonesian annual", () => {
  const berlin = getLocation("berlin");
  assert.ok(berlin.annual < 3.1);
  assert.ok(Math.min(...berlin.monthly) < 1); // December 0.48 h
  const denpasar = getLocation("denpasar");
  assert.ok(denpasar.annual > 5.4);
  const idAnnuals = ["jakarta", "surabaya", "bandung", "yogyakarta", "medan", "makassar", "denpasar", "semarang"]
    .map((k) => getLocation(k).annual);
  assert.equal(Math.max(...idAnnuals), denpasar.annual);
});

test("lookup is case-insensitive and accepts spaces", () => {
  assert.equal(getLocation("Jakarta").name, "Jakarta");
  assert.equal(getLocation("new york").name, "New York");
  assert.equal(getLocation("NEW_YORK").name, "New York");
});

test("unknown location throws InputError", () => {
  assert.throws(() => getLocation("atlantis"), /Unknown location/);
});

test("listLocations returns one row per location", () => {
  assert.equal(listLocations().length, Object.keys(LOCATIONS).length);
  assert.ok(listLocations().every((l) => l.annualPsh > 0));
});
