'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const money = require('../src/money');
const dates = require('../src/dates');
const { Ledger } = require('../src/index');

function shop() {
  const L = new Ledger();
  L.inventory.addProduct({ sku: 'MUG', name: 'Mug', price: 1250, onHand: 50 });
  L.inventory.addProduct({ sku: 'TEE', name: 'T-shirt', price: 1999, onHand: 20 });
  const c = L.customers.add({ name: 'Acme Ltd', email: 'ap@acme.test', region: 'UK' });
  return { L, c };
}

test('money: parse and format', () => {
  assert.equal(money.fromMajor('12.50'), 1250);
  assert.equal(money.format(1250), '£12.50');
  assert.equal(money.format(100000, 'USD'), '$1,000.00');
});

test('money: splitEvenly on an even amount', () => {
  assert.deepEqual(money.splitEvenly(900, 3), [300, 300, 300]);
});

test('dates: addDays across month end', () => {
  assert.equal(dates.addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(dates.isWeekend('2026-10-24'), true);
});

test('orders: totals without discount', () => {
  const { L, c } = shop();
  const o = L.orders.create(c.id, { date: '2026-10-10' });
  L.orders.addLine(o.id, 'MUG', 2);
  const t = L.orders.totals(o.id);
  assert.equal(t.subtotal, 2500);
  assert.equal(t.tax, 500);
  assert.equal(t.total, 3000);
});

test('placing an order reserves stock and raises an invoice', () => {
  const { L, c } = shop();
  const { invoice } = L.sell(c.id, '2026-10-10', [['TEE', 2]]);
  assert.equal(L.inventory.available('TEE'), 18);
  assert.equal(invoice.total, 4798);
  assert.equal(invoice.status, 'open');
});

test('paying an invoice in full marks it paid', () => {
  const { L, c } = shop();
  const { invoice } = L.sell(c.id, '2026-10-10', [['MUG', 1]]);
  L.payments.pay(invoice.id, invoice.total, { date: '2026-10-12' });
  assert.equal(invoice.status, 'paid');
  assert.equal(L.firstPaidInvoice, invoice.id);
});

test('csv export has a header row', () => {
  const { L, c } = shop();
  L.sell(c.id, '2026-10-10', [['MUG', 1]]);
  assert.match(L.exportInvoices(), /^id,customer,date,due,total,status/);
});
