'use strict';
// Date helpers working on 'YYYY-MM-DD' strings in UTC.

const DAY_MS = 86400000;

function parse(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error(`Bad date: ${iso}`);
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(0);
  dt.setUTCFullYear(y, m - 1, d);
  dt.setUTCHours(0, 0, 0, 0);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) throw new Error(`Bad date: ${iso}`);
  return dt;
}

function fmt(dt) {
  return dt.toISOString().slice(0, 10);
}

function addDays(iso, n) {
  if (!Number.isInteger(n)) throw new Error('days must be an integer');
  return fmt(new Date(parse(iso).getTime() + n * DAY_MS));
}

function diffDays(a, b) {
  // whole days from a to b (b - a)
  return Math.round((parse(b).getTime() - parse(a).getTime()) / DAY_MS);
}

function isWeekend(iso) {
  const wd = parse(iso).getUTCDay();
  return wd === 0 || wd === 6;
}

function addBusinessDays(iso, n) {
  parse(iso);
  if (!Number.isInteger(n)) throw new Error('business days must be an integer');
  let cur = iso;
  let left = Math.abs(n);
  const step = Math.sign(n);
  while (left > 0) {
    cur = addDays(cur, step);
    if (!isWeekend(cur)) left--;
  }
  return cur;
}

function startOfMonth(iso) {
  parse(iso);
  return iso.slice(0, 8) + '01';
}

function endOfMonth(iso) {
  const dt = parse(iso);
  dt.setUTCMonth(dt.getUTCMonth() + 1, 0);
  return fmt(dt);
}

function monthKey(iso) {
  parse(iso);
  return iso.slice(0, 7);
}

function compare(a, b) {
  parse(a);
  parse(b);
  return a < b ? -1 : a > b ? 1 : 0;
}

function isBetween(iso, from, to) {
  return compare(iso, from) >= 0 && compare(iso, to) <= 0;
}

function today() {
  return fmt(new Date());
}

module.exports = { parse, fmt, addDays, diffDays, isWeekend, addBusinessDays, startOfMonth, endOfMonth, monthKey, compare, isBetween, today };
