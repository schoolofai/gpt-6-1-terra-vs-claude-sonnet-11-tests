import { checkedPence, toPence } from './money.js';

function validateQty(qty, allowZero = false) {
  if (!Number.isSafeInteger(qty) || qty < (allowZero ? 0 : 1)) {
    throw new RangeError(`Quantity must be a ${allowZero ? 'non-negative' : 'positive'} safe integer`);
  }
}

export class Cart {
  constructor() { this.items = []; this.discountCode = null; }
  add(product, qty = 1) {
    validateQty(qty);
    if (!product || product.id == null) throw new TypeError('Product must have an id');
    toPence(product.price);
    const existing = this.items.find(i => i.product.id === product.id);
    if (existing) {
      const combined = existing.qty + qty;
      validateQty(combined);
      existing.qty = combined;
    } else this.items.push({ product, qty });
  }
  setQty(productId, qty) {
    validateQty(qty, true);
    const index = this.items.findIndex(i => i.product.id === productId);
    if (index !== -1) {
      if (qty === 0) this.items.splice(index, 1);
      else this.items[index].qty = qty;
    }
  }
  applyDiscount(code) { this.discountCode = code; }
  subtotal() {
    const pence = this.items.reduce((sum, item) => {
      validateQty(item.qty);
      return checkedPence(sum + checkedPence(toPence(item.product.price) * item.qty));
    }, 0);
    return pence / 100;
  }
}
