import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/store.js';

const fakeStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
};

test('recordAnswer adds then removes from wrong', () => {
  const s = createStore(fakeStorage());
  s.recordAnswer('q1', false);
  assert.deepEqual(s.wrongIds(), ['q1']);
  s.recordAnswer('q1', true);
  assert.deepEqual(s.wrongIds(), []);
});

test('wrongCount accumulates', () => {
  const s = createStore(fakeStorage());
  s.recordAnswer('q1', false);
  s.recordAnswer('q1', false);
  assert.equal(s.wrongCount('q1'), 2);
  assert.deepEqual(s.wrongIds(), ['q1']);
});

test('persists across instances', () => {
  const st = fakeStorage();
  createStore(st).recordAnswer('q1', false);
  createStore(st).markCardSeen('c1');
  const s = createStore(st);
  assert.deepEqual(s.wrongIds(), ['q1']);
  assert.ok(st._m.has('quiz-pandas:v1'));
});

test('unitProgress counts cards and answers of that unit', () => {
  const s = createStore(fakeStorage());
  const cards = [{ id: 'c1', unit: 1 }, { id: 'c2', unit: 1 }, { id: 'c3', unit: 2 }];
  const qs = [{ id: 'q1', unit: 1 }, { id: 'q2', unit: 1 }, { id: 'q3', unit: 2 }];
  s.markCardSeen('c1');
  s.markCardSeen('c1');
  s.recordAnswer('q1', true);
  s.recordAnswer('q2', false);
  assert.deepEqual(s.unitProgress(1, cards, qs), { cardsSeen: 1, cardsTotal: 2, answered: 2, correct: 1, total: 2 });
});

test('prunes unknown ids', () => {
  const s = createStore(fakeStorage());
  s.recordAnswer('q9-99', false);
  s.markCardSeen('c9-99');
  s.recordAnswer('q1', false);
  s.prune(new Set(['q1']), new Set(['c1']));
  assert.deepEqual(s.wrongIds(), ['q1']);
  assert.equal(s.wrongCount('q9-99'), 0);
});

test('corrupt saved data starts fresh', () => {
  const st = fakeStorage();
  st.setItem('quiz-pandas:v1', '{not json');
  assert.deepEqual(createStore(st).wrongIds(), []);
});

test('works without storage', () => {
  const a = createStore(undefined);
  a.recordAnswer('q1', false);
  assert.deepEqual(a.wrongIds(), ['q1']);
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };
  const b = createStore(throwing);
  b.recordAnswer('q2', false);
  assert.deepEqual(b.wrongIds(), ['q2']);
});

test('reset clears all', () => {
  const st = fakeStorage();
  const s = createStore(st);
  s.recordAnswer('q1', false);
  s.markCardSeen('c1');
  s.reset();
  assert.deepEqual(s.wrongIds(), []);
  assert.deepEqual(createStore(st).wrongIds(), []);
});

test('works when reading localStorage itself throws', () => {
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
  try {
    const s = createStore();
    s.recordAnswer('q1', false);
    assert.deepEqual(s.wrongIds(), ['q1']);
  } finally {
    if (desc) Object.defineProperty(globalThis, 'localStorage', desc); else delete globalThis.localStorage;
  }
});
