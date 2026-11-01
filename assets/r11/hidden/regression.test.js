'use strict';
// Behaviour that must keep working. Should pass on both the buggy and fixed versions.
const test = require('node:test');
const assert = require('node:assert/strict');
const { req, shop } = require('./helpers');

test('R1 money basics', () => {
  const m = req('money');
  assert.equal(m.fromMajor('£12.34'), 1234);
  assert.equal(m.format(123456789), '£1,234,567.89');
  assert.equal(m.format(-5), '-£0.05');
  assert.equal(m.format(1500, 'JPY'), '¥1,500');
  assert.equal(m.percent(1250, 20), 250);
  assert.equal(m.convert(10000, 'GBP', 'USD', { 'GBP->USD': 1.25 }), 12500);
  assert.equal(m.convert(12500, 'USD', 'GBP', { 'GBP->USD': 1.25 }), 10000);
  assert.throws(() => m.add(1, 1.5));
});

test('R2 dates basics', () => {
  const d = req('dates');
  assert.equal(d.addDays('2026-02-27', 2), '2026-03-01');
  assert.equal(d.diffDays('2026-10-01', '2026-10-31'), 30);
  assert.equal(d.endOfMonth('2024-02-10'), '2024-02-29');
  assert.equal(d.endOfMonth('2026-12-05'), '2026-12-31');
  assert.throws(() => d.parse('2026-02-30'));
});

test('R3 order flow totals, credit limit and stock', () => {
  const { L, c } = shop();
  const o = L.orders.create(c.id, { date: '2026-10-10' });
  L.orders.addLine(o.id, 'MUG', 2);
  L.orders.addLine(o.id, 'BOOK', 1, { taxCategory: 'zero' });
  const t = L.orders.totals(o.id);
  assert.equal(t.subtotal, 3399);
  assert.equal(t.tax, 500);
  L.orders.place(o.id);
  assert.equal(L.inventory.available('MUG'), 48);
  const inv = L.invoices.forOrder(o.id);
  assert.equal(inv.id, 'INV-2026-0001');
  assert.equal(inv.total, 3899);
  const lim = L.customers.add({ name: 'Tight', creditLimit: 1000 });
  const o2 = L.orders.create(lim.id, { date: '2026-10-10' });
  L.orders.addLine(o2.id, 'TEE', 1);
  assert.throws(() => L.orders.place(o2.id), /credit limit/);
  assert.equal(L.inventory.available('TEE'), 20);
});

test('R4 failed reservation rolls back', () => {
  const { L, c } = shop();
  const o = L.orders.create(c.id, { date: '2026-10-10' });
  L.orders.addLine(o.id, 'MUG', 5);
  L.orders.addLine(o.id, 'TEE', 99);
  assert.throws(() => L.orders.place(o.id), /Insufficient/);
  assert.equal(L.inventory.available('MUG'), 50);
});

test('R5 payments partial, refund, void rules', () => {
  const { L, c } = shop();
  const { invoice, order } = L.sell(c.id, '2026-10-10', [['TEE', 1]]);
  const p = L.payments.pay(invoice.id, 1000, { date: '2026-10-11' });
  assert.equal(L.invoices.balance(invoice.id), invoice.total - 1000);
  assert.throws(() => L.invoices.void(invoice.id));
  L.payments.refund(p.id, { date: '2026-10-12' });
  assert.equal(L.invoices.balance(invoice.id), invoice.total);
  L.orders.cancel(order.id);
  assert.equal(invoice.status, 'void');
});

test('R6 tiers + fixed coupon, no coupon reuse past maxUses', () => {
  const { L, c } = shop();
  L.discounts.setTiers([{ minQty: 10, pct: 5 }, { minQty: 20, pct: 10 }]);
  L.discounts.addCoupon({ code: 'FIVER', type: 'fixed', value: 500, maxUses: 1 });
  const o = L.orders.create(c.id, { date: '2026-10-10', coupon: 'fiver' });
  L.orders.addLine(o.id, 'BOOK', 10); // 8990
  const t = L.orders.totals(o.id);
  assert.equal(t.discount, 450 + 500);
  L.orders.place(o.id);
  const o2 = L.orders.create(c.id, { date: '2026-10-11', coupon: 'FIVER' });
  L.orders.addLine(o2.id, 'BOOK', 1);
  assert.throws(() => L.orders.totals(o2.id), /used-up/);
});

test('R7 reports and export', () => {
  const { L, c } = shop();
  const a = L.sell(c.id, '2026-09-01', [['MUG', 1]]);
  L.sell(c.id, '2026-10-05', [['BOOK', 2]]);
  const rev = req('reports').revenueByMonth(L.invoices.list());
  assert.deepEqual(rev, { '2026-09': 1250, '2026-10': 1798 });
  const aged = L.agedDebt('2027-06-01');
  assert.equal(aged.totals['90+'], a.invoice.total + 1798 + 360);
  assert.equal(L.agedDebt('2026-08-01').totals.current, a.invoice.total + 2158);
  const out = L.exportInvoices();
  assert.match(out, /^id,customer,date,due,total,status\r\n/);
  assert.match(out, /INV-2026-0001,Acme Ltd,2026-09-01,[0-9-]+,£15\.00,open/);
});

test('R8 terms parsing and csv parse', () => {
  const { normalizeTerms } = req('customers');
  assert.equal(normalizeTerms('NET45'), 45);
  assert.equal(normalizeTerms(undefined), 30);
  assert.throws(() => normalizeTerms('COD'));
  const csv = req('csv');
  assert.deepEqual(csv.parseCSV('a,b\r\n1,"2,3"\r\n'), [['a', 'b'], ['1', '2,3']]);
});

test('R9 shipping quotes and recurring billing', () => {
  const s = req('shipping');
  assert.equal(s.quote({ region: 'UK', lines: [{ sku: 'M', qty: 1 }], weights: { M: 300 }, net: 6000 }).cost, 0);
  assert.equal(s.quote({ region: 'UK', lines: [{ sku: 'M', qty: 2 }], weights: { M: 300 }, net: 1000 }).cost, 495);
  assert.equal(s.quote({ region: 'DE', lines: [{ sku: 'M', qty: 3 }], weights: { M: 12000 }, net: 100 }).cost, 9990);
  const { Recurring } = req('recurring');
  const { L, c } = shop();
  const R = new Recurring({ ledger: L });
  R.create({ customerId: c.id, lines: [['MUG', 1]], start: '2026-01-31', endAfter: 3 });
  assert.deepEqual(R.run('2026-06-30').map((i) => i.date), ['2026-01-31', '2026-02-28', '2026-03-31']);
});
