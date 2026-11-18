/**
 * loadProfile.js — load and validate a daily load profile.
 *
 * Accepted JSON shapes:
 *   1. Hourly array:  { "name": "...", "hourly": [w0..w23] }
 *   2. Appliance list: { "name": "...", "appliances": [
 *        { "name": "...", "watts": 100, "hours": [0,1,2,...] } ] }
 *      (`hours` is the list of hour indices the appliance runs; an
 *      appliance may also give "hoursPerDay" with a "startHour" instead,
 *      or a plain "hoursPerDay" spread evenly — see buildFromAppliances.)
 *   3. Appliance list with start hour:
 *        { "name": "...", "watts": 100, "startHour": 18, "hoursPerDay": 4 }
 *
 * Validation: exactly 24 hourly values, every value a finite number
 * >= 0, total daily energy > 0. Anything else is an InputError with a
 * message that names the problem.
 */
"use strict";

const fs = require("node:fs");
const { InputError } = require("./errors");

function validateHourly(hourly, sourceName) {
  if (!Array.isArray(hourly)) {
    throw new InputError(`Profile "${sourceName}": "hourly" must be an array of 24 watt values.`);
  }
  if (hourly.length !== 24) {
    throw new InputError(
      `Profile "${sourceName}": "hourly" must have exactly 24 values, got ${hourly.length}.`
    );
  }
  for (let i = 0; i < 24; i += 1) {
    const v = hourly[i];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
      throw new InputError(
        `Profile "${sourceName}": hour ${i} must be a non-negative number, got ${JSON.stringify(v)}.`
      );
    }
  }
  const total = hourly.reduce((s, v) => s + v, 0);
  if (total <= 0) {
    throw new InputError(`Profile "${sourceName}": total daily energy must be > 0 Wh.`);
  }
  return hourly.slice();
}

/** Build the 24-hour array from an appliance list. */
function buildFromAppliances(appliances, sourceName) {
  if (!Array.isArray(appliances) || appliances.length === 0) {
    throw new InputError(`Profile "${sourceName}": "appliances" must be a non-empty array.`);
  }
  const hourly = new Array(24).fill(0);
  for (const app of appliances) {
    if (typeof app.watts !== "number" || !Number.isFinite(app.watts) || app.watts < 0) {
      throw new InputError(
        `Profile "${sourceName}": appliance "${app.name || "?"}" needs a non-negative "watts".`
      );
    }
    if (Array.isArray(app.hours)) {
      for (const h of app.hours) {
        if (!Number.isInteger(h) || h < 0 || h > 23) {
          throw new InputError(
            `Profile "${sourceName}": appliance "${app.name || "?"}" has invalid hour ${JSON.stringify(h)} (must be 0..23).`
          );
        }
        hourly[h] += app.watts;
      }
    } else if (typeof app.hoursPerDay === "number" && typeof app.startHour === "number") {
      if (!Number.isInteger(app.startHour) || app.startHour < 0 || app.startHour > 23) {
        throw new InputError(
          `Profile "${sourceName}": appliance "${app.name || "?"}" has invalid "startHour".`
        );
      }
      if (app.hoursPerDay <= 0 || app.hoursPerDay > 24) {
        throw new InputError(
          `Profile "${sourceName}": appliance "${app.name || "?"}" has invalid "hoursPerDay".`
        );
      }
      const whole = Math.floor(app.hoursPerDay);
      for (let k = 0; k < whole; k += 1) {
        hourly[(app.startHour + k) % 24] += app.watts;
      }
      const frac = app.hoursPerDay - whole;
      if (frac > 0) hourly[(app.startHour + whole) % 24] += app.watts * frac;
    } else {
      throw new InputError(
        `Profile "${sourceName}": appliance "${app.name || "?"}" needs either "hours" (list of hour indices) or "startHour" + "hoursPerDay".`
      );
    }
  }
  return validateHourly(hourly, sourceName);
}

/** Parse an already-read object into a normalized profile. */
function parseProfile(data, sourceName = "profile") {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new InputError(`Profile "${sourceName}": expected a JSON object.`);
  }
  const name = typeof data.name === "string" && data.name.trim() !== ""
    ? data.name.trim()
    : sourceName;
  let hourly;
  if (data.hourly !== undefined) {
    hourly = validateHourly(data.hourly, name);
  } else if (data.appliances !== undefined) {
    hourly = buildFromAppliances(data.appliances, name);
  } else {
    throw new InputError(
      `Profile "${name}": needs either "hourly" (24 watt values) or "appliances".`
    );
  }
  return {
    name,
    hourly,
    dailyWh: hourly.reduce((s, v) => s + v, 0),
    peakW: Math.max(...hourly),
    peakHour: hourly.indexOf(Math.max(...hourly)),
    nightWh: hourly.slice(0, 6).reduce((s, v) => s + v, 0)
      + hourly.slice(18).reduce((s, v) => s + v, 0),
  };
}

/** Read and parse a profile JSON file. */
function loadProfileFile(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    throw new InputError(`Cannot read profile file "${filePath}": ${err.message}`);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new InputError(`Profile file "${filePath}" is not valid JSON: ${err.message}`);
  }
  return parseProfile(data, filePath);
}

/** A profile object may be a single object or an array (batch mode). */
function loadProfilesFile(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    throw new InputError(`Cannot read profile file "${filePath}": ${err.message}`);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new InputError(`Profile file "${filePath}" is not valid JSON: ${err.message}`);
  }
  if (Array.isArray(data)) {
    if (data.length === 0) throw new InputError(`Profile file "${filePath}": empty array.`);
    return data.map((item, i) => parseProfile(item, `${filePath}[${i}]`));
  }
  return [parseProfile(data, filePath)];
}

module.exports = { parseProfile, loadProfileFile, loadProfilesFile, validateHourly, buildFromAppliances };
