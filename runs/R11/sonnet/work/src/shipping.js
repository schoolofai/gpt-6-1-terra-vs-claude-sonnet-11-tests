'use strict';
const money = require('./money');
const dates = require('./dates');

// Weight bands in grams -> price in pence, per zone.
const ZONES = {
  UK: [[250, 349], [1000, 495], [2000, 695], [10000, 1195], [30000, 1995]],
  EU: [[250, 795], [1000, 1295], [2000, 1695], [10000, 2995], [30000, 4995]],
  WORLD: [[250, 1095], [1000, 1795], [2000, 2595], [10000, 4495], [30000, 7995]],
};
const REGION_ZONE = { UK: 'UK', IE: 'EU', DE: 'EU', US: 'WORLD' };
const FREE_SHIPPING_UK = 5000; // orders >= £50 net ship free within UK
const DISPATCH_DAYS = { UK: 1, EU: 3, WORLD: 5 };

function zoneFor(region) {
  const z = REGION_ZONE[region];
  if (!z) throw new Error(`No shipping zone for ${region}`);
  return z;
}

function parcelWeight(lines, weights) {
  let g = 0;
  for (const l of lines) {
    const w = weights[l.sku];
    if (w == null) throw new Error(`No weight for ${l.sku}`);
    g += w * l.qty;
  }
  return g;
}

// Split heavy shipments into parcels of at most 30kg.
function splitParcels(totalGrams, max = 30000) {
  if (totalGrams <= 0) return [];
  const n = Math.ceil(totalGrams / max);
  return money.splitEvenly(totalGrams, n);
}

function bandPrice(zone, grams) {
  const band = ZONES[zone].find(([limit]) => grams <= limit);
  if (!band) throw new Error(`Parcel too heavy: ${grams}g`);
  return band[1];
}

function quote({ region, lines, weights, net }) {
  const zone = zoneFor(region);
  if (zone === 'UK' && net >= FREE_SHIPPING_UK) return { zone, parcels: [], cost: 0, free: true };
  const grams = parcelWeight(lines, weights);
  const parcels = splitParcels(grams);
  const cost = parcels.reduce((s, g) => s + bandPrice(zone, g), 0);
  return { zone, parcels, cost, free: false };
}

function estimatedDelivery(region, orderDate) {
  return dates.addBusinessDays(orderDate, DISPATCH_DAYS[zoneFor(region)]);
}

module.exports = { ZONES, REGION_ZONE, FREE_SHIPPING_UK, zoneFor, parcelWeight, splitParcels, bandPrice, quote, estimatedDelivery };
