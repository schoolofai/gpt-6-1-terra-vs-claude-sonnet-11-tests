# R11 ledgerly planted bugs (hidden tests B1-B10 in hidden/bugs.test.js)
B1 money.allocate rounds each part, parts no longer sum (also breaks shipping.splitParcels, tax spread)
B2 dates.addBusinessDays checks weekend before advancing
B3 csv.escapeField doesn't double embedded quotes
B4 reports.bucketFor uses < instead of <= (30/60/90 boundaries)
B5 discounts.validate rejects coupon on its expiry date (>= vs >)
B6 events.once removes fn not wrapper -> fires every time (Ledger.firstPaidInvoice overwritten)
B7 [cross orders/tax/discounts] VAT computed on pre-discount lines (discount not passed to taxForLines)
B8 [cross index/orders/inventory] order.cancelled handler in index releases stock again; inventory.release clamps silently instead of throwing
B9 [cross payments/customers/money] overpayment credit converted to pounds (/100) though credit is pence
B10 [cross invoices/dates/customers] due date uses business days, README says calendar days
Regression tests R1-R9 pass on both buggy and reference code.
