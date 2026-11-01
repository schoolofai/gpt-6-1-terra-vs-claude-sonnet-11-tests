'use strict';
// One test per planted bug. B-ids match BUGS key.
const test = require('node:test');
const assert = require('node:assert/strict');
const { req, shop } = require('./helpers');

test('B1 money.allocate parts always sum to the total', () => {
  const m = req('money');
  for (const [amt, r] of [[100, [1, 1, 1]], [1001, [3, 3, 3]], [5, [1, 1, 1, 1, 1, 1]], [999, [2, 1, 1]], [7, [1, 1]]]) {
    const p = m.allocate(amt, r);
    assert.equal(p.reduce((s, x) => s + x, 0), amt, `${amt} ${r}`);
    assert.ok(Math.max(...p) - Math.min(...p.filter((_, i) => r[i] === r[0])) <= 1);
  }
  assert.deepEqual(m.allocate(100, [1, 1, 1]), [34, 33, 33]);
});

test('B2 dates.addBusinessDays skips weekends', () => {
  const d = req('dates');
  assert.equal(d.addBusinessDays('2026-10-23', 1), '2026-10-26'); // Fri +1 -> Mon
  assert.equal(d.addBusinessDays('2026-10-24', 1), '2026-10-26'); // Sat +1 -> Mon
  assert.equal(d.addBusinessDays('2026-10-22', 5), '2026-10-29');
});

test('B3 csv escapes embedded quotes and round-trips', () => {
  const csv = req('csv');
  assert.equal(csv.escapeField('Say "hi", ok'), '"Say ""hi"", ok"');
  assert.equal(csv.escapeField('He said "no"'), '"He said ""no"""');
  const text = csv.toCSV([{ a: 'x "y" z', b: 'line1\nline2' }]);
  assert.deepEqual(csv.parseObjects(text), [{ a: 'x "y" z', b: 'line1\nline2' }]);
});

test('B4 aged debt: exactly 30 days overdue is in 1-30, 60 in 31-60, 90 in 61-90', () => {
  const r = req('reports');
  assert.equal(r.bucketFor(0), 'current');
  assert.equal(r.bucketFor(30), '1-30');
  assert.equal(r.bucketFor(31), '31-60');
  assert.equal(r.bucketFor(60), '31-60');
  assert.equal(r.bucketFor(90), '61-90');
  assert.equal(r.bucketFor(91), '90+');
});

test('B5 coupon valid on its expiry date', () => {
  const { Discounts } = req('discounts');
  const d = new Discounts();
  d.addCoupon({ code: 'oct10', type: 'percent', value: 10, expires: '2026-10-31' });
  assert.equal(d.validate('OCT10', 1000, '2026-10-31').ok, true);
  assert.equal(d.validate('OCT10', 1000, '2026-11-01').ok, false);
});

test('B6 events.once fires only once (firstPaidInvoice keeps the first)', () => {
  const { EventBus } = req('events');
  const bus = new EventBus();
  let n = 0;
  bus.once('x', () => n++);
  bus.emit('x'); bus.emit('x');
  assert.equal(n, 1);
  assert.equal(bus.listenerCount('x'), 0);
  const { L, c } = shop();
  const a = L.sell(c.id, '2026-10-01', [['MUG', 1]]);
  const b = L.sell(c.id, '2026-10-02', [['BOOK', 1]]);
  L.payments.pay(a.invoice.id, a.invoice.total, { date: '2026-10-05' });
  L.payments.pay(b.invoice.id, b.invoice.total, { date: '2026-10-06' });
  assert.equal(L.firstPaidInvoice, a.invoice.id);
});

test('B7 [cross] VAT is charged on the discounted amount', () => {
  const { L, c } = shop();
  L.discounts.addCoupon({ code: 'TEN', type: 'percent', value: 10 });
  const o = L.orders.create(c.id, { date: '2026-10-10', coupon: 'TEN' });
  L.orders.addLine(o.id, 'MUG', 4); // 5000
  const t = L.orders.totals(o.id);
  assert.equal(t.discount, 500);
  assert.equal(t.net, 4500);
  assert.equal(t.tax, 900);
  assert.equal(t.total, 5400);
});

test('B8 [cross] cancelling an order returns stock exactly once', () => {
  const { L, c } = shop();
  const { order } = L.sell(c.id, '2026-10-10', [['TEE', 3]]);
  assert.equal(L.inventory.available('TEE'), 17);
  L.orders.cancel(order.id);
  assert.equal(L.inventory.available('TEE'), 20);
  assert.equal(L.inventory.get('TEE').reserved, 0);
  assert.throws(() => L.inventory.release('TEE', 1));
});

test('B9 [cross] overpayment becomes store credit in pence', () => {
  const { L, c } = shop();
  const { invoice } = L.sell(c.id, '2026-10-10', [['MUG', 1]]); // 1250 + 250 VAT = 1500
  assert.equal(invoice.total, 1500);
  L.payments.pay(invoice.id, 2000, { date: '2026-10-11' });
  assert.equal(L.customers.get(c.id).credit, 500);
  const next = L.sell(c.id, '2026-10-12', [['BOOK', 1]]); // 899 + 180 = 1079
  L.payments.applyCredit(next.invoice.id, { date: '2026-10-12' });
  assert.equal(L.invoices.balance(next.invoice.id), 579);
});

test('B10 [cross] invoice due date uses calendar days from customer terms', () => {
  const { L, c } = shop();
  const { invoice } = L.sell(c.id, '2026-10-01', [['MUG', 1]]);
  assert.equal(invoice.dueDate, '2026-10-31');
  const c2 = L.customers.add({ name: 'B Co', terms: 'net 14' });
  const r = L.sell(c2.id, '2026-12-25', [['MUG', 1]]);
  assert.equal(r.invoice.dueDate, '2027-01-08');
  assert.equal(L.invoices.isOverdue(invoice.id, '2026-10-31'), false);
  assert.equal(L.invoices.isOverdue(invoice.id, '2026-11-01'), true);
});
