'use strict';
const path = require('path');
const ROOT = process.env.LEDGERLY_ROOT || path.join(__dirname, '..');
const req = (m) => require(path.join(ROOT, 'src', m));
function shop() {
  const { Ledger } = req('index');
  const L = new Ledger();
  L.inventory.addProduct({ sku: 'MUG', name: 'Mug', price: 1250, onHand: 50 });
  L.inventory.addProduct({ sku: 'TEE', name: 'T-shirt', price: 1999, onHand: 20 });
  L.inventory.addProduct({ sku: 'BOOK', name: 'Book', price: 899, onHand: 30 });
  const c = L.customers.add({ name: 'Acme Ltd', email: 'ap@acme.test', region: 'UK', terms: 'NET30' });
  return { L, c };
}
module.exports = { req, shop };
