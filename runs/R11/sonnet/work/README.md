# ledgerly

A small order-to-cash library used by our back office. Everything is in-memory and
synchronous so it is easy to test.

Flow: `Ledger` (src/index.js) wires together the modules:

- `money.js`     integer-pence money helpers (all internal amounts are integer minor units, e.g. pence)
- `dates.js`     ISO date helpers (UTC, `YYYY-MM-DD` strings)
- `events.js`    tiny synchronous event bus
- `customers.js` customer registry, payment terms, store credit
- `inventory.js` stock levels and reservations
- `discounts.js` coupon codes and volume tiers
- `tax.js`       VAT rates per region
- `orders.js`    orders, totals, place / cancel
- `invoices.js`  invoices raised from placed orders
- `payments.js`  payments against invoices, overpayments become store credit
- `reports.js`   aged debt and monthly revenue
- `csv.js`       CSV export / import
- `shipping.js`  shipping quotes by weight band and zone
- `recurring.js` recurring billing plans

Conventions
- Money is always integer minor units (pence). Display formatting only in `money.format`.
- Dates are `YYYY-MM-DD` strings in UTC.
- Discounts apply before tax. Tax is computed on the discounted net amount.
- A coupon is valid up to and including its `expires` date.
- Payment terms are calendar days (NET30 = due 30 calendar days after the invoice date).
- Aged debt buckets: `current` (not yet due), `1-30`, `31-60`, `61-90`, `90+` days overdue.

Run tests with `npm test` (Node 20+, no dependencies).
