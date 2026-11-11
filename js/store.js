// 학습 기록 저장. localStorage를 못 쓰면 메모리에만 둔다.

const KEY = 'quiz-pandas:v1';
const empty = () => ({ seenCards: [], results: {}, wrong: [] });

function safeStorage(storage) {
  const mem = new Map();
  const fallback = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v) };
  if (!storage) return fallback;
  return {
    getItem(k) {
      try { return storage.getItem(k); } catch { return fallback.getItem(k); }
    },
    setItem(k, v) {
      try { storage.setItem(k, v); } catch { fallback.setItem(k, v); }
      fallback.setItem(k, v);
    },
  };
}

function load(st) {
  try {
    const raw = st.getItem(KEY);
    if (!raw) return empty();
    const d = JSON.parse(raw);
    return {
      seenCards: Array.isArray(d.seenCards) ? d.seenCards : [],
      results: d.results && typeof d.results === 'object' ? d.results : {},
      wrong: Array.isArray(d.wrong) ? d.wrong : [],
    };
  } catch {
    return empty();
  }
}

function defaultStorage() {
  try { return globalThis.localStorage; } catch { return undefined; }
}

export function createStore(storage = defaultStorage()) {
  const st = safeStorage(storage);
  let data = load(st);
  const save = () => st.setItem(KEY, JSON.stringify(data));

  return {
    markCardSeen(id) {
      if (!data.seenCards.includes(id)) { data.seenCards.push(id); save(); }
    },
    isCardSeen(id) {
      return data.seenCards.includes(id);
    },
    recordAnswer(qid, correct) {
      const r = data.results[qid] || { last: false, wrongCount: 0 };
      r.last = correct;
      if (!correct) r.wrongCount += 1;
      data.results[qid] = r;
      data.wrong = data.wrong.filter((id) => id !== qid);
      if (!correct) data.wrong.push(qid);
      save();
    },
    wrongIds() {
      return data.wrong.slice();
    },
    wrongCount(qid) {
      return data.results[qid] ? data.results[qid].wrongCount : 0;
    },
    unitProgress(unit, cards, questions) {
      const uc = cards.filter((c) => c.unit === unit);
      const uq = questions.filter((q) => q.unit === unit);
      const answered = uq.filter((q) => data.results[q.id]);
      return {
        cardsSeen: uc.filter((c) => data.seenCards.includes(c.id)).length,
        cardsTotal: uc.length,
        answered: answered.length,
        correct: answered.filter((q) => data.results[q.id].last).length,
        total: uq.length,
      };
    },
    prune(validQids, validCardIds) {
      data.seenCards = data.seenCards.filter((id) => validCardIds.has(id));
      data.wrong = data.wrong.filter((id) => validQids.has(id));
      for (const id of Object.keys(data.results)) if (!validQids.has(id)) delete data.results[id];
      save();
    },
    reset() {
      data = empty();
      save();
    },
  };
}
