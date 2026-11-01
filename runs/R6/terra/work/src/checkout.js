import { DISCOUNTS } from './discounts.js';
import { checkedPence, toPence } from './money.js';

// Prices and public return values are in pounds; calculations use whole pence.
export function applyDiscount(amount, code) {
  const pence = toPence(amount);
  const pct = Object.hasOwn(DISCOUNTS, code) ? DISCOUNTS[code] : 0;
  return checkedPence(Math.round(pence * (1 - pct))) / 100;
}
export function total(cart) {
  if (cart.items.length === 0) return 0;
  const discounted = toPence(applyDiscount(cart.subtotal(), cart.discountCode));
  const shipping = discounted >= 5000 ? 0 : 499;
  return checkedPence(discounted + shipping) / 100;
}
export function formatTotal(cart) { return '£' + total(cart).toFixed(2); }
