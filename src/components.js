/**
 * components.js — charge controller, inverter and cable sizing.
 *
 * Rules used (standard practice, see docs/RESEARCH.md):
 * - Charge controller current: NEC 690.8 — size for 125% of the array
 *   short-circuit current: I_req = I_sc(array) × 1.25.
 * - MPPT vs PWM: MPPT is recommended when the array Vmp is well above
 *   the battery voltage or the array is larger than ~200 W; PWM only
 *   makes sense for small 12 V systems where panel Vmp ≈ battery V.
 * - Inverter: continuous rating ≥ 1.25 × peak load; surge rating must
 *   cover motor starting surges (default: 3 × the largest motor load,
 *   or the caller-supplied surge watts).
 * - Cable voltage drop: R = 2 × L × ρ / A (go and return), V_drop = I × R,
 *   with copper ρ = 0.0171 Ω·mm²/m at 20 °C. Target ≤ 3% (≤ 2% for the
 *   PV-to-controller run is better practice; the check flags > 3%).
 */
"use strict";

const { InputError } = require("./errors");
const { round } = require("./units");

const COPPER_RESISTIVITY = 0.0171; // Ω·mm²/m at 20 °C
const STANDARD_CABLE_MM2 = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70];

/**
 * Size the charge controller.
 * panelIsc/panelVoc are per-panel values; series × parallel describe
 * the array wiring. `arrayVmp` (if given) drives the MPPT/PWM call.
 */
function sizeController({
  panelIsc,
  panelVoc,
  panelsSeries = 1,
  panelsParallel = 1,
  systemVoltage = 24,
  arrayVmp = null,
  arrayWp = null,
}) {
  if (!(panelIsc > 0)) throw new InputError(`Panel Isc must be > 0 A, got ${panelIsc}.`);
  if (!(panelVoc > 0)) throw new InputError(`Panel Voc must be > 0 V, got ${panelVoc}.`);
  if (!Number.isInteger(panelsSeries) || panelsSeries < 1) {
    throw new InputError(`panelsSeries must be an integer ≥ 1, got ${panelsSeries}.`);
  }
  if (!Number.isInteger(panelsParallel) || panelsParallel < 1) {
    throw new InputError(`panelsParallel must be an integer ≥ 1, got ${panelsParallel}.`);
  }
  const arrayIsc = panelIsc * panelsParallel;
  const arrayVoc = panelVoc * panelsSeries;
  const requiredCurrentA = arrayIsc * 1.25; // NEC 690.8 safety factor
  const maxInputVoltage = arrayVoc * 1.25; // cold-morning Voc rise allowance
  const vmp = arrayVmp !== null ? arrayVmp : panelVoc * 0.8 * panelsSeries;
  const mpptRecommended = vmp > systemVoltage * 1.5 || (arrayWp !== null && arrayWp > 200);
  return {
    type: mpptRecommended ? "MPPT" : "PWM",
    typeReason: mpptRecommended
      ? "Array Vmp is well above battery voltage (or array > 200 W): MPPT harvests the extra voltage."
      : "Small array with Vmp close to battery voltage: PWM is acceptable.",
    arrayIscA: round(arrayIsc, 2),
    requiredCurrentA: round(requiredCurrentA, 2),
    recommendedCurrentA: Math.ceil(requiredCurrentA / 5) * 5, // next 5 A step
    arrayVocV: round(arrayVoc, 1),
    maxInputVoltageV: round(maxInputVoltage, 1),
    systemVoltage,
  };
}

/**
 * Size the inverter. `surgeW` is the starting surge of the biggest
 * motor load; if omitted it defaults to 3 × peakW (rule of thumb).
 */
function sizeInverter({ peakW, surgeW = null, inverterEff = 0.95 }) {
  if (!(peakW > 0)) throw new InputError(`Peak load must be > 0 W, got ${peakW}.`);
  const surge = surgeW !== null ? surgeW : peakW * 3;
  if (!(surge > 0)) throw new InputError(`Surge load must be > 0 W, got ${surge}.`);
  const continuousW = peakW * 1.25;
  return {
    continuousW: round(continuousW, 0),
    surgeW: round(surge, 0),
    recommendedContinuousW: Math.ceil(continuousW / 100) * 100,
    recommendedSurgeW: Math.ceil(surge / 100) * 100,
    inverterEff,
    dcInputW: round(peakW / inverterEff, 1),
  };
}

/** Voltage drop (V and %) for a copper cable run. */
function cableVoltageDrop({ currentA, lengthM, areaMm2, voltageV }) {
  if (!(currentA >= 0)) throw new InputError(`Current must be ≥ 0 A, got ${currentA}.`);
  if (!(lengthM > 0)) throw new InputError(`Cable length must be > 0 m, got ${lengthM}.`);
  if (!(areaMm2 > 0)) throw new InputError(`Cable area must be > 0 mm², got ${areaMm2}.`);
  if (!(voltageV > 0)) throw new InputError(`Voltage must be > 0 V, got ${voltageV}.`);
  const resistance = (2 * lengthM * COPPER_RESISTIVITY) / areaMm2;
  const dropV = currentA * resistance;
  return {
    resistanceOhm: round(resistance, 4),
    dropV: round(dropV, 3),
    dropPct: round((dropV / voltageV) * 100, 2),
    ok: dropV / voltageV <= 0.03,
  };
}

/** Smallest standard cable size whose voltage drop is ≤ 3%. */
function pickCable({ currentA, lengthM, voltageV }) {
  for (const area of STANDARD_CABLE_MM2) {
    const result = cableVoltageDrop({ currentA, lengthM, areaMm2: area, voltageV });
    if (result.ok) return { areaMm2: area, ...result };
  }
  const biggest = STANDARD_CABLE_MM2[STANDARD_CABLE_MM2.length - 1];
  return { areaMm2: biggest, ...cableVoltageDrop({ currentA, lengthM, areaMm2: biggest, voltageV }), note: "Even the largest standard size exceeds 3% — shorten the run or raise the system voltage." };
}

module.exports = { COPPER_RESISTIVITY, STANDARD_CABLE_MM2, sizeController, sizeInverter, cableVoltageDrop, pickCable };
