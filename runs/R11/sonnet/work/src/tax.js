'use strict';
const money = require('./money');

const RATES = {
  UK: { standard: 20, reduced: 5, zero: 0 },
  IE: { standard: 23, reduced: 13.5, zero: 0 },
  DE: { standard: 19, reduced: 7, zero: 0 },
  US: { standard: 0, reduced: 0, zero: 0 }, // sales tax handled elsewhere
};

function rateFor(region, category = 'standard') {
  const r = RATES[region];
  if (!r) throw new Error(`Unknown tax region ${region}`);
  if (!(category in r)) throw new Error(`Unknown tax category ${category}`);
  return r[category];
}

// Tax on a net amount in pence.
function taxOn(net, region, category = 'standard') {
  return money.percent(net, rateFor(region, category));
}

// Tax for several lines that may have different categories, net of an order-level discount.
// The discount is spread across lines in proportion to their net value.
function taxForLines(lines, region, discount = 0) {
  const nets = lines.map((l) => l.net);
  const total = nets.reduce((s, n) => s + n, 0);
  const shares = total > 0 && discount > 0 ? money.allocate(discount, nets) : nets.map(() => 0);
  return lines.reduce((sum, l, i) => sum + taxOn(l.net - shares[i], region, l.taxCategory || 'standard'), 0);
}

function grossToNet(gross, region, category = 'standard') {
  const r = rateFor(region, category);
  return money.roundHalfUp(gross / (1 + r / 100));
}

module.exports = { RATES, rateFor, taxOn, taxForLines, grossToNet };
