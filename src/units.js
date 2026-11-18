/**
 * units.js — small formatting and unit helpers.
 *
 * All internal math is done in watts, watt-hours and hours. These helpers
 * only format numbers for reports and convert between the units users
 * actually read (Wh/kWh, W/kW, Ah).
 */
"use strict";

/** Round to a fixed number of decimals (default 2) without string coercion. */
function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Format Wh as Wh or kWh, whichever reads better. */
function fmtEnergy(wh) {
  if (Math.abs(wh) >= 10000) return `${round(wh / 1000, 2)} kWh`;
  if (Math.abs(wh) >= 1000) return `${round(wh / 1000, 3)} kWh`;
  return `${round(wh, 1)} Wh`;
}

/** Format W as W or kW. */
function fmtPower(w) {
  if (Math.abs(w) >= 1000) return `${round(w / 1000, 2)} kW`;
  return `${round(w, 1)} W`;
}

/** Format a fraction (0.75) as a percentage string ("75.0%"). */
function fmtPct(fraction, decimals = 1) {
  return `${round(fraction * 100, decimals)}%`;
}

/** Clamp a number into [min, max]. */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Convert an energy amount (Wh) at a system voltage (V) into amp-hours.
 * Ah = Wh / V.
 */
function whToAh(wh, volts) {
  return wh / volts;
}

/** Convert amp-hours at a system voltage into watt-hours. */
function ahToWh(ah, volts) {
  return ah * volts;
}

module.exports = { round, fmtEnergy, fmtPower, fmtPct, clamp, whToAh, ahToWh };
