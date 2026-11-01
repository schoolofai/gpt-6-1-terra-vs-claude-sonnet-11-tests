'use strict';
const dates = require('./dates');

// Recurring billing plans: a customer is sold the same lines every period.
// interval: 'weekly' | 'monthly' | 'yearly'. Monthly plans that start on the 29th-31st
// bill on the last day of shorter months.
class Recurring {
  constructor({ ledger }) {
    this.ledger = ledger;
    this.plans = new Map();
    this.seq = 0;
  }

  create({ customerId, lines, interval = 'monthly', start, endAfter = null }) {
    if (!['weekly', 'monthly', 'yearly'].includes(interval)) throw new Error(`Bad interval ${interval}`);
    dates.parse(start);
    const id = `S${++this.seq}`;
    const plan = { id, customerId, lines, interval, start, anchorDay: Number(start.slice(8, 10)), next: start, count: 0, endAfter, active: true, invoices: [] };
    this.plans.set(id, plan);
    return plan;
  }

  static advance(plan, from) {
    if (plan.interval === 'weekly') return dates.addDays(from, 7);
    const [y, m] = from.split('-').map(Number);
    let ny = y, nm = m;
    if (plan.interval === 'monthly') { nm = m + 1; if (nm > 12) { nm = 1; ny++; } } else ny = y + 1;
    const first = `${ny}-${String(nm).padStart(2, '0')}-01`;
    const last = Number(dates.endOfMonth(first).slice(8, 10));
    const day = Math.min(plan.anchorDay, last);
    return `${ny}-${String(nm).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Bill every plan that is due on or before `onDate`. Returns the invoices raised.
  run(onDate) {
    const raised = [];
    for (const plan of this.plans.values()) {
      while (plan.active && dates.compare(plan.next, onDate) <= 0) {
        const { invoice } = this.ledger.sell(plan.customerId, plan.next, plan.lines);
        plan.invoices.push(invoice.id);
        raised.push(invoice);
        plan.count++;
        if (plan.endAfter && plan.count >= plan.endAfter) plan.active = false;
        plan.next = Recurring.advance(plan, plan.next);
      }
    }
    return raised;
  }

  pause(id) { this.get(id).active = false; }

  resume(id, fromDate) {
    const p = this.get(id);
    p.active = true;
    if (fromDate && dates.compare(fromDate, p.next) > 0) p.next = fromDate;
  }

  get(id) {
    const p = this.plans.get(id);
    if (!p) throw new Error(`No plan ${id}`);
    return p;
  }
}

module.exports = { Recurring };
