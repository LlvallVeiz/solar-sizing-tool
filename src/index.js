/**
 * index.js — public library API: size a complete off-grid solar system.
 *
 * sizeSystem() takes a parsed load profile + a location and returns one
 * object with every subsystem sized: panel array, battery bank, charge
 * controller, inverter, cable and an example cost estimate. All other
 * modules are exported for users who only need one piece.
 */
"use strict";

const { InputError } = require("./errors");
const { getLocation, worstMonthPsh } = require("./locations");
const { getPreset, listPresets } = require("./profiles");
const { parseProfile, loadProfileFile, loadProfilesFile } = require("./loadProfile");
const { performanceRatio, sizePanel, DEFAULTS: PANEL_DEFAULTS } = require("./panel");
const { sizeBattery, getChemistry, CHEMISTRY } = require("./battery");
const { sizeController, sizeInverter, pickCable } = require("./components");
const { optimalTilt, monthlyAnalysis, sensitivityAnalysis, feasibilityCheck } = require("./analysis");
const { estimateCost, PANELS, fmtIdr } = require("./catalog");
const { compareSystems } = require("./compare");
const { renderSystemText, renderSystemsCsv, renderJson } = require("./report");

/** Find the catalog panel entry for a wattage (falls back to generic values). */
function panelSpec(panelW) {
  const found = PANELS.find((p) => p.watts === panelW);
  if (found) return found;
  // Generic mono panel estimate: Voc ≈ 0.09 V/W, Isc ≈ W / (0.8 × Voc).
  const voc = Math.round(panelW * 0.09 * 10) / 10;
  return { watts: panelW, voc, isc: Math.round((panelW / (0.8 * voc)) * 100) / 100, vmp: Math.round(voc * 0.8 * 10) / 10 };
}

/**
 * Size a complete system.
 *
 * options:
 *   profile        — parsed profile object (required; see loadProfile.js)
 *   location       — location key, e.g. "jakarta" (default) or a location object
 *   psh            — override PSH (h/day); replaces the location value
 *   useWorstMonth  — size against the worst month's PSH instead of annual
 *   autonomyDays   — default 2
 *   chemistry      — "lifepo4" (default), "lead_acid", "nmc"
 *   voltage        — 12 | 24 (default) | 48
 *   panelW         — 550 (default), 450, 200, 100, or any positive wattage
 *   ambientC       — default 28
 *   soiling, wiring, inverterEff — loss overrides (see panel.js)
 *   surgeW         — motor starting surge for the inverter (default 3 × peak)
 *   cableLengthM   — array → controller run, default 10 m
 *   includeCost    — default true; set false to skip the catalog estimate
 */
function sizeSystem(profile, options = {}) {
  if (!profile || !Array.isArray(profile.hourly)) {
    throw new InputError("sizeSystem needs a parsed profile (use parseProfile / loadProfileFile).");
  }
  const o = {
    location: "jakarta",
    autonomyDays: 2,
    chemistry: "lifepo4",
    voltage: 24,
    panelW: 550,
    ambientC: 28,
    surgeW: null,
    cableLengthM: 10,
    includeCost: true,
    useWorstMonth: false,
    ...options,
  };

  const location = typeof o.location === "string" ? getLocation(o.location) : o.location;
  const psh = o.psh !== undefined && o.psh !== null
    ? o.psh
    : (o.useWorstMonth ? worstMonthPsh(location).psh : location.annual);
  if (!(psh > 0)) throw new InputError(`Peak sun hours must be > 0, got ${psh}.`);

  const chem = getChemistry(o.chemistry);
  const pr = performanceRatio({
    ambientC: o.ambientC,
    soiling: o.soiling,
    wiring: o.wiring,
    inverterEff: o.inverterEff,
    batteryRoundTrip: chem.roundTrip,
  });

  const panel = sizePanel({ dailyWh: profile.dailyWh, psh, pr: pr.pr, panelW: o.panelW });
  const battery = sizeBattery({
    dailyWh: profile.dailyWh,
    autonomyDays: o.autonomyDays,
    chemistry: o.chemistry,
    voltage: o.voltage,
    ambientC: o.ambientC,
  });

  // Array wiring: enough panels in series for the string Vmp to clear
  // the battery voltage, and enough series strings to keep the number
  // of parallel strings ≤ 4 (fewer parallel strings = less current,
  // thinner cable, and a controller rating the catalog can cover).
  const spec = panelSpec(o.panelW);
  const voltageSeries = spec.vmp >= o.voltage ? 1 : Math.ceil(o.voltage / spec.vmp);
  const series = Math.max(voltageSeries, Math.ceil(panel.panelCount / 4));
  const parallel = Math.max(1, Math.ceil(panel.panelCount / series));
  const controller = sizeController({
    panelIsc: spec.isc,
    panelVoc: spec.voc,
    panelsSeries: series,
    panelsParallel: parallel,
    systemVoltage: o.voltage,
    arrayVmp: spec.vmp * series,
    arrayWp: panel.installedWp,
  });

  const inverter = sizeInverter({ peakW: profile.peakW, surgeW: o.surgeW, inverterEff: o.inverterEff ?? PANEL_DEFAULTS.inverterEff });
  const cable = pickCable({
    currentA: controller.arrayIscA,
    lengthM: o.cableLengthM,
    voltageV: o.voltage,
  });
  cable.lengthM = o.cableLengthM;
  cable.currentA = controller.arrayIscA;

  const result = {
    profile: {
      name: profile.name,
      dailyWh: profile.dailyWh,
      peakW: profile.peakW,
      peakHour: profile.peakHour,
      nightWh: profile.nightWh,
    },
    location: {
      key: location.key || o.location,
      name: location.name,
      country: location.country,
      lat: location.lat,
      lon: location.lon,
      annualPsh: location.annual,
      monthlyPsh: location.monthly,
      worstMonth: worstMonthPsh(location),
      pshUsed: psh,
      pshBasis: o.psh !== undefined && o.psh !== null
        ? "override"
        : (o.useWorstMonth ? "worst month" : "annual average"),
    },
    pr,
    panel,
    battery,
    controller,
    inverter,
    cable,
    tilt: optimalTilt(location.lat),
    cost: null,
  };
  if (o.includeCost) {
    try {
      result.cost = estimateCost(result);
    } catch (err) {
      // A catalog too small for an exotic system must not break sizing.
      result.cost = null;
      result.costError = err.message;
    }
  }
  return result;
}

module.exports = {
  sizeSystem,
  panelSpec,
  getLocation,
  getPreset,
  listPresets,
  parseProfile,
  loadProfileFile,
  loadProfilesFile,
  performanceRatio,
  sizePanel,
  sizeBattery,
  getChemistry,
  CHEMISTRY,
  sizeController,
  sizeInverter,
  pickCable,
  optimalTilt,
  monthlyAnalysis,
  sensitivityAnalysis,
  feasibilityCheck,
  estimateCost,
  compareSystems,
  renderSystemText,
  renderSystemsCsv,
  renderJson,
  fmtIdr,
  InputError,
};
