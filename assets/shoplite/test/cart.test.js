import test from 'node:test'; import assert from 'node:assert';
import { Cart } from '../src/cart.js'; import { total } from '../src/checkout.js';
test('subtotal adds items', () => { const c = new Cart(); c.add({id:1,price:10},2); assert.equal(c.subtotal(), 20); });
test('free shipping over 50', () => { const c = new Cart(); c.add({id:1,price:60},1); assert.equal(total(c), 60); });
