// ShopLite cart + checkout
function checkQty(qty) {
  if (!Number.isInteger(qty) || qty < 1) throw new RangeError('qty must be a positive integer');
}
export class Cart {
  constructor() { this.items = []; this.discountCode = null; }
  add(product, qty = 1) {
    checkQty(qty);
    const existing = this.items.find(i => i.product.id === product.id);
    if (existing) existing.qty += qty;
    else this.items.push({ product, qty });
  }
  setQty(productId, qty) {
    if (qty === 0) { this.items = this.items.filter(i => i.product.id !== productId); return; }
    checkQty(qty);
    const item = this.items.find(i => i.product.id === productId);
    if (item) item.qty = qty;
  }
  applyDiscount(code) { this.discountCode = code; }
  subtotal() {
    const pence = this.items.reduce((s, i) => s + Math.round(i.product.price * 100) * i.qty, 0);
    return pence / 100;
  }
}
