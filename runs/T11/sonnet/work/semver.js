const NUM = '(0|[1-9]\\d*)';
const PRE = '(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][a-zA-Z0-9-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][a-zA-Z0-9-]*))*))?';
const BUILD = '(?:\\+([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?';
const VERSION_RE = new RegExp(`^v?${NUM}\\.${NUM}\\.${NUM}${PRE}${BUILD}$`);
const XR = '(x|X|\\*|0|[1-9]\\d*)';
const PARTIAL_RE = new RegExp(`^[v=\\s]*${XR}(?:\\.${XR}(?:\\.${XR}(?:-?([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?(?:\\+[0-9A-Za-z.-]+)?)?)?$`);

function parse(v) {
  if (typeof v !== 'string' || v.length > 256) return null;
  const m = VERSION_RE.exec(v.trim());
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ? m[4].split('.') : [] };
}

function cmpPre(a, b) {
  if (!a.length && !b.length) return 0;
  if (!a.length) return 1;
  if (!b.length) return -1;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === undefined) return -1;
    if (b[i] === undefined) return 1;
    const an = /^\d+$/.test(a[i]), bn = /^\d+$/.test(b[i]);
    if (an && bn) { const d = +a[i] - +b[i]; if (d) return d < 0 ? -1 : 1; }
    else if (an) return -1;
    else if (bn) return 1;
    else if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

function cmp(a, b) {
  for (const k of ['major', 'minor', 'patch']) if (a[k] !== b[k]) return a[k] < b[k] ? -1 : 1;
  return cmpPre(a.pre, b.pre);
}

const isX = s => s === undefined || /^[xX*]$/.test(s);

function partial(s) {
  const m = PARTIAL_RE.exec(s.trim());
  if (!m) return null;
  let [, M, m_, p, pre] = m;
  if (isX(M)) { M = m_ = p = undefined; }
  else if (isX(m_)) { m_ = p = undefined; }
  else if (isX(p)) p = undefined;
  if (p === undefined) pre = undefined;
  return {
    M: M === undefined ? undefined : +M, m: m_ === undefined ? undefined : +m_,
    p: p === undefined ? undefined : +p, pre: pre ? pre.split('.') : [],
  };
}

const V = (M, m, p, pre = []) => ({ major: M, minor: m, patch: p, pre });
const C = (op, v) => ({ op, v });
const LOW = V(0, 0, 0, ['0']);

// returns list of comparators or null if invalid
function lowerOf(P) { // >= partial
  if (P.M === undefined) return C('>=', V(0, 0, 0));
  return C('>=', V(P.M, P.m ?? 0, P.p ?? 0, P.pre));
}

function expand(tok) {
  let m;
  if ((m = /^(\^|~>?|>=|<=|>|<|=)?\s*(.*)$/.exec(tok))) {
    const op = m[1] || '';
    const P = partial(m[2].trim() === '' ? '*' : m[2]);
    if (!P) return null;
    const { M, m: mi, p, pre } = P;
    if (op === '^') {
      if (M === undefined) return [C('>=', V(0, 0, 0))];
      const lo = C('>=', V(M, mi ?? 0, p ?? 0, pre));
      let hi;
      if (M > 0) hi = V(M + 1, 0, 0, ['0']);
      else if (mi === undefined) hi = V(1, 0, 0, ['0']);
      else if (mi > 0) hi = V(0, mi + 1, 0, ['0']);
      else if (p === undefined) hi = V(0, 1, 0, ['0']);
      else hi = V(0, 0, p + 1, ['0']);
      return [lo, C('<', hi)];
    }
    if (op === '~' || op === '~>') {
      if (M === undefined) return [C('>=', V(0, 0, 0))];
      const lo = C('>=', V(M, mi ?? 0, p ?? 0, pre));
      const hi = mi === undefined ? V(M + 1, 0, 0, ['0']) : V(M, mi + 1, 0, ['0']);
      return [lo, C('<', hi)];
    }
    if (op === '' || op === '=') {
      if (M === undefined) return [C('>=', V(0, 0, 0))];
      const lo = C('>=', V(M, mi ?? 0, p ?? 0, pre));
      if (mi === undefined) return [lo, C('<', V(M + 1, 0, 0, ['0']))];
      if (p === undefined) return [lo, C('<', V(M, mi + 1, 0, ['0']))];
      return [C('=', V(M, mi, p, pre))];
    }
    if (op === '>') {
      if (M === undefined) return [C('<', LOW)];
      if (mi === undefined) return [C('>=', V(M + 1, 0, 0))];
      if (p === undefined) return [C('>=', V(M, mi + 1, 0))];
      return [C('>', V(M, mi, p, pre))];
    }
    if (op === '>=') return [lowerOf(P)];
    if (op === '<') {
      if (M === undefined) return [C('<', LOW)];
      return [C('<', V(M, mi ?? 0, p ?? 0, pre.length || p !== undefined ? pre : ['0']))];
    }
    if (op === '<=') {
      if (M === undefined) return [C('>=', V(0, 0, 0))];
      if (mi === undefined) return [C('<', V(M + 1, 0, 0, ['0']))];
      if (p === undefined) return [C('<', V(M, mi + 1, 0, ['0']))];
      return [C('<=', V(M, mi, p, pre))];
    }
  }
  return null;
}

function parseSet(s) {
  s = s.trim();
  const h = /^(\S+)\s+-\s+(\S+)$/.exec(s);
  let toks;
  const out = [];
  if (h) {
    const A = partial(h[1]), B = partial(h[2]);
    if (!A || !B) return null;
    out.push(lowerOf(A));
    if (B.M === undefined) {}
    else if (B.m === undefined) out.push(C('<', V(B.M + 1, 0, 0, ['0'])));
    else if (B.p === undefined) out.push(C('<', V(B.M, B.m + 1, 0, ['0'])));
    else out.push(C('<=', V(B.M, B.m, B.p, B.pre)));
    return out;
  }
  s = s.replace(/(\^|~>?|>=|<=|>|<|=)\s+/g, '$1');
  toks = s === '' ? [''] : s.split(/\s+/);
  for (const t of toks) {
    const e = expand(t);
    if (!e) return null;
    out.push(...e);
  }
  return out;
}

function test(c, v) {
  const r = cmp(v, c.v);
  switch (c.op) {
    case '>': return r > 0;
    case '>=': return r >= 0;
    case '<': return r < 0;
    case '<=': return r <= 0;
    default: return r === 0;
  }
}

export function satisfies(version, range) {
  const v = parse(version);
  if (!v || typeof range !== 'string') return false;
  for (const part of range.split('||')) {
    const set = parseSet(part);
    if (!set) continue;
    if (!set.every(c => test(c, v))) continue;
    if (v.pre.length) {
      const ok = set.some(c => c.v.pre.length && c.v.major === v.major &&
        c.v.minor === v.minor && c.v.patch === v.patch);
      if (!ok) continue;
    }
    return true;
  }
  return false;
}

export default satisfies;
