/**
 * Tests for profiles.js and loadProfile.js.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { getPreset, listPresets } = require("../src/profiles");
const { parseProfile, loadProfileFile, loadProfilesFile } = require("../src/loadProfile");

test("preset daily energies are hand-computed sums of the hourly arrays", () => {
  // rumah-kecil: 6×50 + 650 + 280 + 910 + 450 = 2590
  assert.equal(getPreset("rumah-kecil").hourly.reduce((s, w) => s + w, 0), 2590);
  // kantor-kecil: 420 + 300+800+1200+1400+1400+1300+1400+1400+1400+1200+700+250+100+80+60+60+60 = 13530
  assert.equal(getPreset("kantor-kecil").hourly.reduce((s, w) => s + w, 0), 13530);
  // iot-offgrid: 48 + 27 + 100 + 150 = 325
  assert.equal(getPreset("iot-offgrid").hourly.reduce((s, w) => s + w, 0), 325);
});

test("preset peak load and peak hour", () => {
  const p = getPreset("rumah-kecil");
  assert.equal(Math.max(...p.hourly), 320);
  assert.equal(p.hourly.indexOf(320), 18);
});

test("listPresets reports 5 presets with daily Wh and peak W", () => {
  const list = listPresets();
  assert.equal(list.length, 5);
  assert.ok(list.every((p) => p.dailyWh > 0 && p.peakW > 0));
});

test("unknown preset throws", () => {
  assert.throws(() => getPreset("istana"), /Unknown preset/);
});

test("parseProfile accepts a valid hourly profile and computes totals", () => {
  const hourly = new Array(24).fill(100);
  const p = parseProfile({ name: "Flat 100 W", hourly });
  assert.equal(p.dailyWh, 2400);
  assert.equal(p.peakW, 100);
  assert.equal(p.peakHour, 0);
  assert.equal(p.nightWh, 1200); // 6 h night (00-05) + 6 h evening (18-23)
});

test("parseProfile rejects wrong length, negatives and all-zero", () => {
  assert.throws(() => parseProfile({ name: "x", hourly: [1, 2, 3] }), /exactly 24/);
  assert.throws(() => parseProfile({ name: "x", hourly: new Array(24).fill(-5) }), /non-negative/);
  assert.throws(() => parseProfile({ name: "x", hourly: new Array(24).fill(0) }), /> 0 Wh/);
  assert.throws(() => parseProfile({ name: "x" }), /needs either/);
});

test("parseProfile builds hourly from appliances (hours list)", () => {
  const p = parseProfile({
    name: "Lamp",
    appliances: [{ name: "Lamp", watts: 60, hours: [18, 19, 20, 21] }],
  });
  assert.equal(p.dailyWh, 240);
  assert.equal(p.hourly[18], 60);
  assert.equal(p.hourly[12], 0);
});

test("parseProfile builds hourly from appliances (startHour + hoursPerDay)", () => {
  const p = parseProfile({
    name: "AC",
    appliances: [{ name: "AC", watts: 750, startHour: 22, hoursPerDay: 3.5 }],
  });
  assert.equal(p.dailyWh, 750 * 3.5);
  assert.equal(p.hourly[22], 750);
  assert.equal(p.hourly[1], 750 * 0.5); // fractional hour wraps past midnight
});

test("loadProfileFile reads the example files", () => {
  const dir = path.join(__dirname, "..", "examples");
  const rumah = loadProfileFile(path.join(dir, "rumah-kecil.json"));
  assert.equal(rumah.dailyWh, 2590);
  const warung = loadProfileFile(path.join(dir, "warung-appliances.json"));
  assert.ok(warung.dailyWh > 0);
  // Freezer 200×17 + lamp 60×14 + fan 50×12 + blender 300 + rice 350 + fridge 120×12 = 6930
  assert.equal(warung.dailyWh, 6930);
});

test("loadProfilesFile reads a batch array", () => {
  const dir = path.join(__dirname, "..", "examples");
  const profiles = loadProfilesFile(path.join(dir, "batch-compare.json"));
  assert.equal(profiles.length, 3);
  assert.deepEqual(profiles.map((p) => p.dailyWh), [2590, 5950, 13530]);
});

test("loadProfileFile rejects missing file and bad JSON", () => {
  assert.throws(() => loadProfileFile("/tmp/does-not-exist-xyz.json"), /Cannot read/);
});
