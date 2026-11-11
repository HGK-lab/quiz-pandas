import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shuffle, presentChoices, grade, buildSession, scoreMock } from '../js/quiz.js';

const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const ox = (id, answer) => ({ id, unit: 1, type: 'ox', answer });
const mc = (id, unit = 1) => ({ id, unit, type: 'mc', choices: ['a', 'b', 'c', 'd'], answer: 2 });

test('presentChoices keeps O,X order for ox', () => {
  const r = presentChoices(ox('q', false), seq([0.9, 0.1]));
  assert.deepEqual(r.map((c) => c.text), ['O', 'X']);
  assert.equal(r[1].isAnswer, true);
  assert.equal(r[0].isAnswer, false);
});

test('presentChoices shuffles mc but keeps one answer', () => {
  const r = presentChoices(mc('q'), seq([0.1, 0.2, 0.3]));
  assert.notDeepEqual(r.map((c) => c.text), ['a', 'b', 'c', 'd']);
  assert.equal(r.filter((c) => c.isAnswer).length, 1);
  assert.equal(r.find((c) => c.isAnswer).text, 'c');
});

test('grade reads isAnswer', () => {
  assert.equal(grade(mc('q'), { isAnswer: true }), true);
  assert.equal(grade(mc('q'), { isAnswer: false }), false);
});

test('shuffle returns new array with same items', () => {
  const a = [1, 2, 3, 4];
  const r = shuffle(a, seq([0.5]));
  assert.notEqual(r, a);
  assert.deepEqual([...r].sort(), [1, 2, 3, 4]);
});

test('unit session keeps id order of that unit', () => {
  const qs = [mc('q2-01', 2), mc('q1-02'), mc('q1-01')];
  assert.deepEqual(buildSession('unit', { questions: qs, unit: 1 }).map((q) => q.id), ['q1-01', 'q1-02']);
});

test('mock picks 20 distinct', () => {
  const qs = Array.from({ length: 35 }, (_, i) => mc('q' + i));
  const r = buildSession('mock', { questions: qs, rand: Math.random });
  assert.equal(r.length, 20);
  assert.equal(new Set(r.map((q) => q.id)).size, 20);
});

test('mock with fewer than 20 returns all', () => {
  const qs = Array.from({ length: 5 }, (_, i) => mc('q' + i));
  assert.equal(buildSession('mock', { questions: qs }).length, 5);
});

test('wrong session only wrong ids', () => {
  const qs = [mc('a'), mc('b'), mc('c')];
  const r = buildSession('wrong', { questions: qs, wrongIds: ['c', 'a'] });
  assert.deepEqual(r.map((q) => q.id).sort(), ['a', 'c']);
});

test('wrong-only session empty', () => {
  assert.deepEqual(buildSession('wrong', { questions: [mc('a')], wrongIds: [] }), []);
});

test('scoreMock', () => {
  assert.deepEqual(scoreMock([true, false, true]), { correct: 2, points: 4, max: 6 });
});
