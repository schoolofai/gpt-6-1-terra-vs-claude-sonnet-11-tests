'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const money = require('../src/money');
const dates = require('../src/dates');
const csv = require('../src/csv');
const reports = require('../src/reports');
const tax = require('../src/tax');
const shipping = require('../src/shipping');
const { EventBus } = require('../src/events');
const { Ledger } = require('../src');
const { Recurring } = require('../src/recurring');

function shop() {
  const l = new Ledger();
  const c = l.customers.add({ name: 'Test', terms: 'NET30' });
  l.inventory.addProduct({ sku: 'A', name: 'Item', price: 1001, onHand: 100 });
  return { l, c };
}

test('allocation preserves every penny, including negative and small amounts', () => {
  assert.deepEqual(money.allocate(2, [1, 1, 1]), [1, 1, 0]);
  assert.deepEqual(money.allocate(-2, [1, 1, 1]), [-1, -1, 0]);
  assert.deepEqual(money.splitEvenly(10, 3), [4, 3, 3]);
  assert.throws(() => money.allocate(10, [-1, 2]));
  assert.throws(() => money.splitEvenly(1, 0));
  assert.equal(money.fromMajor('-1.005'), -101);
  assert.equal(money.fromMajor('1.005'), 101);
  assert.equal(money.percent(100, 28.5), 29);
  assert.throws(() => money.fromMajor('garbage'));
});

test('dates and calendar invoice terms, business days skip weekends', () => {
  const { l, c } = shop();
  const { invoice } = l.sell(c.id, '2026-10-10', [['A', 1]]);
  assert.equal(invoice.dueDate, '2026-11-09');
  assert.equal(dates.addBusinessDays('2026-10-09', 1), '2026-10-12');
  assert.equal(dates.addBusinessDays('2026-10-10', 1), '2026-10-12');
  assert.equal(dates.addBusinessDays('2026-10-12', -1), '2026-10-09');
  assert.equal(dates.endOfMonth('0004-02-01'), '0004-02-29');
  assert.throws(() => dates.parse('2026-02-29'));
});

test('once listeners unsubscribe, even with reentrant emission', () => {
  const b = new EventBus();
  let calls = 0, nested = false;
  b.on('x', () => { if (!nested) { nested = true; b.emit('x'); } });
  b.once('x', () => calls++);
  b.emit('x'); b.emit('x');
  assert.equal(calls, 1);
  assert.equal(b.listenerCount('x'), 1);
  const fn = () => calls++;
  b.once('x', fn); b.off('x', fn); b.emit('x');
  assert.equal(calls, 1);
});

test('firstPaidInvoice stays the first one', () => {
  const { l, c } = shop();
  const a = l.sell(c.id, '2026-01-01', [['A', 1]]).invoice;
  const b = l.sell(c.id, '2026-01-02', [['A', 1]]).invoice;
  l.payments.pay(a.id, a.total, { date: '2026-01-03' });
  l.payments.pay(b.id, b.total, { date: '2026-01-04' });
  assert.equal(l.firstPaidInvoice, a.id);
});

test('discount expires inclusively and reduces tax, including mixed rates', () => {
  const { l, c } = shop();
  l.discounts.addCoupon({ code: 'HALF', type: 'percent', value: 50, expires: '2026-01-31' });
  const o = l.orders.create(c.id, { date: '2026-01-31', coupon: 'half' });
  l.orders.addLine(o.id, 'A', 1, { unitPrice: 1000 });
  l.orders.addLine(o.id, 'A', 1, { unitPrice: 1000, taxCategory: 'zero' });
  const totals = l.orders.totals(o.id);
  assert.deepEqual([totals.subtotal, totals.discount, totals.tax, totals.total], [2000, 1000, 100, 1100]);
  assert.equal(l.discounts.validate('HALF', 1000, '2026-02-01').reason, 'expired');
  assert.equal(tax.taxForLines([{ net: 1 }, { net: 1 }, { net: 1 }], 'UK', 2), 0);
});

test('line prices remain distinct; cancellation releases only its own stock', () => {
  const { l, c } = shop();
  const a = l.orders.create(c.id, { date: '2026-01-01' });
  l.orders.addLine(a.id, 'A', 1, { unitPrice: 100 });
  l.orders.addLine(a.id, 'A', 1, { unitPrice: 200 });
  assert.equal(l.orders.totals(a.id).subtotal, 300);
  l.orders.place(a.id);
  const b = l.sell(c.id, '2026-01-01', [['A', 5]]).order;
  l.orders.cancel(a.id);
  assert.equal(l.inventory.get('A').reserved, 5);
  assert.equal(l.invoices.forOrder(a.id).status, 'void');
  l.orders.fulfil(b.id);
  assert.equal(l.inventory.get('A').onHand, 95);
});

test('payments preserve pence and refunds reverse credit and paid status', () => {
  const { l, c } = shop();
  const a = l.sell(c.id, '2026-01-01', [['A', 1]]).invoice;
  const p = l.payments.pay(a.id, a.total + 251, { date: '2026-01-02' });
  assert.equal(c.credit, 251);
  l.payments.refund(p.id, { date: '2026-01-03' });
  assert.equal(c.credit, 0);
  assert.equal(a.status, 'open');
  assert.equal(a.paid, 0);
  assert.equal(a.paidDate, undefined);
  assert.throws(() => l.payments.refund(p.id, { date: '2026-01-04' }));
  l.customers.addCredit(c.id, 500);
  assert.throws(() => l.payments.applyCredit(a.id));
  assert.equal(c.credit, 500);
  const creditPayment = l.payments.applyCredit(a.id, { date: '2026-01-05' });
  assert.equal(c.credit, 0);
  l.payments.refund(creditPayment.id, { date: '2026-01-06' });
  assert.equal(c.credit, 500);
});

test('refund cannot reverse already spent overpayment credit', () => {
  const { l, c } = shop();
  const a = l.sell(c.id, '2026-01-01', [['A', 1]]).invoice;
  const b = l.sell(c.id, '2026-01-01', [['A', 1]]).invoice;
  const p = l.payments.pay(a.id, a.total + 500, { date: '2026-01-02' });
  l.payments.applyCredit(b.id, { date: '2026-01-02' });
  assert.throws(() => l.payments.refund(p.id, { date: '2026-01-03' }));
  assert.equal(a.status, 'paid');
  assert.equal(a.paid, a.total);
});

test('aged debt boundary days are inclusive', () => {
  for (const [day, bucket] of [[0, 'current'], [1, '1-30'], [30, '1-30'], [31, '31-60'], [60, '31-60'], [61, '61-90'], [90, '61-90'], [91, '90+']]) {
    assert.equal(reports.bucketFor(day), bucket);
  }
});

test('CSV quoted fields round-trip', () => {
  const rows = [{ name: 'A "quoted", name\r\nnext', empty: '', count: '3' }];
  assert.deepEqual(csv.parseObjects(csv.toCSV(rows)), rows);
});

test('shipping preserves weight and respects limits', () => {
  assert.deepEqual(shipping.splitParcels(30001), [15001, 15000]);
  assert.equal(shipping.quote({ region: 'US', lines: [{ sku: 'A', qty: 1 }], weights: { A: 30001 }, net: 0 }).parcels.reduce((a, b) => a + b), 30001);
  assert.throws(() => shipping.splitParcels(1, 0));
  assert.equal(shipping.estimatedDelivery('UK', '2026-10-09'), '2026-10-12');
});

test('recurring monthly anchor returns after February and completed plan cannot resume', () => {
  const { l, c } = shop();
  const r = new Recurring({ ledger: l });
  const p = r.create({ customerId: c.id, lines: [['A', 1]], start: '2024-01-31', endAfter: 3 });
  assert.deepEqual(r.run('2024-03-31').map((i) => i.date), ['2024-01-31', '2024-02-29', '2024-03-31']);
  assert.throws(() => r.resume(p.id));
});

test('placed order totals remain the invoiced snapshot after coupon redemption', () => {
  const { l, c } = shop();
  l.discounts.addCoupon({ code: 'ONE', type: 'fixed', value: 100, maxUses: 1 });
  const { order, invoice } = l.sell(c.id, '2026-01-01', [['A', 1]], { coupon: 'ONE' });
  assert.equal(l.orders.totals(order.id).total, invoice.total);
  l.discounts.setTiers([{ minQty: 1, pct: 90 }]);
  assert.equal(l.orders.totals(order.id).total, invoice.total);
});
