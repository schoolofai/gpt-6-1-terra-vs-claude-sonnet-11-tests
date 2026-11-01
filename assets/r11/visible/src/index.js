'use strict';
const { EventBus } = require('./events');
const { CustomerRegistry } = require('./customers');
const { Inventory } = require('./inventory');
const { Discounts } = require('./discounts');
const { Orders } = require('./orders');
const { Invoices } = require('./invoices');
const { Payments } = require('./payments');
const reports = require('./reports');
const csv = require('./csv');

class Ledger {
  constructor() {
    this.bus = new EventBus();
    this.customers = new CustomerRegistry();
    this.inventory = new Inventory();
    this.discounts = new Discounts();
    this.orders = new Orders({ inventory: this.inventory, customers: this.customers, discounts: this.discounts, bus: this.bus });
    this.invoices = new Invoices({ customers: this.customers, bus: this.bus });
    this.payments = new Payments({ invoices: this.invoices, customers: this.customers, bus: this.bus });
    this.firstPaidInvoice = null;
    this.audit = [];

    // Every placed order gets an invoice.
    this.bus.on('order.placed', ({ order, totals }) => this.invoices.raise(order, totals));
    // Cancelling an order puts its stock back and voids its unpaid invoice.
    this.bus.on('order.cancelled', ({ order }) => {
      for (const l of order.lines) this.inventory.release(l.sku, l.qty);
      const inv = this.invoices.forOrder(order.id);
      if (inv && inv.status === 'open' && inv.paid === 0) this.invoices.void(inv.id, 'order cancelled');
    });
    // Remember the very first invoice that got paid (used for the onboarding email).
    this.bus.once('invoice.paid', ({ invoiceId }) => { this.firstPaidInvoice = invoiceId; });
    for (const ev of ['order.placed', 'order.cancelled', 'order.fulfilled', 'invoice.raised', 'invoice.paid', 'invoice.voided', 'payment.refunded']) {
      this.bus.on(ev, () => this.audit.push(ev));
    }
  }

  // Convenience: create, fill and place an order in one go. Returns { order, invoice }.
  sell(customerId, date, lines, { coupon } = {}) {
    const o = this.orders.create(customerId, { date, coupon });
    for (const [sku, qty, opts] of lines) this.orders.addLine(o.id, sku, qty, opts);
    this.orders.place(o.id);
    return { order: o, invoice: this.invoices.forOrder(o.id) };
  }

  agedDebt(onDate) {
    return reports.agedDebt(this.invoices.list(), onDate);
  }

  exportInvoices() {
    const list = this.invoices.list().map((i) => ({ ...i, customerName: this.customers.get(i.customerId).name }));
    return csv.invoicesToCSV(list);
  }
}

module.exports = { Ledger };
