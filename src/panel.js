/**
 * panel.js — system losses and PV array sizing.
 *
 * Core formula (the standard textbook sizing equation, see
 * docs/RESEARCH.md):
 *
 *   requiredWp = dailyWh / (PSH × PR)
 *
 * where PSH is Peak Sun Hours (kWh/m^2/day of irradiation) and PR is
 * the performance ratio — the product of every loss factor:
 *
 *   PR = f_temp × f_soiling × f_wiring × f_inverter × f_battery
 *
 * Temperature factor (cell temperature model from the NOCT method):
 *   T_cell = T_amb + (NOCT − 20)/800 × G
 *   f_temp = 1 + γ × (T_cell − 25),  γ ≈ −0.004 /°C for crystalline Si
 * At T_amb = 28 °C, NOCT = 45 °C, G = 1000 W/m^2: T_cell ≈ 59 °C and
 * f_temp ≈ 0.864 — the single biggest loss in the tropics.
 *
 * Defaults are planning values, not measurements; every factor can be
 * overridden from the CLI/library.
 */
"use strict";

const { InputError } = require("./errors");
const { round } = require("./units");

const DEFAULTS = {
  tempCoeff: -0.004, // per °C, mono/poly crystalline silicon
  noct: 45, // °C, nominal operating cell temperature
  irradiance: 1000, // W/m^2 reference for the NOCT model
  ambientC: 28, // °C, typical daytime ambient in Indonesia
  soiling: 0.95, // 5% soiling loss (dust, bird droppings)
  wiring: 0.98, // 2% DC+AC wiring loss
  inverterEff: 0.95, // modern pure-sine inverter
  batteryRoundTrip: 0.9, // LiFePO4-ish; overridden per chemistry
  misc: 0.98, // mismatch, MPPT tracking, ageing allowance
};

/** Cell temperature from the NOCT model. */
function cellTemperature(ambientC, noct = DEFAULTS.noct, irradiance = DEFAULTS.irradiance) {
  return ambientC + ((noct - 20) / 800) * irradiance;
}

/** Temperature derating factor for module power at a cell temperature. */
function temperatureFactor(cellTempC, tempCoeff = DEFAULTS.tempCoeff) {
  return 1 + tempCoeff * (cellTempC - 25);
}

/**
 * Performance ratio: the product of all loss factors.
 * Pass `includeBattery: false` for a grid-tied (no storage) estimate.
 */
function performanceRatio(options = {}) {
  const defined = {};
  for (const [k, v] of Object.entries(options)) if (v !== undefined) defined[k] = v;
  const o = { ...DEFAULTS, ...defined };
  const tCell = cellTemperature(o.ambientC, o.noct, o.irradiance);
  const fTemp = temperatureFactor(tCell, o.tempCoeff);
  const factors = {
    temperature: fTemp,
    soiling: o.soiling,
    wiring: o.wiring,
    inverter: o.inverterEff,
    misc: o.misc,
  };
  if (o.includeBattery !== false) factors.battery = o.batteryRoundTrip;
  let pr = 1;
  for (const f of Object.values(factors)) pr *= f;
  return { pr: round(pr, 4), cellTempC: round(tCell, 1), factors };
}

/** Validate the common sizing inputs. */
function validateSizingInputs(dailyWh, psh) {
  if (!(dailyWh > 0)) throw new InputError(`Daily energy must be > 0 Wh, got ${dailyWh}.`);
  if (!(psh > 0)) throw new InputError(`Peak sun hours must be > 0, got ${psh}.`);
}

/**
 * Size the PV array for a daily energy need.
 * Returns required Wp, panel count for the chosen panel wattage, the
 * installed Wp, and the expected daily yield with that installed size.
 */
function sizePanel({ dailyWh, psh, pr, panelW = 550 }) {
  validateSizingInputs(dailyWh, psh);
  if (!(pr > 0 && pr <= 1)) throw new InputError(`Performance ratio must be in (0, 1], got ${pr}.`);
  if (!(panelW > 0)) throw new InputError(`Panel wattage must be > 0 W, got ${panelW}.`);
  const requiredWp = dailyWh / (psh * pr);
  const panelCount = Math.max(1, Math.ceil(requiredWp / panelW));
  const installedWp = panelCount * panelW;
  const dailyYieldWh = installedWp * psh * pr;
  return {
    requiredWp: round(requiredWp, 1),
    panelCount,
    panelW,
    installedWp,
    dailyYieldWh: round(dailyYieldWh, 1),
    coverage: round(dailyYieldWh / dailyWh, 3),
    surplusWh: round(dailyYieldWh - dailyWh, 1),
  };
}

module.exports = { DEFAULTS, cellTemperature, temperatureFactor, performanceRatio, sizePanel };
