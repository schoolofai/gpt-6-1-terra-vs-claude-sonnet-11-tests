'use strict';
const money = require('./money');

function escapeField(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCSV(rows, columns) {
  const cols = columns || (rows.length ? Object.keys(rows[0]) : []);
  const lines = [cols.map(escapeField).join(',')];
  for (const r of rows) lines.push(cols.map((c) => escapeField(r[c])).join(','));
  return lines.join('\r\n') + '\r\n';
}

// RFC 4180-ish parser: quoted fields, doubled quotes, CRLF or LF line endings.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let i = 0;
  let quoted = false;
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { quoted = true; i++; continue; }
    if (ch === ',') { row.push(field); field = ''; i++; continue; }
    if (ch === '\r' || ch === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
      if (ch === '\r' && text[i + 1] === '\n') i++;
      i++; continue;
    }
    field += ch; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function invoicesToCSV(invoices) {
  return toCSV(
    invoices.map((i) => ({
      id: i.id,
      customer: i.customerName || i.customerId,
      date: i.date,
      due: i.dueDate,
      total: money.format(i.total, i.currency),
      status: i.status,
    })),
    ['id', 'customer', 'date', 'due', 'total', 'status']
  );
}

function parseObjects(text) {
  const [header, ...rest] = parseCSV(text);
  if (!header) return [];
  return rest.filter((r) => r.length > 1 || r[0] !== '').map((r) => Object.fromEntries(header.map((h, k) => [h, r[k] ?? ''])));
}

module.exports = { escapeField, toCSV, parseCSV, invoicesToCSV, parseObjects };
