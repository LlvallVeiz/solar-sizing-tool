/**
 * Tests for the CLI (src/cli.js run() in-process) and report rendering.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { run } = require("../src/cli");
const { renderSystemText, renderSystemsCsv } = require("../src/report");
const lib = require("../src/index");

test("size command prints the key numbers (text)", () => {
  const out = run(["size", "--preset", "rumah-kecil", "--location", "jakarta"]);
  assert.match(out, /Rumah tangga kecil/);
  assert.match(out, /Jakarta/);
  assert.match(out, /2 × 550 W/);
  assert.match(out, /LiFePO4/);
  assert.match(out, /TOTAL \(estimate\)/);
});

test("size command JSON output parses and matches the library result", () => {
  const out = run(["size", "--preset", "rumah-kecil", "--location", "jakarta", "--format", "json"]);
  const parsed = JSON.parse(out);
  assert.equal(parsed.panel.panelCount, 2);
  assert.equal(parsed.profile.dailyWh, 2590);
  assert.ok(Math.abs(parsed.location.annualPsh - 4.64) < 0.01);
});

test("size command CSV output has a header and one data row", () => {
  const out = run(["size", "--preset", "iot-offgrid", "--location", "denpasar", "--format", "csv"]);
  const lines = out.trim().split("\n");
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^profile,location,daily_wh/);
  assert.match(lines[1], /Node IoT off-grid,Denpasar,325/);
});

test("size honours --worst-month, --chemistry and --voltage", () => {
  const out = run(["size", "--preset", "rumah-kecil", "--location", "jakarta", "--worst-month", "--chemistry", "lead_acid", "--voltage", "48", "--format", "json"]);
  const parsed = JSON.parse(out);
  assert.equal(parsed.location.pshBasis, "worst month");
  assert.equal(parsed.battery.chemistry, "lead_acid");
  assert.equal(parsed.battery.voltage, 48);
  assert.ok(parsed.panel.requiredWp > 811); // worst month PSH 4.22 < annual 4.64
});

test("tilt command for Jakarta and for an explicit latitude", () => {
  const jkt = run(["tilt", "--location", "jakarta"]);
  assert.match(jkt, /10°/);
  assert.match(jkt, /North/);
  const berlin = run(["tilt", "--lat", "52.52"]);
  assert.match(berlin, /52\.5°/);
  assert.match(berlin, /South/);
});

test("monthly command lists 12 months with June as worst", () => {
  const out = run(["monthly", "--preset", "rumah-kecil", "--location", "jakarta"]);
  assert.match(out, /Worst month: Jun/);
  assert.match(out, /Best month : Sep/);
  for (const m of ["Jan", "Jun", "Dec"]) assert.match(out, new RegExp(m));
});

test("sensitivity command shows worst and best cases", () => {
  const out = run(["sensitivity", "--preset", "rumah-kecil", "--location", "jakarta"]);
  assert.match(out, /Worst case/);
  assert.match(out, /Best case/);
});

test("check command: feasible system passes, undersized fails", () => {
  const pass = run(["check", "--preset", "rumah-kecil", "--location", "jakarta", "--panels", "2", "--panel-w", "550", "--battery-kwh", "7.68"]);
  assert.match(pass, /Verdict: FEASIBLE/);
  const fail = run(["check", "--preset", "rumah-kecil", "--location", "jakarta", "--panels", "1", "--panel-w", "550", "--battery-kwh", "7.68"]);
  assert.match(fail, /Verdict: NOT FEASIBLE/);
  assert.match(fail, /FAIL/);
});

test("compare command ranks presets and names the cheapest", () => {
  const out = run(["compare", "--preset", "rumah-kecil,warung", "--location", "jakarta"]);
  assert.match(out, /COMPARISON/);
  assert.match(out, /Cheapest:/);
});

test("compare with a batch profile file works", () => {
  const out = run(["compare", "--profile", "examples/batch-compare.json", "--location", "jakarta"]);
  assert.match(out, /Rumah kecil/);
  assert.match(out, /Kantor kecil/);
});

test("unknown command and missing profile are input errors", () => {
  assert.throws(() => run(["frobnicate"]), /Unknown command/);
  assert.throws(() => run(["size"]), /Need a load profile/);
  assert.throws(() => run(["size", "--preset", "nope"]), /Unknown preset/);
  assert.throws(() => run(["size", "--preset", "rumah-kecil", "--format", "yaml"]), /Unknown --format/);
});

test("no arguments prints usage", () => {
  assert.match(run([]), /Usage:/);
});

test("report renders text and CSV for a sized system", () => {
  const profile = { name: "Test", hourly: new Array(24).fill(100), dailyWh: 2400, peakW: 100, peakHour: 0, nightWh: 1200 };
  const s = lib.sizeSystem(profile, { location: "jakarta" });
  const text = renderSystemText(s);
  assert.match(text, /SOLAR SIZING/);
  assert.match(text, /PV ARRAY/);
  const csv = renderSystemsCsv([s]);
  assert.equal(csv.trim().split("\n").length, 2);
});
