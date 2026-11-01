import test from 'node:test';
import assert from 'node:assert/strict';
import { Cart } from '../src/cart.js';
import { applyDiscount, formatTotal, total } from '../src/checkout.js';

const product = (id, price) => ({ id, price });

test('subtotal adds items', () => {
  const cart = new Cart();
  cart.add(product(1, 10), 2);
  assert.equal(cart.subtotal(), 20);
});

test('free shipping applies at £50 after discount', () => {
  const cart = new Cart();
  cart.add(product(1, 60));
  assert.equal(total(cart), 60);
  cart.applyDiscount('WELCOME20');
  assert.equal(total(cart), 52.99);
});

test('the discount is applied only once', () => {
  const cart = new Cart();
  cart.add(product(1, 100));
  cart.applyDiscount('SAVE10');
  assert.equal(total(cart), 90);
});

test('add rejects invalid quantities without changing the cart', () => {
  const cart = new Cart();
  for (const qty of [-2, 0, 1.5, NaN, Infinity, '2', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => cart.add(product(1, 10), qty), RangeError);
  }
  assert.equal(cart.items.length, 0);
  cart.add(product(1, 10), Number.MAX_SAFE_INTEGER);
  assert.throws(() => cart.add(product(1, 10)), RangeError);
  assert.equal(cart.items[0].qty, Number.MAX_SAFE_INTEGER);
});

test('setQty rejects invalid quantities and zero removes the item', () => {
  const cart = new Cart();
  cart.add(product(1, 10), 2);
  for (const qty of [-2, 1.5, NaN, Infinity, '2', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => cart.setQty(1, qty), RangeError);
    assert.equal(cart.items[0].qty, 2);
  }
  cart.setQty(1, 3);
  assert.equal(cart.subtotal(), 30);
  cart.setQty(1, 0);
  assert.equal(cart.items.length, 0);
  assert.equal(total(cart), 0);
});

test('prices must be valid non-negative amounts in whole pence', () => {
  const cart = new Cart();
  for (const price of [-1, NaN, Infinity, '10', 1.001]) {
    assert.throws(() => cart.add(product(1, price)), RangeError);
  }
  assert.throws(() => cart.add({ price: 10 }), TypeError);
  assert.equal(cart.items.length, 0);
  const item = product(1, 0.29);
  cart.add(item);
  item.price = -10;
  assert.throws(() => cart.subtotal(), RangeError);
});

test('subtotal and discounts round correctly to pence', () => {
  const cart = new Cart();
  cart.add(product(1, 0.1), 3);
  assert.equal(cart.subtotal(), 0.3);
  assert.equal(applyDiscount(19.99, 'SAVE10'), 17.99);
  assert.equal(applyDiscount(0.05, 'SAVE10'), 0.05);
  cart.applyDiscount('SAVE10');
  assert.equal(total(cart), 5.26);
});

test('shipping threshold uses the rounded discounted amount', () => {
  const cart = new Cart();
  cart.add(product(1, 55.55));
  cart.applyDiscount('SAVE10');
  assert.equal(total(cart), 50);
});

test('unknown and inherited property names are not discounts', () => {
  for (const code of ['unknown', 'toString', 'constructor', '__proto__', null]) {
    assert.equal(applyDiscount(10, code), 10);
  }
});

test('an empty cart does not incur shipping', () => {
  const cart = new Cart();
  assert.equal(total(cart), 0);
  cart.add(product(1, 0));
  assert.equal(total(cart), 4.99);
});

test('formatted totals always contain two decimal places', () => {
  const cart = new Cart();
  cart.add(product(1, 60));
  assert.equal(formatTotal(cart), '£60.00');
  cart.setQty(1, 0);
  assert.equal(formatTotal(cart), '£0.00');
});

test('monetary arithmetic rejects unsafe totals', () => {
  const cart = new Cart();
  cart.add(product(1, 100), Number.MAX_SAFE_INTEGER);
  assert.throws(() => cart.subtotal(), RangeError);
});

test('large amounts preserve pennies and amounts beyond the monetary limit are rejected', () => {
  const cart = new Cart();
  cart.add(product(1, 10000000.01));
  assert.equal(cart.subtotal(), 10000000.01);
  assert.equal(total(cart), 10000000.01);
  assert.throws(() => cart.add(product(2, 10000000000.01)), RangeError);
  assert.throws(() => applyDiscount(10000000000.01, null), RangeError);
});
