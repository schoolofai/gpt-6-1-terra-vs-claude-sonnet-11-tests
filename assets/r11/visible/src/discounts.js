'use strict';
const money = require('./money');
const dates = require('./dates');

// Coupons: { code, type: 'percent'|'fixed', value, expires?: 'YYYY-MM-DD', minSpend?: pence, maxUses?: n }
class Discounts {
  constructor() {
    this.coupons = new Map();
    this.uses = new Map();
    this.tiers = []; // [{ minQty, pct }]
  }

  addCoupon(c) {
    const code = c.code.toUpperCase();
    if (!['percent', 'fixed'].includes(c.type)) throw new Error(`Bad coupon type ${c.type}`);
    if (c.type === 'percent' && (c.value <= 0 || c.value > 100)) throw new Error('percent must be 1-100');
    this.coupons.set(code, { ...c, code });
    this.uses.set(code, 0);
  }

  setTiers(tiers) {
    this.tiers = [...tiers].sort((a, b) => b.minQty - a.minQty);
  }

  tierPercent(totalQty) {
    const t = this.tiers.find((x) => totalQty >= x.minQty);
    return t ? t.pct : 0;
  }

  validate(code, subtotal, onDate) {
    const c = this.coupons.get(String(code).toUpperCase());
    if (!c) return { ok: false, reason: 'unknown' };
    if (c.expires && dates.compare(onDate, c.expires) >= 0) return { ok: false, reason: 'expired' };
    if (c.minSpend && subtotal < c.minSpend) return { ok: false, reason: 'min-spend' };
    if (c.maxUses != null && this.uses.get(c.code) >= c.maxUses) return { ok: false, reason: 'used-up' };
    return { ok: true, coupon: c };
  }

  // Returns discount amount in pence for a subtotal. Never more than the subtotal.
  discountFor(subtotal, { code, totalQty = 0, onDate }) {
    let discount = money.percent(subtotal, this.tierPercent(totalQty));
    if (code) {
      const v = this.validate(code, subtotal, onDate);
      if (!v.ok) throw new Error(`Coupon ${code} rejected: ${v.reason}`);
      const after = subtotal - discount;
      discount += v.coupon.type === 'percent' ? money.percent(after, v.coupon.value) : v.coupon.value;
    }
    return Math.min(discount, subtotal);
  }

  redeem(code) {
    const k = String(code).toUpperCase();
    this.uses.set(k, (this.uses.get(k) || 0) + 1);
  }
}

module.exports = { Discounts };
