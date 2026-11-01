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
  if (!Object.hasOwn(CURRENCIES, currency)) throw new Error(`Unknown currency ${currency}`);
  const cleaned = typeof value === 'string' ? value.replace(/[^0-9.-]/g, '') : null;
  if (cleaned !== null && !/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(cleaned)) throw new TypeError(`Not a number: ${value}`);
  const n = cleaned !== null ? Number(cleaned) : value;
  if (!Number.isFinite(n)) throw new TypeError(`Not a number: ${value}`);
  return roundHalfUp((n + Math.sign(n) * Number.EPSILON * Math.abs(n)) * 10 ** c.decimals);
}

function toMajor(minor, currency = 'GBP') {
  assertInt(minor);
  if (!Object.hasOwn(CURRENCIES, currency)) throw new Error(`Unknown currency ${currency}`);
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
  if (!Number.isFinite(factor)) throw new TypeError('factor must be finite');
  return roundHalfUp(minor * factor);
}

function percent(minor, pct) {
  assertInt(minor);
  if (!Number.isFinite(pct)) throw new TypeError('percent must be finite');
  return roundHalfUp(minor * pct / 100);
}

// Split an amount into parts proportional to `ratios`. The parts always sum to the
// original amount; each part is rounded to the nearest penny.
function allocate(minor, ratios) {
  assertInt(minor);
  if (!ratios.length) throw new Error('ratios required');
  if (ratios.some((r) => !Number.isFinite(r) || r < 0)) throw new Error('ratios must be finite and non-negative');
  const total = ratios.reduce((s, r) => s + r, 0);
  if (!Number.isFinite(total) || total <= 0) throw new Error('ratios must sum to > 0');
  const raw = ratios.map((r) => (Math.abs(minor) * r) / total);
  const parts = raw.map(Math.floor);
  const order = raw.map((x, i) => ({ i, remainder: x - parts[i] }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  const remaining = Math.abs(minor) - parts.reduce((s, n) => s + n, 0);
  for (let i = 0; i < remaining; i++) parts[order[i].i]++;
  return parts.map((n) => minor < 0 ? -n || 0 : n);
}

function splitEvenly(minor, n) {
  if (!Number.isInteger(n) || n <= 0) throw new Error('n must be a positive integer');
  return allocate(minor, Array.from({ length: n }, () => 1));
}

function format(minor, currency = 'GBP') {
  assertInt(minor);
  const c = CURRENCIES[currency];
  if (!Object.hasOwn(CURRENCIES, currency)) throw new Error(`Unknown currency ${currency}`);
  const neg = minor < 0;
  const major = Math.abs(minor) / 10 ** c.decimals;
  const [int, frac] = major.toFixed(c.decimals).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}${c.symbol}${grouped}${frac ? '.' + frac : ''}`;
}

// rates: { 'GBP->USD': 1.27, ... } meaning 1 GBP = 1.27 USD
function convert(minor, from, to, rates) {
  assertInt(minor);
  if (!Object.hasOwn(CURRENCIES, from) || !Object.hasOwn(CURRENCIES, to)) throw new Error('Unknown currency');
  if (from === to) return minor;
  const direct = rates[`${from}->${to}`];
  const inverse = rates[`${to}->${from}`];
  let rate;
  if (direct != null) rate = direct;
  else if (inverse != null) rate = 1 / inverse;
  else throw new Error(`No rate ${from}->${to}`);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Invalid exchange rate');
  const scale = 10 ** (CURRENCIES[to].decimals - CURRENCIES[from].decimals);
  return roundHalfUp(minor * rate * scale);
}

module.exports = { CURRENCIES, fromMajor, toMajor, add, sub, multiply, percent, allocate, splitEvenly, format, convert, roundHalfUp, assertInt };
