// A small, strict SemVer range evaluator. Build metadata never affects ordering.
const MAX_LENGTH = 256;
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const NUMBER = '(?:0|[1-9][0-9]*)';
const PART = `(?:${NUMBER}|[xX*])`;
const ID = '[0-9A-Za-z-]+';
const partialRE = new RegExp(`^v?(${PART})(?:\\.(${PART})(?:\\.(${PART})(?:-(${ID}(?:\\.${ID})*))?(?:\\+(${ID}(?:\\.${ID})*))?)?)?$`);
const isWildcard = value => value === undefined || /^[xX*]$/.test(value);

function parsePartial(input) {
  if (typeof input !== 'string' || input.length > MAX_LENGTH) return null;
  const match = partialRE.exec(input);
  if (!match) return null;
  const parts = match.slice(1, 4);
  const nums = [];
  for (const part of parts) {
    if (isWildcard(part)) nums.push(null);
    else {
      const n = BigInt(part);
      if (n > MAX_SAFE) return null;
      nums.push(n);
    }
  }
  const pre = match[4] ? match[4].split('.') : [];
  if (pre.some(id => /^\d+$/.test(id) && id.length > 1 && id[0] === '0')) return null;
  return { major: nums[0], minor: nums[1], patch: nums[2], pre };
}

function parseVersion(input) {
  if (typeof input !== 'string' || input.length > MAX_LENGTH) return null;
  const p = parsePartial(input.trim());
  if (!p || p.major === null || p.minor === null || p.patch === null) return null;
  return p;
}

function compareIdentifiers(a, b) {
  const an = /^\d+$/.test(a), bn = /^\d+$/.test(b);
  if (an && bn) return a.length !== b.length ? (a.length < b.length ? -1 : 1) : (a < b ? -1 : a > b ? 1 : 0);
  if (an !== bn) return an ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function compare(a, b) {
  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  }
  if (!a.pre.length || !b.pre.length) return a.pre.length ? -1 : b.pre.length ? 1 : 0;
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    if (i === a.pre.length) return -1;
    if (i === b.pre.length) return 1;
    const result = compareIdentifiers(a.pre[i], b.pre[i]);
    if (result) return result;
  }
  return 0;
}

const v = (major, minor = 0n, patch = 0n, pre = []) => ({ major, minor, patch, pre });
const floor = p => v(p.major, p.minor ?? 0n, p.patch ?? 0n, p.pre);
const upperMajor = p => v(p.major + 1n, 0n, 0n, ['0']);
const upperMinor = p => v(p.major, p.minor + 1n, 0n, ['0']);
const upperPatch = p => v(p.major, p.minor, p.patch + 1n, ['0']);
const cmp = (op, version) => ({ op, version });
const NEVER = () => [cmp('<', v(0n, 0n, 0n, ['0']))];

function expand(op, p) {
  const majorWild = p.major === null;
  const minorWild = majorWild || p.minor === null;
  const patchWild = minorWild || p.patch === null;
  if (op === '^' || op === '~' || op === '~>') {
    if (majorWild) return [];
    let upper;
    if (minorWild) upper = upperMajor(p);
    else if (op !== '^') upper = upperMinor(p);
    else if (p.major > 0n) upper = upperMajor(p);
    else if (patchWild || p.minor > 0n) upper = upperMinor(p);
    else upper = upperPatch(p);
    // A wildcard discards later components and any prerelease.
    const lower = v(p.major, minorWild ? 0n : p.minor, patchWild ? 0n : p.patch, patchWild ? [] : p.pre);
    return [cmp('>=', lower), cmp('<', upper)];
  }
  if (majorWild) return op === '>' || op === '<' ? NEVER() : [];
  if (!patchWild) return [cmp(op || '=', floor(p))];
  const lower = v(p.major, minorWild ? 0n : p.minor);
  const upper = minorWild ? upperMajor(p) : upperMinor(p);
  if (op === '>') return [cmp('>=', v(upper.major, upper.minor, upper.patch))];
  if (op === '>=') return [cmp('>=', lower)];
  if (op === '<') return [cmp('<', v(lower.major, lower.minor, lower.patch, ['0']))];
  if (op === '<=') return [cmp('<', upper)];
  return [cmp('>=', lower), cmp('<', upper)];
}

function hyphen(from, to) {
  const result = [];
  if (from.major !== null) {
    const minorWild = from.minor === null;
    const patchWild = minorWild || from.patch === null;
    result.push(cmp('>=', v(from.major, minorWild ? 0n : from.minor, patchWild ? 0n : from.patch, patchWild ? [] : from.pre)));
  }
  if (to.major !== null) {
    if (to.minor === null) result.push(cmp('<', upperMajor(to)));
    else if (to.patch === null) result.push(cmp('<', upperMinor(to)));
    else result.push(cmp('<=', floor(to)));
  }
  return result;
}

function parseSet(text) {
  const result = [];
  let invalid = false;
  // Hyphens are ranges only when surrounded by whitespace.
  text = text.replace(/(\S+)\s+-\s+(\S+)/g, (_, a, b) => {
    const from = parsePartial(a), to = parsePartial(b);
    if (!from || !to) invalid = true;
    else result.push(...hyphen(from, to));
    return ' ';
  });
  if (invalid) return null;
  text = text.trim().replace(/(<=|>=|<|>|=|\^|~>|~)\s+/g, '$1');
  for (const token of text ? text.split(/\s+/) : []) {
    const match = /^(<=|>=|<|>|=|\^|~>|~)?(.+)$/.exec(token);
    if (!match) return null;
    const p = parsePartial(match[2]);
    if (!p) return null;
    const op = match[1] || '';
    // Bare X-ranges cannot put a concrete component after a wildcard.
    // Caret and tilde ranges are expanded before that validation in npm.
    if (op !== '^' && op !== '~' && op !== '~>' &&
        (p.major === null && p.minor !== null || p.minor === null && p.patch !== null)) return null;
    result.push(...expand(op, p));
  }
  // Expanded boundaries must themselves be valid SemVer core components.
  if (result.some(({ version }) => version.major > MAX_SAFE ||
    version.minor > MAX_SAFE || version.patch > MAX_SAFE)) return null;
  // >=0.0.0 is an unrestricted comparator under the default prerelease rules.
  return result.filter(({ op, version }) => !(op === '>=' && version.major === 0n &&
    version.minor === 0n && version.patch === 0n && !version.pre.length));
}

function testSet(version, set) {
  for (const { op, version: target } of set) {
    const order = compare(version, target);
    if (op === '=' && order !== 0 || op === '>' && order <= 0 ||
        op === '>=' && order < 0 || op === '<' && order >= 0 ||
        op === '<=' && order > 0) return false;
  }
  if (version.pre.length && !set.some(({ version: target }) =>
    target.pre.length && target.major === version.major &&
    target.minor === version.minor && target.patch === version.patch)) return false;
  return true;
}

export function satisfies(version, range) {
  const parsed = parseVersion(version);
  if (!parsed || (range != null && typeof range !== 'string')) return false;
  const sets = (range || '').split('||').map(parseSet);
  if (sets.some(set => set === null)) return false;
  // npm collapses an OR containing an unrestricted set to just that set.
  if (sets.some(set => set.length === 0)) return !parsed.pre.length;
  return sets.some(set => testSet(parsed, set));
}
