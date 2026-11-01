import { DISCOUNTS } from './discounts.js';
// prices are in pounds, e.g. 19.99
export function applyDiscount(amount, code) {
  const pct = Object.hasOwn(DISCOUNTS, code) ? DISCOUNTS[code] : 0;
  return Math.round(amount * (1 - pct) * 100) / 100;
}
export function total(cart) {
  const discounted = applyDiscount(cart.subtotal(), cart.discountCode);
  const shipping = discounted >= 50 ? 0 : 4.99;
  return Math.round((discounted + shipping) * 100) / 100;
}
export function formatTotal(cart) { return '£' + total(cart).toFixed(2); }
