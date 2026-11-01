# ShopLite

Tiny cart/checkout library. `npm test` runs tests (Node 20+).

Prices are non-negative pound amounts in whole pence. Monetary totals are limited
to £10 billion. Quantities added must be positive safe integers; `setQty` accepts
zero to remove an item. Discounts are rounded to the nearest penny (half up)
before checking the £50 free-shipping threshold. Empty carts have no shipping.
