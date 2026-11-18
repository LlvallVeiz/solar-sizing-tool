/**
 * report.js — render sizing results as text, CSV or JSON.
 *
 * Text output is a plain, aligned report meant to be readable in a
 * terminal and in the saved example files. CSV output is one row per
 * system (suitable for batch mode). JSON output is the raw result
 * object, pretty-printed.
 */
"use strict";

const { fmtEnergy, fmtPower, fmtPct, round } = require("./units");
const { fmtIdr } = require("./catalog");

function line(char = "-", width = 64) {
  return char.repeat(width);
}

function kv(key, value, width = 26) {
  return `${key.padEnd(width)}: ${value}`;
}

/** Full text report for one sized system. */
function renderSystemText(s) {
  const out = [];
  out.push(line("="));
  out.push(`SOLAR SIZING — ${s.profile.name}`);
  out.push(`Location: ${s.location.name}, ${s.location.country} (${s.location.lat}, ${s.location.lon})`);
  out.push(line("="));
  out.push("");
  out.push("LOAD PROFILE");
  out.push(kv("Daily energy", fmtEnergy(s.profile.dailyWh)));
  out.push(kv("Peak load", `${fmtPower(s.profile.peakW)} (hour ${s.profile.peakHour}:00)`));
  out.push(kv("Night load (18:00-06:00)", fmtEnergy(s.profile.nightWh)));
  out.push("");
  out.push("SOLAR RESOURCE");
  out.push(kv("Peak sun hours (annual avg)", `${round(s.location.annualPsh, 2)} h/day`));
  out.push(kv("Peak sun hours (worst month)", `${s.location.worstMonth.psh} h/day (${s.location.worstMonth.month})`));
  out.push(kv("Performance ratio", `${fmtPct(s.pr.pr)} (cell ${s.pr.cellTempC} °C)`));
  out.push(kv("Losses", Object.entries(s.pr.factors).map(([k, v]) => `${k} ${fmtPct(v, 1)}`).join(", ")));
  out.push("");
  out.push("PV ARRAY");
  out.push(kv("Required array", fmtPower(s.panel.requiredWp)));
  out.push(kv("Panels", `${s.panel.panelCount} × ${s.panel.panelW} W = ${fmtPower(s.panel.installedWp)}`));
  out.push(kv("Expected daily yield", `${fmtEnergy(s.panel.dailyYieldWh)} (${fmtPct(s.panel.coverage)} of load)`));
  out.push("");
  out.push("BATTERY");
  out.push(kv("Chemistry", s.battery.chemistryLabel));
  out.push(kv("Autonomy target", `${s.battery.autonomyDays} day(s)`));
  out.push(kv("Usable energy", fmtEnergy(s.battery.usableWh)));
  out.push(kv("Nominal capacity", `${fmtEnergy(s.battery.nominalWh)} (${s.battery.capacityAh} Ah @ ${s.battery.voltage} V)`));
  out.push(kv("Depth of discharge", fmtPct(s.battery.dod, 0)));
  out.push("");
  out.push("CHARGE CONTROLLER");
  out.push(kv("Type", `${s.controller.type} — ${s.controller.typeReason}`));
  out.push(kv("Required current", `${s.controller.requiredCurrentA} A (array Isc ${s.controller.arrayIscA} A × 1.25)`));
  out.push(kv("Recommended rating", `≥ ${s.controller.recommendedCurrentA} A, max input ${s.controller.maxInputVoltageV} V`));
  out.push("");
  out.push("INVERTER");
  out.push(kv("Continuous", `${fmtPower(s.inverter.continuousW)} (peak × 1.25)`));
  out.push(kv("Surge", `${fmtPower(s.inverter.surgeW)}`));
  out.push("");
  out.push("CABLE (array → controller)");
  out.push(kv("Recommended size", `${s.cable.areaMm2} mm² — drop ${s.cable.dropPct}% over ${s.cable.lengthM} m @ ${s.cable.currentA} A`));
  out.push("");
  if (s.cost) {
    out.push("ESTIMATED COST (example prices — NOT live market prices)");
    for (const item of s.cost.items) {
      out.push(`  ${item.component}: ${fmtIdr(item.totalIdr)}`);
    }
    out.push(kv("Balance of system (15%)", fmtIdr(s.cost.bosIdr)));
    out.push(kv("TOTAL (estimate)", fmtIdr(s.cost.totalIdr)));
    out.push(kv("Cost per Wp", `${fmtIdr(s.cost.costPerWpIdr)}/Wp`));
    out.push("");
  }
  out.push(line("-"));
  return out.join("\n");
}

/** One CSV row per system; header included. */
function renderSystemsCsv(systems) {
  const header = [
    "profile", "location", "daily_wh", "peak_w", "psh_annual", "psh_worst_month",
    "performance_ratio", "required_wp", "panel_count", "panel_w", "installed_wp",
    "daily_yield_wh", "battery_chemistry", "autonomy_days", "battery_kwh",
    "battery_ah", "system_voltage_v", "controller_type", "controller_a",
    "inverter_continuous_w", "inverter_surge_w", "cable_mm2", "cost_idr",
  ];
  const rows = systems.map((s) => [
    s.profile.name, s.location.name, s.profile.dailyWh, s.profile.peakW,
    round(s.location.annualPsh, 2), s.location.worstMonth.psh, s.pr.pr,
    s.panel.requiredWp, s.panel.panelCount, s.panel.panelW, s.panel.installedWp,
    s.panel.dailyYieldWh, s.battery.chemistry, s.battery.autonomyDays,
    s.battery.nominalKwh, s.battery.capacityAh, s.battery.voltage,
    s.controller.type, s.controller.requiredCurrentA,
    s.inverter.continuousW, s.inverter.surgeW, s.cable.areaMm2,
    s.cost ? s.cost.totalIdr : "",
  ].join(","));
  return [header.join(","), ...rows].join("\n");
}

/** JSON output: the raw result object(s). */
function renderJson(value) {
  return JSON.stringify(value, null, 2);
}

module.exports = { renderSystemText, renderSystemsCsv, renderJson, line, kv };
