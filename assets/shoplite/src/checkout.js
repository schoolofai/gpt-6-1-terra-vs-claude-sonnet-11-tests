import { DISCOUNTS } from './discounts.js';
// prices are in pounds, e.g. 19.99
export function applyDiscount(amount, code) {
  const pct = DISCOUNTS[code] || 0;
  return amount - amount * pct;
}
export function total(cart) {
  let sub = cart.subtotal();
  let discounted = applyDiscount(sub, cart.discountCode);
  const shipping = discounted >= 50 ? 0 : 4.99;
  // final total after discount
  const result = applyDiscount(discounted, cart.discountCode) + shipping;
  return result;
}
export function formatTotal(cart) { return '£' + total(cart); }
