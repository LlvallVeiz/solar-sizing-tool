/**
 * battery.js — battery bank sizing by chemistry.
 *
 * Core formula:
 *
 *   usableWh   = dailyWh × autonomyDays
 *   nominalWh  = usableWh / (DoD × tempCapacityFactor)
 *   capacityAh = nominalWh / systemVoltage
 *
 * Depth of discharge (DoD) and round-trip efficiency are the chemistry
 * fingerprints (planning values, see docs/RESEARCH.md):
 *
 *   lead-acid : DoD 50%, round-trip 80%, cheap, heavy, short cycle life
 *   LiFePO4   : DoD 80%, round-trip 92%, long life, flat voltage curve
 *   NMC       : DoD 85%, round-trip 90%, high energy density
 *
 * Temperature capacity factor (rule of thumb): lead-acid loses roughly
 * 0.6% of usable capacity per °C below 25 °C and gains a little above
 * it; lithium chemistries are less sensitive (~0.3%/°C). Clamped to
 * [0.70, 1.10] so the rule never produces absurd values. This is a
 * planning approximation, not a datasheet value.
 */
"use strict";

const { InputError } = require("./errors");
const { round } = require("./units");

const CHEMISTRY = {
  lead_acid: {
    label: "Lead-acid (flooded/AGM)",
    dod: 0.5,
    roundTrip: 0.8,
    tempCoeff: 0.006, // capacity change per °C from 25 °C
    cycleLife: "500–1200 cycles @ 50% DoD",
    notes: "Cheapest per Ah; keep DoD ≤ 50% or cycle life collapses.",
  },
  lifepo4: {
    label: "LiFePO4 (lithium iron phosphate)",
    dod: 0.8,
    roundTrip: 0.92,
    tempCoeff: 0.003,
    cycleLife: "3000–6000 cycles @ 80% DoD",
    notes: "Best for daily cycling; needs a BMS; do not charge below 0 °C.",
  },
  nmc: {
    label: "NMC (lithium nickel manganese cobalt)",
    dod: 0.85,
    roundTrip: 0.9,
    tempCoeff: 0.003,
    cycleLife: "1500–3000 cycles @ 80% DoD",
    notes: "Highest energy density; needs a BMS; thermal management matters.",
  },
};

const SYSTEM_VOLTAGES = [12, 24, 48];

function getChemistry(key) {
  const normalized = String(key).trim().toLowerCase().replace(/[\s-]+/g, "_");
  const chem = CHEMISTRY[normalized];
  if (!chem) {
    throw new InputError(
      `Unknown battery chemistry "${key}". Known: ${Object.keys(CHEMISTRY).join(", ")}.`
    );
  }
  return { key: normalized, ...chem };
}

/** Capacity factor at an ambient temperature (planning rule of thumb). */
function temperatureCapacityFactor(chemistryKey, ambientC) {
  const chem = getChemistry(chemistryKey);
  const factor = 1 + chem.tempCoeff * (ambientC - 25);
  return Math.min(1.1, Math.max(0.7, factor));
}

/**
 * Size the battery bank.
 * `dailyWh` is the energy the loads draw per day; `autonomyDays` is how
 * many sunless days the bank must cover on its own.
 */
function sizeBattery({ dailyWh, autonomyDays, chemistry = "lifepo4", voltage = 24, ambientC = 28 }) {
  if (!(dailyWh > 0)) throw new InputError(`Daily energy must be > 0 Wh, got ${dailyWh}.`);
  if (!(autonomyDays > 0)) throw new InputError(`Autonomy days must be > 0, got ${autonomyDays}.`);
  if (!SYSTEM_VOLTAGES.includes(voltage)) {
    throw new InputError(
      `System voltage must be one of ${SYSTEM_VOLTAGES.join(", ")} V, got ${voltage}.`
    );
  }
  const chem = getChemistry(chemistry);
  const tempFactor = temperatureCapacityFactor(chemistry, ambientC);
  const usableWh = dailyWh * autonomyDays;
  const nominalWh = usableWh / (chem.dod * tempFactor);
  const capacityAh = nominalWh / voltage;
  return {
    chemistry: chem.key,
    chemistryLabel: chem.label,
    autonomyDays,
    usableWh: round(usableWh, 1),
    nominalWh: round(nominalWh, 1),
    nominalKwh: round(nominalWh / 1000, 3),
    capacityAh: round(capacityAh, 1),
    voltage,
    dod: chem.dod,
    roundTrip: chem.roundTrip,
    tempFactor: round(tempFactor, 3),
    cycleLife: chem.cycleLife,
  };
}

/** Days of autonomy an existing bank actually provides for a load. */
function autonomyFromBank({ nominalWh, chemistry, dailyWh, ambientC = 28 }) {
  const chem = getChemistry(chemistry);
  const tempFactor = temperatureCapacityFactor(chemistry, ambientC);
  const usableWh = nominalWh * chem.dod * tempFactor;
  return {
    usableWh: round(usableWh, 1),
    days: round(usableWh / dailyWh, 2),
  };
}

module.exports = { CHEMISTRY, SYSTEM_VOLTAGES, getChemistry, temperatureCapacityFactor, sizeBattery, autonomyFromBank };
