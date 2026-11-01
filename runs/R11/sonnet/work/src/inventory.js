'use strict';

class Inventory {
  constructor() {
    this.items = new Map(); // sku -> { sku, name, price, onHand, reserved }
  }

  addProduct({ sku, name, price, onHand = 0 }) {
    if (!sku) throw new Error('sku required');
    if (this.items.has(sku)) throw new Error(`Duplicate sku ${sku}`);
    if (!Number.isInteger(price) || price < 0) throw new Error('price must be integer pence');
    const item = { sku, name, price, onHand, reserved: 0 };
    this.items.set(sku, item);
    return item;
  }

  get(sku) {
    const it = this.items.get(sku);
    if (!it) throw new Error(`Unknown sku ${sku}`);
    return it;
  }

  available(sku) {
    const it = this.get(sku);
    return it.onHand - it.reserved;
  }

  restock(sku, qty) {
    if (!Number.isInteger(qty) || qty <= 0) throw new Error('qty must be positive integer');
    this.get(sku).onHand += qty;
  }

  reserve(sku, qty) {
    if (!Number.isInteger(qty) || qty <= 0) throw new Error('qty must be positive integer');
    if (this.available(sku) < qty) throw new Error(`Insufficient stock for ${sku}`);
    this.get(sku).reserved += qty;
  }

  release(sku, qty) {
    const it = this.get(sku);
    it.reserved = Math.max(0, it.reserved - qty);
  }

  // Reserved stock leaves the warehouse.
  ship(sku, qty) {
    const it = this.get(sku);
    if (qty > it.reserved) throw new Error(`Cannot ship ${qty} of ${sku}; only ${it.reserved} reserved`);
    it.reserved -= qty;
    it.onHand -= qty;
  }

  lowStock(threshold = 5) {
    return [...this.items.values()].filter((it) => it.onHand - it.reserved <= threshold).map((it) => it.sku);
  }

  valuation() {
    let total = 0;
    for (const it of this.items.values()) total += it.price * it.onHand;
    return total;
  }
}

module.exports = { Inventory };
