/**
 * cli.js — command-line interface for solar-sizing-tool.
 *
 *   solar size        --preset <name>|--profile <file> [--location <key>] ...
 *   solar compare     [--preset a,b | --profile <file>] [--location <key>]
 *   solar tilt        [--location <key> | --lat <deg>]
 *   solar monthly     --preset <name>|--profile <file> [--location <key>]
 *   solar sensitivity --preset <name>|--profile <file> [--location <key>]
 *   solar check       --preset <name>|--profile <file> --panels <n> --panel-w <w>
 *                     --battery-kwh <kwh> [--location <key>] [--autonomy <days>]
 *
 * Common options: --psh <h> --autonomy <days> --chemistry <name>
 * --voltage <12|24|48> --panel-w <W> --ambient <°C> --surge <W>
 * --cable-length <m> --worst-month --format <text|json|csv> --output <file>
 *
 * Exit codes: 0 ok, 1 usage error, 2 input error.
 */
"use strict";

const fs = require("node:fs");
const { InputError } = require("./errors");
const lib = require("./index");
const { getLocation, listLocations, MONTHS } = require("./locations");
const { getPreset, listPresets } = require("./profiles");
const { loadProfilesFile } = require("./loadProfile");
const { performanceRatio } = require("./panel");
const { optimalTilt, monthlyAnalysis, sensitivityAnalysis, feasibilityCheck } = require("./analysis");
const { compareSystems } = require("./compare");
const { renderSystemText, renderSystemsCsv, renderJson, line } = require("./report");
const { fmtEnergy, fmtPower, fmtPct, round } = require("./units");

const VERSION = "1.0.0";

function usage() {
  return `solar-sizing-tool ${VERSION} — off-grid solar PV sizing (pure Node.js, no dependencies)

Usage:
  solar size        --preset <name> | --profile <file> [options]
  solar compare     [--preset a,b | --profile <file>] [--location <key>]
  solar tilt        [--location <key> | --lat <deg>]
  solar monthly     --preset <name> | --profile <file> [options]
  solar sensitivity --preset <name> | --profile <file> [options]
  solar check       --preset <name> | --profile <file> --panels <n> --panel-w <w>
                    --battery-kwh <kwh> [options]

Common options:
  --location <key>      Location key (default: jakarta). Run with no location
                        argument to see the list via 'solar size --help'.
  --psh <hours>         Override peak sun hours (h/day).
  --autonomy <days>     Battery autonomy target in sunless days (default: 2).
  --chemistry <name>    lead_acid | lifepo4 (default) | nmc.
  --voltage <V>         System voltage 12 | 24 (default) | 48.
  --panel-w <W>         Panel wattage (default: 550).
  --ambient <°C>        Daytime ambient temperature (default: 28).
  --surge <W>           Motor starting surge for inverter sizing.
  --cable-length <m>    Array-to-controller cable run (default: 10).
  --worst-month         Size the array against the worst month's PSH.
  --format <fmt>        text (default) | json | csv.
  --output <file>       Write the output to a file instead of stdout.

Presets: ${listPresets().map((p) => p.key).join(", ")}
Locations: ${listLocations().map((l) => l.key).join(", ")}`;
}

/** Minimal --key value / --key=value / --flag parser. */
function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const eq = token.indexOf("=");
      if (eq !== -1) {
        args[token.slice(2, eq)] = token.slice(eq + 1);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        args[token.slice(2)] = argv[i + 1];
        i += 1;
      } else {
        args[token.slice(2)] = true;
      }
    } else {
      args._.push(token);
    }
  }
  return args;
}

function numArg(args, name, fallback) {
  if (args[name] === undefined || args[name] === true) return fallback;
  const v = Number(args[name]);
  if (!Number.isFinite(v)) throw new InputError(`--${name} must be a number, got "${args[name]}".`);
  return v;
}

/** Resolve --preset or --profile (single profile) into a parsed profile. */
function resolveProfile(args) {
  if (args.preset) {
    const preset = getPreset(args.preset);
    return { name: preset.name, hourly: preset.hourly, dailyWh: preset.hourly.reduce((s, w) => s + w, 0), peakW: Math.max(...preset.hourly), peakHour: preset.hourly.indexOf(Math.max(...preset.hourly)), nightWh: preset.hourly.slice(0, 6).reduce((s, w) => s + w, 0) + preset.hourly.slice(18).reduce((s, w) => s + w, 0) };
  }
  if (args.profile) {
    const profiles = loadProfilesFile(args.profile);
    if (profiles.length > 1) {
      throw new InputError(`--profile "${args.profile}" contains ${profiles.length} profiles; use batch mode (compare) or a single-profile file.`);
    }
    return profiles[0];
  }
  throw new InputError("Need a load profile: --preset <name> or --profile <file>.");
}

/** Shared sizing options from CLI args. */
function sizingOptions(args) {
  return {
    location: args.location || "jakarta",
    psh: args.psh !== undefined ? numArg(args, "psh") : undefined,
    autonomyDays: numArg(args, "autonomy", 2),
    chemistry: args.chemistry || "lifepo4",
    voltage: numArg(args, "voltage", 24),
    panelW: numArg(args, "panel-w", 550),
    ambientC: numArg(args, "ambient", 28),
    surgeW: args.surge !== undefined ? numArg(args, "surge") : null,
    cableLengthM: numArg(args, "cable-length", 10),
    useWorstMonth: Boolean(args["worst-month"]),
  };
}

function emit(text, args) {
  if (args.output) {
    fs.writeFileSync(args.output, text.endsWith("\n") ? text : `${text}\n`, "utf8");
    return `Wrote ${args.output}\n`;
  }
  return text;
}

function cmdSize(args) {
  const profile = resolveProfile(args);
  const result = lib.sizeSystem(profile, sizingOptions(args));
  const format = args.format || "text";
  if (format === "json") return emit(renderJson(result), args);
  if (format === "csv") return emit(renderSystemsCsv([result]), args);
  if (format !== "text") throw new InputError(`Unknown --format "${format}" (text|json|csv).`);
  return emit(renderSystemText(result), args);
}

function cmdCompare(args) {
  const locationKeys = (args.location || "jakarta").split(",").map((s) => s.trim());
  let entries = [];
  if (args.preset) {
    const keys = args.preset.split(",").map((s) => s.trim());
    for (const key of keys) {
      const preset = getPreset(key);
      const profile = { name: preset.name, hourly: preset.hourly, dailyWh: preset.hourly.reduce((s, w) => s + w, 0), peakW: Math.max(...preset.hourly), peakHour: preset.hourly.indexOf(Math.max(...preset.hourly)), nightWh: 0 };
      for (const locKey of locationKeys) {
        entries.push({ label: locationKeys.length > 1 ? `${preset.name} @ ${locKey}` : preset.name, sizing: lib.sizeSystem(profile, { ...sizingOptions(args), location: locKey }) });
      }
    }
  } else if (args.profile) {
    const profiles = loadProfilesFile(args.profile);
    for (const profile of profiles) {
      for (const locKey of locationKeys) {
        entries.push({ label: locationKeys.length > 1 ? `${profile.name} @ ${locKey}` : profile.name, sizing: lib.sizeSystem(profile, { ...sizingOptions(args), location: locKey }) });
      }
    }
  } else {
    // No profile given: compare all built-in presets at the location(s).
    for (const p of listPresets()) {
      const preset = getPreset(p.key);
      const profile = { name: preset.name, hourly: preset.hourly, dailyWh: preset.hourly.reduce((s, w) => s + w, 0), peakW: Math.max(...preset.hourly), peakHour: preset.hourly.indexOf(Math.max(...preset.hourly)), nightWh: 0 };
      for (const locKey of locationKeys) {
        entries.push({ label: locationKeys.length > 1 ? `${preset.name} @ ${locKey}` : preset.name, sizing: lib.sizeSystem(profile, { ...sizingOptions(args), location: locKey }) });
      }
    }
  }
  const result = compareSystems(entries);
  const format = args.format || "text";
  if (format === "json") return emit(renderJson(result), args);
  if (format === "csv") {
    return emit(renderSystemsCsv(entries.map((e) => e.sizing)), args);
  }
  const out = [];
  out.push(line("="));
  out.push("COMPARISON");
  out.push(line("="));
  out.push("");
  const header = ["System", "Daily", "PSH", "Array", "Panels", "Battery", "Cost (est.)"];
  out.push(header.map((h) => h.padEnd(14)).join(""));
  out.push(line("-"));
  for (const row of result.rows) {
    out.push([
      row.label.slice(0, 13).padEnd(14),
      fmtEnergy(row.dailyWh).padEnd(14),
      `${round(row.psh, 2)} h`.padEnd(14),
      fmtPower(row.requiredWp).padEnd(14),
      `${row.panelCount}×${row.installedWp / row.panelCount}W`.padEnd(14),
      `${row.batteryKwh} kWh`.padEnd(14),
      row.totalCostIdr !== null ? lib.fmtIdr(row.totalCostIdr) : "n/a",
    ].join(""));
  }
  out.push("");
  out.push(`Cheapest: ${result.cheapestLabel || "n/a"} — smallest array: ${result.smallestArrayLabel}`);
  out.push(`Required array spread: ${fmtPower(result.requiredWpSpread.min)} – ${fmtPower(result.requiredWpSpread.max)} (ratio ${result.requiredWpSpread.ratio}×)`);
  out.push("");
  out.push("Note: costs are example prices, NOT live market prices (see catalog.js).");
  return emit(out.join("\n"), args);
}

function cmdTilt(args) {
  let lat;
  let label;
  if (args.lat !== undefined) {
    lat = numArg(args, "lat");
    label = `latitude ${lat}°`;
  } else {
    const loc = getLocation(args.location || "jakarta");
    lat = loc.lat;
    label = `${loc.name}, ${loc.country} (lat ${lat}°)`;
  }
  const t = optimalTilt(lat);
  const format = args.format || "text";
  if (format === "json") return emit(renderJson({ location: label, ...t }), args);
  const out = [];
  out.push(line("="));
  out.push(`OPTIMAL TILT — ${label}`);
  out.push(line("="));
  out.push("");
  out.push(`Annual fixed tilt : ${t.annual}° (face ${t.facing})`);
  out.push(`Summer tilt       : ${t.summer}°`);
  out.push(`Winter tilt       : ${t.winter}°`);
  out.push(`Est. gain vs flat : ${fmtPct(t.estimatedGainVsHorizontal)} (rough rule of thumb)`);
  out.push("");
  out.push("Within ~15° of the equator the gain is small; a 10–15° tilt is");
  out.push("still recommended so rain washes dust off the panels.");
  return emit(out.join("\n"), args);
}

function cmdMonthly(args) {
  const profile = resolveProfile(args);
  const opts = sizingOptions(args);
  const location = getLocation(opts.location);
  const chem = lib.getChemistry(opts.chemistry);
  const pr = performanceRatio({ ambientC: opts.ambientC, batteryRoundTrip: chem.roundTrip });
  const analysis = monthlyAnalysis({ dailyWh: profile.dailyWh, location, pr: pr.pr, installedWp: null });
  const format = args.format || "text";
  if (format === "json") return emit(renderJson(analysis), args);
  if (format === "csv") {
    const rows = [["month", "psh", "required_wp", "panels_550w"].join(",")];
    for (const m of analysis.months) rows.push([m.month, m.psh, m.requiredWp, m.panelCount550W].join(","));
    return emit(rows.join("\n"), args);
  }
  const out = [];
  out.push(line("="));
  out.push(`MONTHLY VARIATION — ${profile.name} @ ${location.name}`);
  out.push(line("="));
  out.push(`Daily load: ${fmtEnergy(profile.dailyWh)} · PR ${fmtPct(pr.pr)} · panel 550 W`);
  out.push("");
  out.push("Month   PSH (h)   Array needed   Panels (550 W)");
  out.push(line("-"));
  for (const m of analysis.months) {
    out.push(`${m.month.padEnd(8)}${String(m.psh).padEnd(10)}${fmtPower(m.requiredWp).padEnd(15)}${m.panelCount550W}`);
  }
  out.push(line("-"));
  out.push(`Worst month: ${analysis.worstMonth.month} (${analysis.worstMonth.psh} h/day) — needs ${fmtPower(analysis.worstMonth.requiredWp)} (${analysis.worstMonth.panelCount550W} panels).`);
  out.push(`Best month : ${analysis.bestMonth.month} (${analysis.bestMonth.psh} h/day) — needs ${fmtPower(analysis.bestMonth.requiredWp)} (${analysis.bestMonth.panelCount550W} panels).`);
  out.push(`Designing for the worst month instead of the annual mean needs ${analysis.worstMonth.panelCount550W - Math.ceil((profile.dailyWh / (location.annual * pr.pr)) / 550)} extra panel(s).`);
  return emit(out.join("\n"), args);
}

function cmdSensitivity(args) {
  const profile = resolveProfile(args);
  const opts = sizingOptions(args);
  const location = getLocation(opts.location);
  const psh = opts.psh !== undefined ? opts.psh : location.annual;
  const chem = lib.getChemistry(opts.chemistry);
  const pr = performanceRatio({ ambientC: opts.ambientC, batteryRoundTrip: chem.roundTrip });
  const result = sensitivityAnalysis({
    dailyWh: profile.dailyWh, psh, pr: pr.pr,
    autonomyDays: opts.autonomyDays, chemistry: opts.chemistry, voltage: opts.voltage,
    panelW: opts.panelW,
  });
  const format = args.format || "text";
  if (format === "json") return emit(renderJson(result), args);
  const out = [];
  out.push(line("="));
  out.push(`SENSITIVITY — ${profile.name} @ ${location.name}`);
  out.push(line("="));
  out.push(`Base: ${fmtEnergy(profile.dailyWh)}/day, PSH ${round(psh, 2)} h, PR ${fmtPct(pr.pr)}`);
  out.push(`Base size: ${fmtPower(result.base.requiredWp)} (${result.base.panelCount} × ${opts.panelW} W), battery ${result.base.batteryKwh} kWh (${result.base.batteryAh} Ah).`);
  out.push("");
  out.push("Scenario".padEnd(38) + "Array".padEnd(12) + "Panels".padEnd(9) + "Battery");
  out.push(line("-"));
  for (const s of result.scenarios) {
    out.push(`${s.label.padEnd(38)}${fmtPower(s.requiredWp).padEnd(12)}${String(s.panelCount).padEnd(9)}${s.batteryKwh} kWh (${s.batteryAh} Ah)`);
  }
  return emit(out.join("\n"), args);
}

function cmdCheck(args) {
  const profile = resolveProfile(args);
  const opts = sizingOptions(args);
  const panels = numArg(args, "panels");
  const panelW = numArg(args, "panel-w", 550);
  const batteryKwh = numArg(args, "battery-kwh");
  if (panels === undefined || Number.isNaN(panels)) throw new InputError("--panels <n> is required for check.");
  if (batteryKwh === undefined || Number.isNaN(batteryKwh)) throw new InputError("--battery-kwh <kwh> is required for check.");
  const location = getLocation(opts.location);
  const chem = lib.getChemistry(opts.chemistry);
  const pr = performanceRatio({ ambientC: opts.ambientC, batteryRoundTrip: chem.roundTrip });
  const result = feasibilityCheck({
    dailyWh: profile.dailyWh, location, pr: pr.pr,
    installedWp: panels * panelW, batteryKwh, chemistry: opts.chemistry,
    autonomyDays: opts.autonomyDays, voltage: opts.voltage,
  });
  const format = args.format || "text";
  if (format === "json") return emit(renderJson(result), args);
  const out = [];
  out.push(line("="));
  out.push(`FEASIBILITY CHECK — ${profile.name} @ ${location.name}`);
  out.push(line("="));
  out.push(`Installed: ${panels} × ${panelW} W = ${fmtPower(panels * panelW)}, battery ${batteryKwh} kWh (${opts.chemistry}), autonomy target ${opts.autonomyDays} day(s).`);
  out.push("");
  for (const c of result.checks) {
    out.push(`${c.ok ? "PASS" : "FAIL"}  ${c.name}: ${c.detail}`);
  }
  out.push("");
  out.push(`Verdict: ${result.verdict}`);
  out.push(`Worst-month yield: ${fmtEnergy(result.worstMonthYieldWh)}/day vs ${fmtEnergy(profile.dailyWh)}/day needed.`);
  out.push(`Autonomy achieved: ${result.autonomyDaysAchieved} day(s) (usable ${fmtEnergy(result.usableBatteryWh)}).`);
  return emit(out.join("\n"), args);
}

function run(argv) {
  const args = parseArgs(argv);
  if (args.help || args.h || args._.length === 0) return usage();
  const command = args._[0];
  switch (command) {
    case "size": return cmdSize(args);
    case "compare": return cmdCompare(args);
    case "tilt": return cmdTilt(args);
    case "monthly": return cmdMonthly(args);
    case "sensitivity": return cmdSensitivity(args);
    case "check": return cmdCheck(args);
    case "version": case "--version": return `solar-sizing-tool ${VERSION}\n`;
    default: throw new InputError(`Unknown command "${command}".\n\n${usage()}`);
  }
}

module.exports = { run, usage, parseArgs, MONTHS };
