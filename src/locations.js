/**
 * locations.js — reference solar resource data (Peak Sun Hours).
 *
 * Values are monthly-mean Global Horizontal Irradiance (GHI) in
 * kWh/m^2/day, which is numerically equal to Peak Sun Hours (PSH):
 * 1 kWh/m^2/day of irradiation = 1 hour at the 1000 W/m^2 reference
 * irradiance. Source: NASA POWER (Prediction Of Worldwide Energy
 * Resources), parameter ALLSKY_SFC_SW_DWN, monthly means averaged over
 * 2020–2024, accessed 2026-11-18 via the POWER API
 * (https://power.larc.nasa.gov/api/temporal/monthly/point).
 *
 * Cross-checks: Jakarta annual 4.64 here vs 5.03 (10-year NASA SSE
 * table, Jinyi Solar) and Surabaya 5.11 here vs 5.54 (PVWatts, UNISMA
 * 2025) — same order, differences come from dataset vintage and
 * spatial resolution; see docs/RESEARCH.md. GHI is used, not plane-of-
 * array irradiance, so results are a conservative planning estimate:
 * a tilted array typically gains a few percent over GHI near the
 * equator (see tilt.js).
 *
 * Each entry: { name, country, lat, lon, monthly[12] (Jan..Dec), annual }.
 * `annual` is the mean of the 12 monthly values.
 */
"use strict";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const LOCATIONS = {
  // ---- Indonesia ----
  jakarta: {
    name: "Jakarta", country: "Indonesia", lat: -6.21, lon: 106.85,
    monthly: [4.37, 4.29, 4.65, 4.75, 4.41, 4.22, 4.59, 5.01, 5.29, 5.11, 4.58, 4.41],
  },
  surabaya: {
    name: "Surabaya", country: "Indonesia", lat: -7.25, lon: 112.74,
    monthly: [4.83, 4.74, 4.96, 4.92, 4.9, 4.64, 5.16, 5.63, 5.96, 5.81, 4.98, 4.75],
  },
  bandung: {
    name: "Bandung", country: "Indonesia", lat: -6.92, lon: 107.61,
    monthly: [4.48, 4.22, 4.84, 4.99, 4.61, 4.44, 4.87, 5.38, 5.66, 5.44, 4.85, 4.56],
  },
  yogyakarta: {
    name: "Yogyakarta", country: "Indonesia", lat: -7.8, lon: 110.36,
    monthly: [4.73, 4.53, 4.85, 5.0, 4.88, 4.55, 5.02, 5.54, 5.8, 5.48, 4.98, 4.77],
  },
  medan: {
    name: "Medan", country: "Indonesia", lat: 3.59, lon: 98.67,
    monthly: [4.46, 5.03, 5.25, 5.05, 4.75, 4.75, 4.85, 4.7, 4.75, 4.71, 4.2, 3.88],
  },
  makassar: {
    name: "Makassar", country: "Indonesia", lat: -5.15, lon: 119.42,
    monthly: [4.49, 4.53, 5.3, 5.24, 5.03, 4.89, 5.09, 6.0, 6.29, 6.3, 5.61, 4.33],
  },
  denpasar: {
    name: "Denpasar", country: "Indonesia", lat: -8.67, lon: 115.21,
    monthly: [5.32, 5.28, 5.62, 5.44, 5.19, 4.94, 5.09, 5.76, 6.18, 6.32, 5.79, 5.18],
  },
  semarang: {
    name: "Semarang", country: "Indonesia", lat: -6.97, lon: 110.42,
    monthly: [4.2, 4.31, 5.06, 5.18, 4.89, 4.67, 5.13, 5.77, 6.05, 5.82, 5.04, 4.39],
  },
  // ---- Asia-Pacific ----
  singapore: {
    name: "Singapore", country: "Singapore", lat: 1.35, lon: 103.82,
    monthly: [4.33, 5.04, 5.27, 4.87, 4.68, 4.24, 4.45, 4.28, 4.51, 4.64, 4.18, 4.15],
  },
  bangkok: {
    name: "Bangkok", country: "Thailand", lat: 13.76, lon: 100.5,
    monthly: [5.25, 5.52, 5.8, 5.8, 5.58, 5.53, 5.1, 5.34, 4.76, 4.5, 4.68, 4.94],
  },
  manila: {
    name: "Manila", country: "Philippines", lat: 14.6, lon: 120.98,
    monthly: [4.58, 5.38, 6.37, 6.48, 6.33, 5.63, 4.69, 4.91, 4.74, 4.44, 4.67, 4.06],
  },
  tokyo: {
    name: "Tokyo", country: "Japan", lat: 35.68, lon: 139.69,
    monthly: [2.73, 3.66, 4.17, 4.92, 4.99, 4.8, 4.86, 5.15, 3.82, 3.09, 2.82, 2.65],
  },
  sydney: {
    name: "Sydney", country: "Australia", lat: -33.87, lon: 151.21,
    monthly: [6.19, 5.56, 4.52, 3.79, 2.91, 2.52, 2.69, 3.62, 4.79, 5.6, 6.07, 6.66],
  },
  // ---- Europe / Americas / Africa / Middle East ----
  berlin: {
    name: "Berlin", country: "Germany", lat: 52.52, lon: 13.4,
    monthly: [0.65, 1.3, 2.68, 4.01, 5.12, 5.49, 5.02, 4.31, 3.28, 1.73, 0.8, 0.48],
  },
  london: {
    name: "London", country: "United Kingdom", lat: 51.51, lon: -0.13,
    monthly: [0.89, 1.53, 2.66, 4.28, 5.21, 5.59, 5.01, 4.28, 3.17, 1.92, 1.0, 0.61],
  },
  new_york: {
    name: "New York", country: "United States", lat: 40.71, lon: -74.01,
    monthly: [1.81, 2.68, 3.84, 4.75, 5.71, 6.25, 5.94, 5.18, 4.29, 3.15, 2.37, 1.63],
  },
  los_angeles: {
    name: "Los Angeles", country: "United States", lat: 34.05, lon: -118.24,
    monthly: [3.14, 4.26, 5.09, 6.7, 7.58, 7.96, 8.05, 7.22, 5.98, 4.8, 3.66, 2.73],
  },
  dubai: {
    name: "Dubai", country: "United Arab Emirates", lat: 25.2, lon: 55.27,
    monthly: [3.89, 4.87, 5.67, 6.26, 7.01, 6.99, 6.32, 6.19, 5.93, 5.18, 4.24, 3.69],
  },
  cairo: {
    name: "Cairo", country: "Egypt", lat: 30.04, lon: 31.24,
    monthly: [3.45, 4.24, 5.46, 6.75, 7.56, 7.99, 7.88, 7.21, 6.3, 5.02, 3.79, 3.23],
  },
  nairobi: {
    name: "Nairobi", country: "Kenya", lat: -1.29, lon: 36.82,
    monthly: [6.15, 6.61, 6.71, 5.65, 5.35, 4.82, 4.52, 5.15, 5.88, 6.23, 5.58, 6.05],
  },
};

// Attach the annual mean to every entry at load time.
for (const loc of Object.values(LOCATIONS)) {
  loc.annual = loc.monthly.reduce((sum, v) => sum + v, 0) / 12;
}

/** Case-insensitive lookup; throws InputError for unknown keys. */
function getLocation(key) {
  const normalized = String(key).trim().toLowerCase().replace(/[\s-]+/g, "_");
  const loc = LOCATIONS[normalized];
  if (!loc) {
    const known = Object.keys(LOCATIONS).join(", ");
    const { InputError } = require("./errors");
    throw new InputError(`Unknown location "${key}". Known locations: ${known}.`);
  }
  return { key: normalized, ...loc };
}

function listLocations() {
  return Object.entries(LOCATIONS).map(([key, loc]) => ({
    key,
    name: loc.name,
    country: loc.country,
    lat: loc.lat,
    lon: loc.lon,
    annualPsh: loc.annual,
    worstMonth: Math.min(...loc.monthly),
    bestMonth: Math.max(...loc.monthly),
  }));
}

/** Worst-month (minimum) PSH of a location — the conservative design value. */
function worstMonthPsh(location) {
  const idx = location.monthly.indexOf(Math.min(...location.monthly));
  return { month: MONTHS[idx], monthIndex: idx, psh: location.monthly[idx] };
}

module.exports = { MONTHS, LOCATIONS, getLocation, listLocations, worstMonthPsh };
