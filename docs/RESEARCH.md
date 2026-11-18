# Research Notes — solar-sizing-tool

How the sizing math in this tool is grounded, where every reference
number comes from, and what is deliberately approximate. All
irradiation values in the code were fetched from the NASA POWER API
on 2026-11-18 (monthly means, 2020–2024); the raw fetch is
reproducible with the API call documented below.

## 1. Solar resource: Peak Sun Hours from NASA POWER

**Definition.** Peak Sun Hours (PSH) = daily irradiation in
kWh/m²/day divided by the 1000 W/m² reference irradiance. A site
with 4.64 kWh/m²/day of irradiation has 4.64 PSH — the energy of
4.64 hours at full sun.

**Source.** NASA POWER (Prediction Of Worldwide Energy Resources),
parameter `ALLSKY_SFC_SW_DWN` (all-sky surface shortwave downward
irradiance, kWh/m²/day), monthly means averaged over 2020–2024,
fetched 2026-11-18 via:

```
https://power.larc.nasa.gov/api/temporal/monthly/point
  ?parameters=ALLSKY_SFC_SW_DWN&community=RE
  &longitude=<lon>&latitude=<lat>&format=JSON&start=2020&end=2024
```

POWER is the successor of the retired NASA SSE archive and is built
from CERES satellite radiation data and MERRA-2 meteorology
(Stackhouse et al., NASA POWER project documentation). The values in
`src/locations.js` are the 5-year monthly means from that fetch,
rounded to 2 decimals.

**Annual PSH used by the tool (kWh/m²/day):**

| Location | Annual | Worst month | Best month |
|---|---|---|---|
| Jakarta | 4.64 | Jun 4.22 | Sep 5.29 |
| Surabaya | 5.11 | Jun 4.64 | Sep 5.96 |
| Bandung | 4.86 | Feb 4.22 | Sep 5.66 |
| Yogyakarta | 5.01 | Feb 4.53 | Sep 5.80 |
| Medan | 4.70 | Dec 3.88 | Mar 5.25 |
| Makassar | 5.26 | Dec 4.33 | Oct 6.30 |
| Denpasar | 5.51 | Jun 4.94 | Oct 6.32 |
| Semarang | 5.04 | Jan 4.20 | Sep 6.05 |
| Singapore | 4.55 | Dec 4.15 | Mar 5.27 |
| Bangkok | 5.23 | Oct 4.50 | Mar/Apr 5.80 |
| Manila | 5.19 | Dec 4.06 | Apr 6.48 |
| Tokyo | 3.97 | Dec 2.65 | Aug 5.15 |
| Sydney | 4.58 | Jun 2.52 | Dec 6.66 |
| Berlin | 2.91 | Dec 0.48 | Jun 5.49 |
| London | 3.01 | Dec 0.61 | Jun 5.59 |
| New York | 3.97 | Dec 1.63 | Jun 6.25 |
| Los Angeles | 5.60 | Dec 2.73 | Jul 8.05 |
| Dubai | 5.52 | Dec 3.69 | Jun 6.99 |
| Cairo | 5.74 | Dec 3.23 | Jun 7.99 |
| Nairobi | 5.73 | Jul 4.52 | Mar 6.71 |

**Cross-checks (same order of magnitude, different datasets).**
Jakarta annual 4.64 here vs 5.03 in the 10-year NASA SSE insolation
table (Jinyi Solar) and Surabaya 5.11 here vs 5.54 from a PVWatts
study of Indonesian cities (UNISMA, 2025) — differences of ~0.4–0.5
kWh/m²/day come from dataset vintage, spatial resolution and the
plane (GHI vs tilted plane). Indonesia's national average of
~4.8 kWh/m²/day is consistent with these city values (Hardianto,
2019, via IJRED 2012). The tool uses **GHI, not plane-of-array
irradiance**, so it is a conservative planning estimate: a tilted
array typically gains a few percent over GHI near the equator.

## 2. Array sizing and the performance ratio

Standard textbook equation:

```
requiredWp = dailyWh / (PSH × PR)
```

`PR` (performance ratio) is the product of the loss factors. The
tool's defaults, and why:

- **Temperature.** Cell temperature from the NOCT model
  `T_cell = T_amb + (NOCT − 20)/800 × G` and power derating
  `P = P_STC × (1 + γ(T_cell − 25))`, γ = −0.004/°C for crystalline
  silicon. This is the linearised form of the Sandia array
  performance model (King, Boyson & Kratochvil, SAND2004-3535).
  At T_amb = 28 °C, NOCT = 45 °C, G = 1000 W/m²: T_cell ≈ 59 °C
  and the temperature factor is ≈ 0.863 — the largest single loss
  in the tropics. Typical datasheet γ for mono c-Si is
  −0.35…−0.45 %/°C; −0.40 %/°C is the planning midpoint.
- **Soiling 5%** (factor 0.95): dust and bird droppings; higher in
  dry/dusty sites, lower with regular rain.
- **Wiring 2%** (0.98): DC + AC cable losses at design current.
- **Inverter 95%**: modern pure-sine inverters are 93–97% efficient.
- **Battery round-trip**: lead-acid 80%, LiFePO4 92%, NMC 90%
  (planning values; see §3).
- **Misc 2%** (0.98): module mismatch, MPPT tracking error, ageing.

Resulting PR for a LiFePO4 system at 28 °C ambient is ≈ 0.69,
which matches the 0.65–0.75 range quoted for small off-grid
systems in sizing guides.

## 3. Battery sizing by chemistry

```
usableWh  = dailyWh × autonomyDays
nominalWh = usableWh / (DoD × tempCapacityFactor)
capacityAh = nominalWh / systemVoltage
```

| Chemistry | DoD | Round-trip | Cycle life (planning) |
|---|---|---|---|
| Lead-acid | 50% | 80% | 500–1200 cycles @ 50% DoD |
| LiFePO4 | 80% | 92% | 3000–6000 cycles @ 80% DoD |
| NMC | 85% | 90% | 1500–3000 cycles @ 80% DoD |

DoD limits are standard practice: deep-cycling lead-acid below
50% DoD collapses its cycle life, while LiFePO4 tolerates 80%
daily cycling. Round-trip efficiencies are the usual planning
values for the respective chemistries (lead-acid 75–85%,
lithium-ion 90–95%).

**Temperature capacity factor** (planning rule of thumb used by
the tool): lead-acid loses ≈ 0.6% of usable capacity per °C below
25 °C, lithium ≈ 0.3%/°C; clamped to [0.70, 1.10]. This is an
approximation, not a datasheet curve — real capacity curves vary
by manufacturer.

## 4. Charge controller, inverter, cable

- **Controller current — NEC 690.8.** PV circuits are continuous
  loads, so conductors and equipment are sized at 125% of the
  maximum circuit current: `I_req = I_sc(array) × 1.25`. The tool
  also applies a 1.25× allowance to string Voc for cold-morning
  voltage rise. (NFPA 70, National Electrical Code, Article 690.)
- **MPPT vs PWM.** MPPT is recommended when the array Vmp is well
  above the battery voltage (rule used here: Vmp > 1.5 × V_batt)
  or the array is larger than ~200 W; PWM is acceptable for small
  12 V systems where panel Vmp ≈ battery voltage, because the
  voltage a PWM controller throws away is small.
- **Inverter.** Continuous rating ≥ 1.25 × peak load; surge rating
  must cover motor starting surges (default 3 × peak load if the
  user does not supply a surge figure).
- **Cable voltage drop.** `R = 2·L·ρ/A`, `V_drop = I·R`, copper
  ρ = 0.0171 Ω·mm²/m at 20 °C; target ≤ 3% of system voltage.

## 5. Tilt angle

Rules of thumb used by the tool (not a transposition model):

- Annual fixed tilt ≈ |latitude|; winter ≈ |latitude| + 15°,
  summer ≈ |latitude| − 15° (clamped to 0–60°).
- Within ~15° of the equator the gain from tilting is small, so a
  10–15° tilt is recommended mainly so rain washes dust off.
- Rough gain of an optimally tilted fixed array over a horizontal
  one: `0.01 + 0.002 × |lat|`, capped at 0.15 — a planning
  heuristic. For a bankable number use PVGIS or NREL SAM, which
  run a real transposition model (Perez/Hay-Davies) on hourly data.

## 6. What this tool deliberately does NOT do

- No shading analysis, no hourly simulation, no plane-of-array
  transposition model — it is a planning calculator, not a
  replacement for PVsyst / PVWatts / SAM.
- No live prices: the catalog prices in `src/catalog.js` are round
  example figures in IDR, labelled as examples everywhere they
  appear. Replace them with real quotes before buying.
- No structural, electrical-code or permitting advice for a real
  installation; the NEC references are sizing rules, not a design
  sign-off.

## References

1. NASA POWER (Prediction Of Worldwide Energy Resources) — solar and
   meteorological data portal and API.
   https://power.larc.nasa.gov/ — data fetched 2026-11-18.
2. Stackhouse, P. W. et al. — NASA POWER project documentation and
   methodology (CERES + MERRA-2 based solar resource).
   https://www.earthdata.nasa.gov/data/projects/power
3. European Commission, Joint Research Centre — PVGIS
   (Photovoltaic Geographical Information System), solar radiation
   and PV performance data (SARAH3 / ERA5, 2005–2020 averages).
   https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/general-information/geospatial-data-download_en
4. World Bank Group / Solargis — Global Solar Atlas (long-term GHI
   and PV output layers).
   https://globalsolaratlas.info/
5. King, D. L., Boyson, W. E. & Kratochvil, J. A. — *Photovoltaic
   Array Performance Model*, Sandia National Laboratories,
   SAND2004-3535, 2004. https://www.osti.gov/servlets/purl/919131/
6. NFPA 70, National Electrical Code, Article 690 — Solar
   Photovoltaic (PV) Systems, §690.8 (circuit sizing, 125%
   continuous-load factor).
7. PVWatts-Based Assessment of Solar Photovoltaic Energy Potential
   in Indonesian Urban Areas (Serang 5.02, Yogyakarta 5.27,
   Surabaya 5.54 kWh/m²/day), RING ME, 2025.
   https://riset.unisma.ac.id/index.php/RINGME/article/view/25557
8. Insolation Levels (Asia-Pacific) — 10-year average monthly
   insolation table, NASA SSE based (Jakarta annual 5.03).
   https://www.jinyi-solar.com/uploads/solar-basics/Insolation%20Levels%20(Asia-Pacific).pdf
9. Hardianto, T. et al. — *Potency of Solar Energy Applications in
   Indonesia*, International Journal of Renewable Energy
   Development 1(2), 2012, doi:10.14710/ijred.1.2.33-38.
   https://garuda.kemdiktisaintek.go.id/documents/detail/3718517
10. NREL — *PVWatts Calculator* and *System Advisor Model (SAM)*,
    reference implementations of the sizing equations used here.
    https://pvwatts.nrel.gov/ — https://sam.nrel.gov/
