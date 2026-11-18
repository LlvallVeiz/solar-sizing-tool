/**
 * profiles.js — built-in daily load-profile presets.
 *
 * Each preset is a 24-element hourly load in watts (hour 00..23, local
 * time) plus a human-readable appliance breakdown that explains where
 * the watts come from. The hourly array is the source of truth; the
 * appliance list is documentation and must roughly add up to the same
 * daily energy (checked in tests).
 *
 * Daily energies (computed from the arrays, verified by the test suite):
 * - rumah-kecil   ~2.59 kWh/day — small household, no AC
 * - rumah-menengah ~7.58 kWh/day — household with one AC at night
 * - warung        ~5.95 kWh/day — small shop with a chest freezer
 * - kantor-kecil  ~13.53 kWh/day — small office, 2 AC units in the day
 * - iot-offgrid   ~0.33 kWh/day — off-grid sensor node + camera
 */
"use strict";

const PRESETS = {
  "rumah-kecil": {
    name: "Rumah tangga kecil",
    description:
      "Small household: small fridge, fans, lights, TV, rice cooker, phone charging. No air conditioning.",
    hourly: [
      50, 50, 50, 50, 50, 50,
      150, 180, 120, 80, 60, 60,
      90, 60, 60, 70,
      90, 220, 320, 280,
      200, 120, 80, 50,
    ],
    appliances: [
      { name: "Kulkas kecil (100 W, duty 50%)", watts: 100, hoursPerDay: 12 },
      { name: "Kipas angin 2x (40 W)", watts: 80, hoursPerDay: 10 },
      { name: "Lampu LED (40 W total)", watts: 40, hoursPerDay: 8 },
      { name: "TV 32\" (60 W)", watts: 60, hoursPerDay: 5 },
      { name: "Rice cooker (350 W)", watts: 350, hoursPerDay: 1 },
      { name: "Pompa air (125 W)", watts: 125, hoursPerDay: 1 },
      { name: "Charger HP/laptop (25 W)", watts: 25, hoursPerDay: 4 },
    ],
  },
  "rumah-menengah": {
    name: "Rumah tangga menengah",
    description:
      "Medium household: large fridge, one 1 PK AC at night, washing machine, TV, rice cooker, water pump.",
    hourly: [
      120, 120, 120, 120, 120, 120,
      350, 420, 300, 200, 180, 200,
      350, 220, 200, 220,
      300, 650, 850, 900,
      700, 450, 250, 120,
    ],
    appliances: [
      { name: "Kulkas 2 pintu (150 W, duty 60%)", watts: 150, hoursPerDay: 14 },
      { name: "AC 1 PK (750 W)", watts: 750, hoursPerDay: 8 },
      { name: "Mesin cuci (300 W)", watts: 300, hoursPerDay: 1.5 },
      { name: "TV 43\" (100 W)", watts: 100, hoursPerDay: 6 },
      { name: "Rice cooker (400 W)", watts: 400, hoursPerDay: 1.5 },
      { name: "Pompa air (250 W)", watts: 250, hoursPerDay: 1 },
      { name: "Lampu LED (60 W total)", watts: 60, hoursPerDay: 10 },
      { name: "Kipas angin (50 W)", watts: 50, hoursPerDay: 8 },
    ],
  },
  warung: {
    name: "Warung / toko kelontong",
    description:
      "Small shop: chest freezer running all day, lights, fan, blender, rice cooker, phone charging for customers.",
    hourly: [
      160, 160, 160, 160, 160, 160,
      260, 300, 280, 240, 240, 240,
      280, 240, 240, 240,
      260, 380, 420, 400,
      350, 260, 200, 160,
    ],
    appliances: [
      { name: "Freezer box (200 W, duty 70%)", watts: 200, hoursPerDay: 17 },
      { name: "Lampu toko (60 W)", watts: 60, hoursPerDay: 14 },
      { name: "Kipas angin (50 W)", watts: 50, hoursPerDay: 12 },
      { name: "Blender (300 W)", watts: 300, hoursPerDay: 1 },
      { name: "Rice cooker (350 W)", watts: 350, hoursPerDay: 1 },
      { name: "Kulkas minuman (120 W, duty 50%)", watts: 120, hoursPerDay: 12 },
    ],
  },
  "kantor-kecil": {
    name: "Kantor kecil",
    description:
      "Small office: 2 AC units during work hours, 4 PCs, printer, lights, water dispenser, small server running 24 h.",
    hourly: [
      60, 60, 60, 60, 60, 60, 60,
      300, 800, 1200, 1400, 1400,
      1300, 1400, 1400, 1400,
      1200, 700, 250, 100,
      80, 60, 60, 60,
    ],
    appliances: [
      { name: "AC 1 PK 2x (750 W)", watts: 1500, hoursPerDay: 9 },
      { name: "PC + monitor 4x (120 W)", watts: 480, hoursPerDay: 9 },
      { name: "Server kecil + router (60 W)", watts: 60, hoursPerDay: 24 },
      { name: "Lampu kantor (120 W)", watts: 120, hoursPerDay: 10 },
      { name: "Printer (200 W)", watts: 200, hoursPerDay: 1 },
      { name: "Dispenser (100 W)", watts: 100, hoursPerDay: 8 },
    ],
  },
  "iot-offgrid": {
    name: "Node IoT off-grid",
    description:
      "Off-grid sensor node: ESP32 + sensors, LoRa radio, camera trap at night, small LED light. The VOLTREAD-style use case.",
    hourly: [
      8, 8, 8, 8, 8, 8,
      12, 15, 10, 10, 10, 10,
      10, 10, 10, 10, 10, 10,
      25, 25, 25, 25, 25, 25,
    ],
    appliances: [
      { name: "ESP32 + sensor (8 W)", watts: 8, hoursPerDay: 24 },
      { name: "Radio LoRa TX burst (7 W)", watts: 7, hoursPerDay: 2 },
      { name: "Kamera trap + IR (17 W)", watts: 17, hoursPerDay: 6 },
      { name: "Lampu LED (10 W)", watts: 10, hoursPerDay: 2 },
    ],
  },
};

function getPreset(key) {
  const normalized = String(key).trim().toLowerCase();
  const preset = PRESETS[normalized];
  if (!preset) {
    const { InputError } = require("./errors");
    throw new InputError(
      `Unknown preset "${key}". Known presets: ${Object.keys(PRESETS).join(", ")}.`
    );
  }
  return { key: normalized, ...preset };
}

function listPresets() {
  return Object.entries(PRESETS).map(([key, p]) => ({
    key,
    name: p.name,
    dailyWh: p.hourly.reduce((s, w) => s + w, 0),
    peakW: Math.max(...p.hourly),
  }));
}

module.exports = { PRESETS, getPreset, listPresets };
