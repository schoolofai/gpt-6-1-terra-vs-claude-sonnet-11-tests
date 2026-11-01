'use strict';
const money = require('./money');

const TERMS = { NET0: 0, NET7: 7, NET14: 14, NET30: 30, NET60: 60 };

function normalizeTerms(terms) {
  if (terms == null) return 30;
  if (typeof terms === 'number') return terms;
  const key = String(terms).toUpperCase().replace(/\s+/g, '');
  if (key in TERMS) return TERMS[key];
  const m = /^NET(\d+)$/.exec(key);
  if (m) return Number(m[1]);
  throw new Error(`Unknown payment terms: ${terms}`);
}

class CustomerRegistry {
  constructor() {
    this.customers = new Map();
    this.seq = 0;
  }

  add({ name, email, region = 'UK', terms = 'NET30', creditLimit = 0, currency = 'GBP' }) {
    if (!name) throw new Error('name required');
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error(`Bad email: ${email}`);
    const id = `C${String(++this.seq).padStart(4, '0')}`;
    const c = { id, name, email: email || null, region, termsDays: normalizeTerms(terms), creditLimit, currency, credit: 0, active: true };
    this.customers.set(id, c);
    return c;
  }

  get(id) {
    const c = this.customers.get(id);
    if (!c) throw new Error(`No customer ${id}`);
    return c;
  }

  find(pred) {
    return [...this.customers.values()].filter(pred);
  }

  deactivate(id) {
    this.get(id).active = false;
  }

  // Store credit, in minor units (pence).
  addCredit(id, minor) {
    money.assertInt(minor, 'credit');
    if (minor < 0) throw new Error('credit must be positive');
    const c = this.get(id);
    c.credit += minor;
    return c.credit;
  }

  useCredit(id, maxMinor) {
    const c = this.get(id);
    const used = Math.min(c.credit, maxMinor);
    c.credit -= used;
    return used;
  }
}

module.exports = { CustomerRegistry, normalizeTerms, TERMS };
