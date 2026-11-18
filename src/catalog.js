/**
 * catalog.js — example component catalog + cost estimation.
 *
 * ⚠ PRICES ARE EXAMPLES, NOT LIVE MARKET PRICES. They are round
 * Indonesian-market-style figures (IDR) chosen so the cost estimator
 * can be demonstrated end to end; real quotes vary by brand, seller
 * and date. The estimator always labels its output as an example
 * estimate and never claims to be a quotation. Users should replace
 * these entries with real quotes for a real purchase decision.
 *
 * Selection rule: cheapest catalog item that meets or exceeds the
 * required rating (panels: count × wattage ≥ required Wp; battery:
 * nominal kWh ≥ required; controller: current ≥ required; inverter:
 * continuous ≥ required). Balance-of-system (cables, MCB, mounting,
 * connectors) is added as a flat 15% allowance.
 */
"use strict";

const { InputError } = require("./errors");
const { round } = require("./units");

const PRICE_DISCLAIMER =
  "Example prices (IDR) for illustration only — NOT live market prices. Replace with real quotes before buying.";

const PANELS = [
  { id: "panel-100w", label: "Mono 100 Wp (12 V)", watts: 100, voc: 21.6, isc: 6.11, vmp: 17.8, priceIdr: 650000 },
  { id: "panel-200w", label: "Mono 200 Wp", watts: 200, voc: 24.3, isc: 10.7, vmp: 20.4, priceIdr: 1200000 },
  { id: "panel-450w", label: "Mono 450 Wp", watts: 450, voc: 49.3, isc: 11.6, vmp: 41.3, priceIdr: 2300000 },
  { id: "panel-550w", label: "Mono 550 Wp", watts: 550, voc: 49.6, isc: 14.0, vmp: 41.7, priceIdr: 2750000 },
];

const BATTERIES = [
  { id: "batt-la-12v-100ah", label: "Lead-acid 12 V 100 Ah", chemistry: "lead_acid", voltage: 12, capacityAh: 100, nominalKwh: 1.2, priceIdr: 1800000 },
  { id: "batt-la-12v-200ah", label: "Lead-acid 12 V 200 Ah", chemistry: "lead_acid", voltage: 12, capacityAh: 200, nominalKwh: 2.4, priceIdr: 3400000 },
  { id: "batt-lfp-12v-100ah", label: "LiFePO4 12.8 V 100 Ah", chemistry: "lifepo4", voltage: 12, capacityAh: 100, nominalKwh: 1.28, priceIdr: 3500000 },
  { id: "batt-lfp-24v-100ah", label: "LiFePO4 25.6 V 100 Ah", chemistry: "lifepo4", voltage: 24, capacityAh: 100, nominalKwh: 2.56, priceIdr: 7000000 },
  { id: "batt-lfp-48v-100ah", label: "LiFePO4 51.2 V 100 Ah", chemistry: "lifepo4", voltage: 48, capacityAh: 100, nominalKwh: 5.12, priceIdr: 14000000 },
  { id: "batt-nmc-48v-100ah", label: "NMC 48 V 100 Ah", chemistry: "nmc", voltage: 48, capacityAh: 100, nominalKwh: 4.8, priceIdr: 13000000 },
];

const CONTROLLERS = [
  { id: "ctrl-pwm-20a", label: "PWM 20 A (12/24 V)", type: "PWM", currentA: 20, maxVoltageV: 50, priceIdr: 250000 },
  { id: "ctrl-pwm-30a", label: "PWM 30 A (12/24 V)", type: "PWM", currentA: 30, maxVoltageV: 50, priceIdr: 400000 },
  { id: "ctrl-mppt-40a", label: "MPPT 40 A (12/24/48 V, 150 V max)", type: "MPPT", currentA: 40, maxVoltageV: 150, priceIdr: 1800000 },
  { id: "ctrl-mppt-60a", label: "MPPT 60 A (12/24/48 V, 150 V max)", type: "MPPT", currentA: 60, maxVoltageV: 150, priceIdr: 3200000 },
  { id: "ctrl-mppt-100a", label: "MPPT 100 A (48 V, 250 V max)", type: "MPPT", currentA: 100, maxVoltageV: 250, priceIdr: 6500000 },
];

const INVERTERS = [
  { id: "inv-500w", label: "Pure sine 500 W (surge 1000 W)", continuousW: 500, surgeW: 1000, priceIdr: 900000 },
  { id: "inv-1000w", label: "Pure sine 1000 W (surge 2000 W)", continuousW: 1000, surgeW: 2000, priceIdr: 1600000 },
  { id: "inv-2000w", label: "Pure sine 2000 W (surge 4000 W)", continuousW: 2000, surgeW: 4000, priceIdr: 3200000 },
  { id: "inv-3000w", label: "Pure sine 3000 W (surge 6000 W)", continuousW: 3000, surgeW: 6000, priceIdr: 4500000 },
  { id: "inv-5000w", label: "Hybrid 5000 W (surge 10000 W)", continuousW: 5000, surgeW: 10000, priceIdr: 9000000 },
];

const BOS_FRACTION = 0.15; // cables, MCB, mounting, connectors

function pickCheapest(items, predicate, what) {
  const ok = items.filter(predicate).sort((a, b) => a.priceIdr - b.priceIdr);
  if (ok.length === 0) throw new InputError(`No catalog ${what} meets the requirement — catalog too small for this system.`);
  return ok[0];
}

/**
 * Build a cost estimate from a sizing result.
 * `sizing` is the object returned by the library `sizeSystem()` helper
 * (see index.js): { panel, battery, controller, inverter }.
 */
function estimateCost(sizing) {
  const panel = pickCheapest(
    PANELS,
    (p) => p.watts === sizing.panel.panelW,
    "panel"
  );
  const panelCost = panel.priceIdr * sizing.panel.panelCount;

  const battery = pickCheapest(
    BATTERIES.filter((b) => b.chemistry === sizing.battery.chemistry && b.voltage === sizing.battery.voltage),
    (b) => b.nominalKwh * Math.ceil(sizing.battery.nominalKwh / b.nominalKwh) >= sizing.battery.nominalKwh,
    "battery"
  );
  const batteryUnits = Math.ceil(sizing.battery.nominalKwh / battery.nominalKwh);
  const batteryCost = battery.priceIdr * batteryUnits;

  const controller = pickCheapest(
    CONTROLLERS.filter((c) => c.type === sizing.controller.type),
    (c) => c.currentA >= sizing.controller.requiredCurrentA
      && c.maxVoltageV >= sizing.controller.maxInputVoltageV,
    "charge controller"
  );

  const inverter = pickCheapest(
    INVERTERS,
    (inv) => inv.continuousW >= sizing.inverter.continuousW && inv.surgeW >= sizing.inverter.surgeW,
    "inverter"
  );

  const items = [
    { component: `Panel surya — ${panel.label} × ${sizing.panel.panelCount}`, qty: sizing.panel.panelCount, unitPriceIdr: panel.priceIdr, totalIdr: panelCost },
    { component: `Baterai — ${battery.label} × ${batteryUnits}`, qty: batteryUnits, unitPriceIdr: battery.priceIdr, totalIdr: batteryCost },
    { component: `Charge controller — ${controller.label}`, qty: 1, unitPriceIdr: controller.priceIdr, totalIdr: controller.priceIdr },
    { component: `Inverter — ${inverter.label}`, qty: 1, unitPriceIdr: inverter.priceIdr, totalIdr: inverter.priceIdr },
  ];
  const subtotal = items.reduce((s, i) => s + i.totalIdr, 0);
  const bos = Math.round(subtotal * BOS_FRACTION);
  return {
    disclaimer: PRICE_DISCLAIMER,
    currency: "IDR",
    items,
    subtotalIdr: subtotal,
    bosIdr: bos,
    bosNote: `Balance of system (kabel, MCB, mounting, konektor): ${Math.round(BOS_FRACTION * 100)}% of subtotal.`,
    totalIdr: subtotal + bos,
    costPerWpIdr: round((subtotal + bos) / sizing.panel.installedWp, 0),
  };
}

/** Format an IDR amount the Indonesian way: Rp1.234.567 */
function fmtIdr(amount) {
  return `Rp${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

module.exports = { PRICE_DISCLAIMER, PANELS, BATTERIES, CONTROLLERS, INVERTERS, BOS_FRACTION, estimateCost, fmtIdr };
