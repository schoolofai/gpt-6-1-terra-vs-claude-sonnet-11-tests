import { test } from 'node:test';
import assert from 'node:assert/strict';
import { satisfies } from './semver.js';

test('exact versions, comparator sets, OR, and metadata', () => {
  const cases = [
    ['1.2.3+build.1', '=v1.2.3+other', true],
    ['1.2.4', '>= 1.2.3 < 2.0.0', true],
    ['2.0.0', '>=1.2.3 <2.0.0', false],
    ['2.1.0', '1.x || >=2.1.0 <3', true],
    ['3.0.0', '1.x || >=2.1.0 <3', false],
    ['1.2.3', '1.2.3 || not-a-range', false],
    ['1.0.0', '> *', false],
    ['1.0.0', '<= *', true],
  ];
  for (const [v, r, expected] of cases) assert.equal(satisfies(v, r), expected, `${v} ${r}`);
});

test('caret, tilde, partial, wildcard, and hyphen boundaries', () => {
  const cases = [
    ['1.9.9', '^1.2.3', true], ['2.0.0', '^1.2.3', false],
    ['0.2.9', '^0.2.3', true], ['0.3.0', '^0.2.3', false],
    ['0.0.3', '^0.0.3', true], ['0.0.4', '^0.0.3', false],
    ['0.0.9', '^0.0', true], ['0.1.0', '^0.0', false],
    ['0.9.0', '^0', true], ['1.0.0', '^0', false],
    ['1.2.9', '~1.2.3', true], ['1.3.0', '~1.2.3', false],
    ['0.0.9', '~0.0.1', true], ['0.1.0', '~0.0.1', false],
    ['1.9.0', '~1', true], ['2.0.0', '~1', false],
    ['1.2.8', '1.2.*', true], ['1.3.0', '1.2', false],
    ['1.9.0', '1', true], ['2.0.0', '1', false],
    ['2.0.0', '>1', true], ['1.9.9', '>1', false],
    ['1.2.9', '<=1.2', true], ['1.3.0', '<=1.2', false],
    ['1.2.0', '1.2 - 2.3', true], ['2.3.99', '1.2 - 2.3', true],
    ['2.4.0', '1.2 - 2.3', false], ['2.3.4', '1.2.3 - 2.3.4', true],
    ['2.3.5', '1.2.3 - 2.3.4', false],
  ];
  for (const [v, r, expected] of cases) assert.equal(satisfies(v, r), expected, `${v} ${r}`);
});

test('prereleases require a matching comparator in the same set', () => {
  const cases = [
    ['1.2.3-alpha', '*', false], ['1.2.3-alpha', '>=1.2.3-alpha', true],
    ['1.2.4-alpha', '>=1.2.3-alpha', false],
    ['1.2.3-beta', '>=1.2.3-alpha <1.2.3', true],
    ['1.2.3-beta', '<1.2.3 || >=2.0.0-alpha', false],
    ['1.2.3-beta', '* || >=1.2.3-alpha', false],
    ['2.0.0-rc.1', '^1.2.3', false],
    ['1.2.3-2', '>1.2.3-1 <1.2.3-alpha', true],
    ['1.2.3-alpha.10', '>1.2.3-alpha.2', true],
    ['1.2.3-alpha.2', '>1.2.3-alpha.10', false],
    ['1.2.3-alpha', '<1.2.3-alpha.1', true],
    ['1.2.3-100000000000000000000', '>1.2.3-99999999999999999999', true],
  ];
  for (const [v, r, expected] of cases) assert.equal(satisfies(v, r), expected, `${v} ${r}`);
});

test('reject invalid versions and ranges', () => {
  for (const v of ['1', '1.2', '01.2.3', '1.02.3', '1.2.3-01', '1.2.3+', '1.2.3.4', '9007199254740992.0.0', '', null, 123]) {
    assert.equal(satisfies(v, '*'), false, String(v));
  }
  for (const r of ['1.02.3', '>=', '1.2.3.4', '1.x.3', '1.2.3 -', 'garbage', 42]) {
    assert.equal(satisfies('1.2.3', r), false, String(r));
  }
});
