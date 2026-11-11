// 퀴즈 로직: DOM과 무관한 순수 함수.

export const MOCK_SIZE = 20;
export const POINTS_PER_QUESTION = 2;

/** 새 배열로 섞는다(Fisher–Yates). */
export function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 화면에 보일 보기 목록. O/X는 순서 고정, 객관식은 섞는다. */
export function presentChoices(q, rand = Math.random) {
  if (q.type === 'ox') {
    return [
      { text: 'O', isAnswer: q.answer === true },
      { text: 'X', isAnswer: q.answer === false },
    ];
  }
  return shuffle(q.choices.map((text, i) => ({ text, isAnswer: i === q.answer })), rand);
}

export function grade(_q, picked) {
  return Boolean(picked && picked.isAnswer);
}

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** 풀 문항 목록을 만든다. kind: 'unit' | 'wrong' | 'mock' */
export function buildSession(kind, { questions, unit, wrongIds = [], rand = Math.random }) {
  if (kind === 'unit') return questions.filter((q) => q.unit === unit).sort(byId);
  if (kind === 'wrong') {
    const want = new Set(wrongIds);
    return shuffle(questions.filter((q) => want.has(q.id)), rand);
  }
  if (kind === 'mock') return shuffle(questions, rand).slice(0, MOCK_SIZE);
  throw new Error('unknown session kind: ' + kind);
}

export function scoreMock(answers) {
  const correct = answers.filter(Boolean).length;
  return { correct, points: correct * POINTS_PER_QUESTION, max: answers.length * POINTS_PER_QUESTION };
}
