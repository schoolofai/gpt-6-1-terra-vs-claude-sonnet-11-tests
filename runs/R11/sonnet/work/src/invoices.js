'use strict';
const dates = require('./dates');

class Invoices {
  constructor({ customers, bus }) {
    this.customers = customers;
    this.bus = bus;
    this.invoices = new Map();
    this.counters = new Map(); // year -> last number
  }

  nextNumber(date) {
    const year = date.slice(0, 4);
    const n = (this.counters.get(year) || 0) + 1;
    this.counters.set(year, n);
    return `INV-${year}-${String(n).padStart(4, '0')}`;
  }

  raise(order, totals) {
    const customer = this.customers.get(order.customerId);
    const id = this.nextNumber(order.date);
    const inv = {
      id,
      orderId: order.id,
      customerId: order.customerId,
      date: order.date,
      dueDate: dates.addDays(order.date, customer.termsDays),
      currency: customer.currency,
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      total: totals.total,
      paid: 0,
      status: 'open',
      payments: [],
    };
    this.invoices.set(id, inv);
    this.bus.emit('invoice.raised', { invoice: inv });
    return inv;
  }

  get(id) {
    const inv = this.invoices.get(id);
    if (!inv) throw new Error(`No invoice ${id}`);
    return inv;
  }

  forOrder(orderId) {
    return [...this.invoices.values()].find((i) => i.orderId === orderId) || null;
  }

  balance(id) {
    const inv = this.get(id);
    return inv.total - inv.paid;
  }

  void(id, reason = '') {
    const inv = this.get(id);
    if (inv.paid > 0) throw new Error('Cannot void an invoice with payments; refund first');
    inv.status = 'void';
    inv.voidReason = reason;
    this.bus.emit('invoice.voided', { invoice: inv });
  }

  isOverdue(id, onDate) {
    const inv = this.get(id);
    return inv.status === 'open' && dates.compare(onDate, inv.dueDate) > 0;
  }

  list({ status, customerId } = {}) {
    return [...this.invoices.values()].filter((i) => (!status || i.status === status) && (!customerId || i.customerId === customerId));
  }
}

module.exports = { Invoices };
