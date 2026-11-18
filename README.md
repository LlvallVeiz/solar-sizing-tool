# solar-sizing-tool

Off-grid solar PV sizing calculator — pure Node.js, zero runtime
dependencies. Give it a daily load profile and a location, and it
sizes the whole system: PV array, battery bank, charge controller,
inverter, cable, and an example cost estimate, with monthly
variation, tilt optimisation, sensitivity analysis and a feasibility
check for an existing installation.

## Background / theory

The core sizing equation is the standard textbook one:

```
requiredWp = dailyWh / (PSH × PR)
```

- **PSH (Peak Sun Hours)** = daily irradiation in kWh/m²/day. The
  tool ships reference PSH data for 20 cities (8 Indonesian + 12
  world cities) — monthly means 2020–2024 from the **NASA POWER**
  API (`ALLSKY_SFC_SW_DWN`), fetched 2026-11-18. See
  `docs/RESEARCH.md` for the full table and cross-checks.
- **PR (performance ratio)** is the product of the loss factors:
  temperature (NOCT cell-temperature model, γ = −0.40 %/°C —
  at 28 °C ambient the cell runs at ≈ 59 °C and loses ≈ 13.7%),
  soiling 5%, wiring 2%, inverter 95%, battery round-trip
  (lead-acid 80% / LiFePO4 92% / NMC 90%), misc 2%. A typical
  LiFePO4 system at 28 °C lands at PR ≈ 0.69.
- **Battery:** `nominalWh = dailyWh × autonomyDays / (DoD × tempFactor)`,
  DoD 50% lead-acid / 80% LiFePO4 / 85% NMC, with a temperature
  capacity factor (planning rule of thumb).
- **Controller:** NEC 690.8 — rated for 125% of array short-circuit
  current; MPPT recommended when array Vmp is well above battery
  voltage or the array is > 200 W.
- **Inverter:** continuous ≥ 1.25 × peak load, surge ≥ 3 × peak
  (or a user-supplied surge figure).
- **Cable:** copper ρ = 0.0171 Ω·mm²/m, target voltage drop ≤ 3%.

This is a **planning calculator**, not a replacement for PVsyst /
PVWatts / SAM: it uses GHI (not plane-of-array irradiance), has no
shading model and no hourly simulation. Prices in the catalog are
**example prices (IDR), not live market prices** — replace them
with real quotes before buying.

## Project structure

```
solar-sizing-tool/
├── bin/solar.js            CLI entry point
├── src/
│   ├── index.js            Public API: sizeSystem() + re-exports
│   ├── cli.js              Subcommands: size, compare, tilt, monthly,
│   │                       sensitivity, check
│   ├── locations.js        Reference PSH data, 20 cities (NASA POWER)
│   ├── profiles.js         Built-in load presets (5 profiles)
│   ├── loadProfile.js      Profile JSON parsing + validation
│   ├── panel.js            Losses (NOCT temp model) + array sizing
│   ├── battery.js          Battery sizing by chemistry (DoD, temp)
│   ├── components.js       Controller (NEC 690.8), inverter, cable
│   ├── analysis.js         Tilt, monthly variation, sensitivity,
│   │                       feasibility check
│   ├── catalog.js          Example component catalog + cost estimate
│   ├── compare.js          Side-by-side system comparison
│   ├── report.js           Text / CSV / JSON rendering
│   ├── units.js            Formatting and unit helpers
│   └── errors.js           InputError / InternalError
├── tests/                  node:test suite (no dependencies)
├── examples/               Profile JSONs + real CLI outputs
├── docs/RESEARCH.md        Sources, formulas, cross-checks
├── package.json  LICENSE  .gitignore
└── README.md
```

## How to run

Requires Node.js ≥ 18. No dependencies to install.

```bash
node --test tests/*.test.js          # run the test suite
node bin/solar.js --help             # usage

# Size a system for the built-in small-household preset in Jakarta
node bin/solar.js size --preset rumah-kecil --location jakarta

# Same profile, worst-month sizing, lead-acid, 48 V
node bin/solar.js size --preset rumah-kecil --location jakarta \
  --worst-month --chemistry lead_acid --voltage 48

# Your own profile file (hourly array or appliance list)
node bin/solar.js size --profile examples/rumah-kecil.json --location surabaya

# Compare all presets, or a batch file, at one location (CSV too)
node bin/solar.js compare --location jakarta
node bin/solar.js compare --profile examples/batch-compare.json --location jakarta --format csv

# Optimal tilt, monthly variation, sensitivity, feasibility check
node bin/solar.js tilt --location jakarta
node bin/solar.js monthly --preset rumah-menengah --location jakarta
node bin/solar.js sensitivity --preset rumah-kecil --location jakarta
node bin/solar.js check --preset rumah-kecil --location jakarta \
  --panels 2 --panel-w 550 --battery-kwh 7.68
```

Common options: `--psh <h>` (override PSH), `--autonomy <days>`
(default 2), `--chemistry lead_acid|lifepo4|nmc`,
`--voltage 12|24|48`, `--panel-w <W>` (default 550),
`--ambient <°C>` (default 28), `--surge <W>`,
`--cable-length <m>` (default 10), `--worst-month`,
`--format text|json|csv`, `--output <file>`.

Presets: `rumah-kecil` (2.59 kWh/day), `rumah-menengah`
(7.58 kWh/day), `warung` (5.95 kWh/day), `kantor-kecil`
(13.53 kWh/day), `iot-offgrid` (0.325 kWh/day).
Locations: `jakarta surabaya bandung yogyakarta medan makassar
denpasar semarang singapore bangkok manila tokyo sydney berlin
london new_york los_angeles dubai cairo nairobi`.

Profile JSON format (hourly array, or appliances):

```json
{ "name": "Rumah kecil", "hourly": [50, 50, 50, "... 24 values ..."] }
```

```json
{ "name": "Warung", "appliances": [
  { "name": "Freezer box", "watts": 200, "startHour": 0, "hoursPerDay": 17 },
  { "name": "Lampu toko", "watts": 60, "hours": [6, 7, 8, 9, 10, 11, 12, 13] }
] }
```

## Example output (real runs)

### Small household — Jakarta (`size --preset rumah-kecil --location jakarta`)

Daily load 2.59 kWh, PSH 4.64 h/day (worst month Jun 4.22 h),
PR 68.8% (cell 59.3 °C):

```
PV ARRAY
Required array            : 811.1 W
Panels                    : 2 × 550 W = 1.1 kW
Expected daily yield      : 3.513 kWh (135.6% of load)

BATTERY
Chemistry                 : LiFePO4 (lithium iron phosphate)
Autonomy target           : 2 day(s)
Usable energy             : 5.18 kWh
Nominal capacity          : 6.417 kWh (267.4 Ah @ 24 V)

CHARGE CONTROLLER
Type                      : MPPT
Required current          : 35 A (array Isc 28 A × 1.25)

INVERTER
Continuous                : 400 W (peak × 1.25)
Surge                     : 960 W

CABLE (array → controller)
Recommended size          : 16 mm² — drop 2.49% over 10 m @ 28 A

ESTIMATED COST (example prices — NOT live market prices)
TOTAL (estimate)          : Rp33.580.000
```

Full output: `examples/rumah-kecil.output.txt`.

### Small office — Surabaya (`size --preset kantor-kecil --location surabaya`)

Daily load 13.53 kWh, PSH 5.11 h/day → array 3.85 kW
(7 × 550 W), battery 33.52 kWh (1396.8 Ah @ 24 V, LiFePO4,
2 days autonomy), MPPT 70 A (array Isc 56 A × 1.25), inverter
1.75 kW continuous / 4.2 kW surge, cable 35 mm² (drop 2.28%),
estimated cost Rp147.487.500 (example prices).
Full output: `examples/kantor-kecil.output.txt`.

### Off-grid IoT node — Denpasar (`size --preset iot-offgrid --location denpasar --panel-w 100 --voltage 12`)

Daily load 325 Wh, PSH 5.51 h/day → array 85.7 W (1 × 100 W
panel), battery 805.3 Wh (67.1 Ah @ 12 V, LiFePO4), PWM
controller 7.64 A, estimated cost Rp6.095.000 (example prices).
Full output: `examples/iot-offgrid.output.txt`.

### Monthly variation — medium household, Jakarta

Worst month June (4.22 h) needs 2.61 kW (5 × 550 W panels);
best month September (5.29 h) needs 2.08 kW (4 panels).
Full table: `examples/monthly-rumah-menengah.output.txt`.

### Sensitivity — small household, Jakarta

Worst case (PSH −20%, load +20%) needs 1216.6 Wp (3 panels)
and a 7.70 kWh battery; best case (PSH +20%, load −20%) needs
only 540.7 Wp (1 panel). Full table:
`examples/sensitivity-rumah-kecil.output.txt`.

### Comparison — batch file, Jakarta

| System | Daily | PSH | Array | Panels | Battery | Cost (est.) |
|---|---|---|---|---|---|---|
| Rumah kecil | 2.59 kWh | 4.64 h | 811.1 W | 2×550W | 6.417 kWh | Rp33.580.000 |
| Warung | 5.95 kWh | 4.64 h | 1.86 kW | 4×550W | 14.742 kWh | Rp70.265.000 |
| Kantor kecil | 13.53 kWh | 4.64 h | 4.24 kW | 8×550W | 33.523 kWh | Rp150.650.000 |

Full outputs: `examples/batch-compare.output.txt` (+ `.csv`).

## Verification

- **Test suite: 72/72 tests pass** (`node --test tests/*.test.js`,
  Node v24.22.1, zero dependencies).
- **Independent cross-check** (separate script, recomputed from
  first principles, no library code): rumah-kecil required array
  811.1 Wp, 2 panels, battery 6.417 kWh / 267.4 Ah @ 24 V;
  worst-month array 891.8 Wp; kantor-kecil 3847.5 Wp / 7 panels;
  IoT node 85.7 Wp / 1 panel — all match the tool's output
  exactly. The test files record the hand-computed values inline
  (cell temperature 59.25 °C, temperature factor 0.863, PR 0.6732
  at battery round-trip 0.90 / 0.6882 at 0.92, NEC 35 A controller,
  cable 16 mm² at 2.49% drop).
- **Feasibility check verified:** 2 × 550 W + 7.68 kWh LFP is
  FEASIBLE for rumah-kecil in Jakarta (worst-month yield covers
  the load, 2.39 days autonomy); 1 × 550 W fails the worst-month
  balance; a 1.28 kWh battery fails the autonomy check.

## Design decisions

- **Zero runtime dependencies** (same pattern as the sibling
  project `power-budget-calculator`): `node:test` for tests,
  hand-rolled argument parsing, no npm install needed.
- **GHI-based PSH, not plane-of-array:** conservative and
  transparent; tilt gain is reported separately as a rough
  heuristic rather than silently folded into PSH.
- **Annual-mean sizing by default, worst-month on request**
  (`--worst-month`): annual sizing is cheaper and standard for
  grid-tied thinking, but off-grid systems that must survive the
  rainy season should be checked against the worst month — the
  `monthly` and `check` commands make that explicit.
- **Catalog prices are examples:** the estimator is for
  demonstrating the cost pipeline, not for purchasing decisions;
  every cost output carries the disclaimer.
- **Array wiring caps parallel strings at 4:** large arrays are
  wired in series strings so controller current and cable size
  stay realistic.

## Limitations & future work

- No shading, tilt transposition model, or hourly simulation —
  use PVGIS / NREL SAM for bankable yield estimates.
- Temperature capacity factors and the tilt-gain heuristic are
  planning rules of thumb, not datasheet values.
- The example catalog tops out at a 100 A MPPT controller; very
  large systems report no cost estimate instead of a wrong one.
- Future: PVGIS/SAM-style POA transposition, hourly load vs
  production matching, payback/ROI estimate, more locations,
  real price import.

## License

MIT — see `LICENSE`.
