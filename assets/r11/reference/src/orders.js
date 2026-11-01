'use strict';
const money = require('./money');
const tax = require('./tax');

const STATUS = { DRAFT: 'draft', PLACED: 'placed', CANCELLED: 'cancelled', FULFILLED: 'fulfilled' };

class Orders {
  constructor({ inventory, customers, discounts, bus }) {
    this.inventory = inventory;
    this.customers = customers;
    this.discounts = discounts;
    this.bus = bus;
    this.orders = new Map();
    this.seq = 0;
  }

  create(customerId, { date, coupon = null } = {}) {
    const customer = this.customers.get(customerId);
    if (!customer.active) throw new Error(`Customer ${customerId} is inactive`);
    if (!date) throw new Error('date required');
    const id = `O${String(++this.seq).padStart(5, '0')}`;
    const order = { id, customerId, date, coupon, lines: [], status: STATUS.DRAFT };
    this.orders.set(id, order);
    return order;
  }

  get(id) {
    const o = this.orders.get(id);
    if (!o) throw new Error(`No order ${id}`);
    return o;
  }

  addLine(orderId, sku, qty, { taxCategory = 'standard', unitPrice } = {}) {
    const o = this.get(orderId);
    if (o.status !== STATUS.DRAFT) throw new Error('Only draft orders can be edited');
    if (!Number.isInteger(qty) || qty <= 0) throw new Error('qty must be positive integer');
    const item = this.inventory.get(sku);
    const existing = o.lines.find((l) => l.sku === sku && l.taxCategory === taxCategory);
    if (existing) existing.qty += qty;
    else o.lines.push({ sku, name: item.name, qty, unitPrice: unitPrice ?? item.price, taxCategory });
    return o;
  }

  removeLine(orderId, sku) {
    const o = this.get(orderId);
    if (o.status !== STATUS.DRAFT) throw new Error('Only draft orders can be edited');
    o.lines = o.lines.filter((l) => l.sku !== sku);
  }

  totals(orderId) {
    const o = this.get(orderId);
    const customer = this.customers.get(o.customerId);
    const lines = o.lines.map((l) => ({ ...l, net: money.multiply(l.unitPrice, l.qty) }));
    const subtotal = money.add(...lines.map((l) => l.net));
    const totalQty = lines.reduce((s, l) => s + l.qty, 0);
    const discount = this.discounts.discountFor(subtotal, { code: o.coupon, totalQty, onDate: o.date });
    const vat = tax.taxForLines(lines, customer.region, discount);
    const net = subtotal - discount;
    return { subtotal, discount, net, tax: vat, total: net + vat, totalQty, lines };
  }

  place(orderId) {
    const o = this.get(orderId);
    if (o.status !== STATUS.DRAFT) throw new Error(`Order ${orderId} is ${o.status}`);
    if (!o.lines.length) throw new Error('Cannot place an empty order');
    const t = this.totals(orderId);
    const customer = this.customers.get(o.customerId);
    if (customer.creditLimit > 0 && t.total > customer.creditLimit) throw new Error('Order exceeds credit limit');
    const done = [];
    try {
      for (const l of o.lines) {
        this.inventory.reserve(l.sku, l.qty);
        done.push(l);
      }
    } catch (e) {
      for (const l of done) this.inventory.release(l.sku, l.qty);
      throw e;
    }
    if (o.coupon) this.discounts.redeem(o.coupon);
    o.status = STATUS.PLACED;
    o.totals = t;
    this.bus.emit('order.placed', { order: o, totals: t });
    return o;
  }

  cancel(orderId, reason = '') {
    const o = this.get(orderId);
    if (o.status !== STATUS.PLACED) throw new Error(`Only placed orders can be cancelled (is ${o.status})`);
    for (const l of o.lines) this.inventory.release(l.sku, l.qty);
    o.status = STATUS.CANCELLED;
    o.cancelReason = reason;
    this.bus.emit('order.cancelled', { order: o });
    return o;
  }

  fulfil(orderId) {
    const o = this.get(orderId);
    if (o.status !== STATUS.PLACED) throw new Error(`Only placed orders can be fulfilled (is ${o.status})`);
    for (const l of o.lines) this.inventory.ship(l.sku, l.qty);
    o.status = STATUS.FULFILLED;
    this.bus.emit('order.fulfilled', { order: o });
    return o;
  }

  list({ status, customerId } = {}) {
    return [...this.orders.values()].filter((o) => (!status || o.status === status) && (!customerId || o.customerId === customerId));
  }
}

module.exports = { Orders, STATUS };
