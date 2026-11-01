import test from 'node:test'; import assert from 'node:assert';
import { Cart } from '../src/cart.js'; import { total } from '../src/checkout.js';
test('subtotal adds items', () => { const c = new Cart(); c.add({id:1,price:10},2); assert.equal(c.subtotal(), 20); });
test('free shipping over 50', () => { const c = new Cart(); c.add({id:1,price:60},1); assert.equal(total(c), 60); });
import { formatTotal } from '../src/checkout.js';
test('rejects negative/zero/fractional qty on add', () => {
  const c = new Cart();
  for (const q of [-2, 0, 1.5, NaN]) assert.throws(() => c.add({id:1,price:5}, q));
});
test('setQty rejects negative; 0 removes', () => {
  const c = new Cart(); c.add({id:1,price:5});
  assert.throws(() => c.setQty(1, -2));
  c.setQty(1, 0); assert.equal(c.items.length, 0);
});
test('discount applied once', () => {
  const c = new Cart(); c.add({id:1,price:100}); c.applyDiscount('SAVE10');
  assert.equal(total(c), 90);
});
test('unknown/prototype discount codes ignored', () => {
  const c = new Cart(); c.add({id:1,price:100}); c.applyDiscount('constructor');
  assert.equal(total(c), 100);
});
test('no float error in subtotal', () => {
  const c = new Cart(); c.add({id:1,price:0.1},3); assert.equal(c.subtotal(), 0.3);
});
test('formatTotal shows 2 decimals', () => {
  const c = new Cart(); c.add({id:1,price:10}); assert.equal(formatTotal(c), '£14.99');
});
