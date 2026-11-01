// ShopLite cart + checkout
export class Cart {
  constructor() { this.items = []; this.discountCode = null; }
  add(product, qty = 1) {
    const existing = this.items.find(i => i.product.id === product.id);
    if (existing) existing.qty += qty;
    else this.items.push({ product, qty });
  }
  setQty(productId, qty) {
    const item = this.items.find(i => i.product.id === productId);
    if (item) item.qty = qty;
  }
  applyDiscount(code) { this.discountCode = code; }
  subtotal() {
    return this.items.reduce((s, i) => s + i.product.price * i.qty, 0);
  }
}
