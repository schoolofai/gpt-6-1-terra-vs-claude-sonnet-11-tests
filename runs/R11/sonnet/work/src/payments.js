'use strict';
const money = require('./money');

class Payments {
  constructor({ invoices, customers, bus }) {
    this.invoices = invoices;
    this.customers = customers;
    this.bus = bus;
    this.log = [];
    this.seq = 0;
  }

  // Apply a payment (pence) to an invoice. Any overpayment becomes store credit.
  pay(invoiceId, amount, { date, method = 'card', reference = '' } = {}) {
    money.assertInt(amount);
    if (amount <= 0) throw new Error('amount must be positive');
    if (!date) throw new Error('date required');
    const inv = this.invoices.get(invoiceId);
    if (inv.status === 'void') throw new Error('Invoice is void');
    if (inv.status === 'paid') throw new Error('Invoice already paid');
    const due = inv.total - inv.paid;
    const applied = Math.min(amount, due);
    const over = amount - applied;
    inv.paid += applied;
    const p = { id: `P${++this.seq}`, invoiceId, amount, applied, date, method, reference };
    inv.payments.push(p.id);
    this.log.push(p);
    if (over > 0) this.customers.addCredit(inv.customerId, over);
    if (inv.paid >= inv.total) {
      inv.status = 'paid';
      inv.paidDate = date;
      this.bus.emit('invoice.paid', { invoiceId: inv.id, date });
    }
    return p;
  }

  // Use the customer's store credit against an invoice.
  applyCredit(invoiceId, { date } = {}) {
    const inv = this.invoices.get(invoiceId);
    const used = this.customers.useCredit(inv.customerId, inv.total - inv.paid);
    if (used > 0) return this.pay(invoiceId, used, { date, method: 'credit' });
    return null;
  }

  refund(paymentId, { date } = {}) {
    const p = this.log.find((x) => x.id === paymentId);
    if (!p) throw new Error(`No payment ${paymentId}`);
    if (p.refunded) throw new Error('Already refunded');
    const inv = this.invoices.get(p.invoiceId);
    inv.paid -= p.applied;
    if (inv.status === 'paid') inv.status = 'open';
    p.refunded = date;
    this.bus.emit('payment.refunded', { payment: p });
    return p;
  }

  forInvoice(invoiceId) {
    return this.log.filter((p) => p.invoiceId === invoiceId);
  }
}

module.exports = { Payments };
