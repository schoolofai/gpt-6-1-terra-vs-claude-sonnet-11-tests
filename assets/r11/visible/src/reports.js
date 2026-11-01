'use strict';
const dates = require('./dates');

const BUCKETS = ['current', '1-30', '31-60', '61-90', '90+'];

function bucketFor(daysOverdue) {
  if (daysOverdue <= 0) return 'current';
  if (daysOverdue < 30) return '1-30';
  if (daysOverdue < 60) return '31-60';
  if (daysOverdue < 90) return '61-90';
  return '90+';
}

// Aged debt: outstanding balance of open invoices grouped by days overdue.
function agedDebt(invoices, onDate) {
  const out = Object.fromEntries(BUCKETS.map((b) => [b, 0]));
  const byCustomer = {};
  for (const inv of invoices) {
    if (inv.status !== 'open') continue;
    const bal = inv.total - inv.paid;
    if (bal <= 0) continue;
    const b = bucketFor(dates.diffDays(inv.dueDate, onDate));
    out[b] += bal;
    byCustomer[inv.customerId] = byCustomer[inv.customerId] || Object.fromEntries(BUCKETS.map((k) => [k, 0]));
    byCustomer[inv.customerId][b] += bal;
  }
  return { totals: out, byCustomer };
}

// Revenue (net of discount, excluding tax) per month from non-void invoices.
function revenueByMonth(invoices, { from, to } = {}) {
  const res = {};
  for (const inv of invoices) {
    if (inv.status === 'void') continue;
    if (from && dates.compare(inv.date, from) < 0) continue;
    if (to && dates.compare(inv.date, to) > 0) continue;
    const k = dates.monthKey(inv.date);
    res[k] = (res[k] || 0) + (inv.subtotal - inv.discount);
  }
  return Object.fromEntries(Object.entries(res).sort(([a], [b]) => (a < b ? -1 : 1)));
}

function topCustomers(invoices, n = 5) {
  const sums = {};
  for (const inv of invoices) {
    if (inv.status === 'void') continue;
    sums[inv.customerId] = (sums[inv.customerId] || 0) + inv.total;
  }
  return Object.entries(sums)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, n)
    .map(([customerId, total]) => ({ customerId, total }));
}

function daysSalesOutstanding(invoices, periodStart, periodEnd) {
  const inPeriod = invoices.filter((i) => i.status !== 'void' && dates.isBetween(i.date, periodStart, periodEnd));
  const sales = inPeriod.reduce((s, i) => s + i.total, 0);
  if (!sales) return 0;
  const receivable = invoices.filter((i) => i.status === 'open').reduce((s, i) => s + (i.total - i.paid), 0);
  const days = dates.diffDays(periodStart, periodEnd) + 1;
  return Math.round((receivable / sales) * days);
}

module.exports = { BUCKETS, bucketFor, agedDebt, revenueByMonth, topCustomers, daysSalesOutstanding };
