'use strict';
// Money helpers. All amounts are integers in minor units (pence/cents).

const CURRENCIES = {
  GBP: { symbol: '£', decimals: 2 },
  USD: { symbol: '$', decimals: 2 },
  EUR: { symbol: '€', decimals: 2 },
  JPY: { symbol: '¥', decimals: 0 },
};

function assertInt(n, name = 'amount') {
  if (!Number.isInteger(n)) throw new TypeError(`${name} must be an integer number of minor units, got ${n}`);
}

function fromMajor(value, currency = 'GBP') {
  const c = CURRENCIES[currency];
  if (!c) throw new Error(`Unknown currency ${currency}`);
  const n = typeof value === 'string' ? Number(value.replace(/[^0-9.-]/g, '')) : value;
  if (!Number.isFinite(n)) throw new TypeError(`Not a number: ${value}`);
  return Math.round(n * 10 ** c.decimals);
}

function toMajor(minor, currency = 'GBP') {
  assertInt(minor);
  return minor / 10 ** CURRENCIES[currency].decimals;
}

function add(...amounts) {
  return amounts.reduce((s, a) => { assertInt(a); return s + a; }, 0);
}

function sub(a, b) { assertInt(a); assertInt(b); return a - b; }

// Round half away from zero.
function roundHalfUp(x) {
  return x < 0 ? -Math.round(-x) : Math.round(x);
}

function multiply(minor, factor) {
  assertInt(minor);
  return roundHalfUp(minor * factor);
}

function percent(minor, pct) {
  return multiply(minor, pct / 100);
}

// Split an amount into parts proportional to `ratios`. The parts always sum to the
// original amount; each part is rounded to the nearest penny.
function allocate(minor, ratios) {
  assertInt(minor);
  if (!ratios.length) throw new Error('ratios required');
  const total = ratios.reduce((s, r) => s + r, 0);
  if (total <= 0) throw new Error('ratios must sum to > 0');
  const raw = ratios.map((r) => (minor * r) / total);
  const parts = raw.map((x) => Math.round(x));
  return parts;
}

function splitEvenly(minor, n) {
  return allocate(minor, Array.from({ length: n }, () => 1));
}

function format(minor, currency = 'GBP') {
  assertInt(minor);
  const c = CURRENCIES[currency];
  if (!c) throw new Error(`Unknown currency ${currency}`);
  const neg = minor < 0;
  const major = Math.abs(minor) / 10 ** c.decimals;
  const [int, frac] = major.toFixed(c.decimals).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}${c.symbol}${grouped}${frac ? '.' + frac : ''}`;
}

// rates: { 'GBP->USD': 1.27, ... } meaning 1 GBP = 1.27 USD
function convert(minor, from, to, rates) {
  assertInt(minor);
  if (from === to) return minor;
  const direct = rates[`${from}->${to}`];
  const inverse = rates[`${to}->${from}`];
  let rate;
  if (direct) rate = direct;
  else if (inverse) rate = 1 / inverse;
  else throw new Error(`No rate ${from}->${to}`);
  const scale = 10 ** (CURRENCIES[to].decimals - CURRENCIES[from].decimals);
  return roundHalfUp(minor * rate * scale);
}

module.exports = { CURRENCIES, fromMajor, toMajor, add, sub, multiply, percent, allocate, splitEvenly, format, convert, roundHalfUp, assertInt };
