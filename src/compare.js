/**
 * compare.js — side-by-side comparison of sizing results.
 *
 * A "result" is the object returned by sizeSystem() (see index.js).
 * The comparison ranks entries by total example cost (cheapest first)
 * and reports the spread in array size, battery size and cost, so a
 * user can see what a different location, chemistry or autonomy target
 * actually costs.
 */
"use strict";

const { round } = require("./units");

/**
 * Compare an array of { label, sizing } entries.
 * Each sizing must already contain panel/battery/cost (see sizeSystem).
 */
function compareSystems(entries) {
  if (!Array.isArray(entries) || entries.length < 2) {
    const { InputError } = require("./errors");
    throw new InputError("compareSystems needs at least 2 entries.");
  }
  const rows = entries.map(({ label, sizing }) => ({
    label,
    dailyWh: sizing.profile.dailyWh,
    psh: sizing.location.annualPsh,
    requiredWp: sizing.panel.requiredWp,
    panelCount: sizing.panel.panelCount,
    installedWp: sizing.panel.installedWp,
    batteryKwh: sizing.battery.nominalKwh,
    batteryAh: sizing.battery.capacityAh,
    chemistry: sizing.battery.chemistry,
    totalCostIdr: sizing.cost ? sizing.cost.totalIdr : null,
  }));
  const withCost = rows.filter((r) => r.totalCostIdr !== null);
  const cheapest = withCost.length > 0
    ? withCost.reduce((a, b) => (a.totalCostIdr <= b.totalCostIdr ? a : b))
    : null;
  const smallestArray = rows.reduce((a, b) => (a.installedWp <= b.installedWp ? a : b));
  const wpValues = rows.map((r) => r.requiredWp);
  return {
    rows,
    cheapestLabel: cheapest ? cheapest.label : null,
    smallestArrayLabel: smallestArray.label,
    requiredWpSpread: {
      min: Math.min(...wpValues),
      max: Math.max(...wpValues),
      ratio: round(Math.max(...wpValues) / Math.min(...wpValues), 2),
    },
  };
}

module.exports = { compareSystems };
