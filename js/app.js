import { createStore } from './store.js';
import { presentChoices, grade, buildSession, scoreMock, MOCK_SIZE, POINTS_PER_QUESTION } from './quiz.js';
import { esc, exampleHTML } from './render-table.js';

const view = document.getElementById('view');
const store = createStore();
const NUMS = ['①', '②', '③', '④'];
let DB = null; // { units, cards, questions, examples }
let session = null; // { key, kind, unit, list, i, choices, picks, done }

async function loadData() {
  const get = (p) => fetch(p).then((r) => { if (!r.ok) throw new Error(p); return r.json(); });
  const [c, questions, examples] = await Promise.all([get('data/cards.json'), get('data/questions.json'), get('data/examples.json')]);
  return { units: c.units, cards: c.cards, questions, examples: Object.fromEntries(examples.map((e) => [e.id, e])) };
}

const unitName = (n) => DB.units.find((u) => u.no === n)?.name ?? '';
const unitCards = (n) => DB.cards.filter((c) => c.unit === n);
const lectureTag = (on) => (on ? '<span class="tag">강의자료 기준</span>' : '');
const looksLikeCode = (s) => /^(df|pd|\[|\(|-?\d)/.test(s);
const choiceText = (s) => (looksLikeCode(s) ? `<code>${esc(s)}</code>` : esc(s));

function setTab(name) {
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === name));
  const n = store.wrongIds().length;
  document.getElementById('wrong-count').textContent = n ? ` ${n}` : '';
}

function show(html, tab) {
  view.innerHTML = html;
  setTab(tab);
  window.scrollTo(0, 0);
}

/* ---------- 홈 ---------- */
function renderHome() {
  const rows = DB.units.map((u) => {
    const p = store.unitProgress(u.no, DB.cards, DB.questions);
    const pct = p.cardsTotal ? Math.round((p.cardsSeen / p.cardsTotal) * 100) : 0;
    return `<li><a href="#/unit/${u.no}/cards/1">
      <div class="unit-top"><span class="unit-name">${u.no}. ${esc(u.name)}</span>
      <span class="unit-meta">카드 ${p.cardsSeen}/${p.cardsTotal} · 정답 ${p.correct}/${p.total}</span></div>
      <div class="bar" aria-hidden="true"><i style="width:${pct}%"></i></div></a></li>`;
  }).join('');
  const wrong = store.wrongIds().length;
  show(`<h1>6장 데이터 전처리</h1>
    <p class="sub">단원을 골라 개념 카드를 넘겨 보고, 끝나면 그 단원 문제를 풀어요. 카드 ${DB.cards.length}장 · 문제 ${DB.questions.length}문항.</p>
    <ul class="units">${rows}</ul>
    <a class="btn" href="#/mock">전 범위 모의고사 ${MOCK_SIZE}문항</a>
    <div class="row-btns"><a class="btn ghost" href="#/wrong">오답노트${wrong ? ` · ${wrong}` : ''}</a></div>
    <button class="linkbtn" id="reset" type="button">기록 초기화</button>`, 'home');
  const reset = document.getElementById('reset');
  reset.addEventListener('click', () => {
    if (reset.dataset.armed) { store.reset(); renderHome(); return; }
    reset.dataset.armed = '1';
    reset.textContent = '한 번 더 누르면 모든 기록이 지워져요';
  });
}

/* ---------- 카드 ---------- */
function renderCard(unit, k) {
  const cards = unitCards(unit);
  if (!cards.length) return renderNotFound();
  k = Math.min(Math.max(1, k), cards.length);
  const c = cards[k - 1];
  store.markCardSeen(c.id);
  const dots = cards.map((x, i) => `<i class="${i === k - 1 ? 'on' : store.isCardSeen(x.id) ? 'seen' : ''}"></i>`).join('');
  const ex = c.exampleId && DB.examples[c.exampleId] ? exampleHTML(DB.examples[c.exampleId]) : '';
  const last = k === cards.length;
  show(`<p class="crumb"><span>${unit}. ${esc(unitName(unit))} · ${k}/${cards.length}</span><a href="#/unit/${unit}/quiz">문제 풀기</a></p>
    <article class="card" id="card">
      <h2>${esc(c.title)}${lectureTag(c.lectureOnly)}</h2>
      ${c.form ? `<pre class="form">${esc(c.form)}</pre>` : ''}
      ${c.body.map((b) => `<p>${esc(b)}</p>`).join('')}
      ${ex}
      <p class="src">강의자료 ${esc(c.pages)}</p>
    </article>
    <div class="dots" aria-hidden="true">${dots}</div>
    <div class="row-btns">
      <a class="btn ghost" ${k > 1 ? `href="#/unit/${unit}/cards/${k - 1}"` : 'aria-disabled="true" tabindex="-1" style="opacity:.4;pointer-events:none"'}>이전</a>
      ${last ? `<a class="btn" href="#/unit/${unit}/quiz">이 단원 문제 풀기</a>` : `<a class="btn" href="#/unit/${unit}/cards/${k + 1}">다음</a>`}
    </div>`, 'home');
  addSwipe(document.getElementById('card'), () => {
    if (!last) location.hash = `#/unit/${unit}/cards/${k + 1}`;
  }, () => {
    if (k > 1) location.hash = `#/unit/${unit}/cards/${k - 1}`;
  });
}

function addSwipe(el, onLeft, onRight) {
  let x0 = null, y0 = null;
  el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? onLeft : onRight)();
  }, { passive: true });
}

/* ---------- 문제 풀이 ---------- */
function startSession(key, kind, opts) {
  const list = buildSession(kind, { questions: DB.questions, ...opts });
  session = { key, kind, unit: opts.unit, list, i: 0, choices: list.map((q) => presentChoices(q)), picks: [], done: false };
}

function sessionTitle() {
  if (session.kind === 'unit') return `${session.unit}. ${unitName(session.unit)}`;
  if (session.kind === 'wrong') return '오답 다시 풀기';
  return '모의고사';
}

function renderQuestion() {
  const s = session;
  const q = s.list[s.i];
  const choices = s.choices[s.i];
  const pick = s.picks[s.i];
  const answered = pick !== undefined && s.kind !== 'mock';
  const tab = s.kind === 'mock' ? 'mock' : s.kind === 'wrong' ? 'wrong' : 'home';
  const btns = choices.map((c, j) => {
    let cls = 'choice';
    if (answered) cls += c.isAnswer ? ' right' : j === pick ? ' wrong' : '';
    else if (j === pick) cls += ' picked';
    const label = q.type === 'ox' ? c.text : `<span class="no">${NUMS[j]}</span><span>${choiceText(c.text)}</span>`;
    return `<button type="button" class="${cls}" data-j="${j}" ${answered ? 'disabled' : ''}>${label}</button>`;
  }).join('');
  let after = '';
  if (answered) {
    const ok = choices[pick].isAnswer;
    const right = choices.find((c) => c.isAnswer);
    after = `<p class="result ${ok ? 'ok' : 'bad'}">${ok ? '맞았어요' : `틀렸어요. 정답은 ${q.type === 'ox' ? right.text : NUMS[choices.indexOf(right)]}`}</p>
      <div class="explain">${esc(q.explain)}</div>
      <p class="src">강의자료 ${esc(q.pages)}${lectureTag(q.lectureOnly)}</p>
      <button type="button" class="btn" id="next">${s.i + 1 < s.list.length ? '다음 문제' : '결과 보기'}</button>`;
  } else if (s.kind === 'mock') {
    after = `<div class="row-btns"><button type="button" class="btn" id="next" ${pick === undefined ? 'disabled' : ''}>${s.i + 1 < s.list.length ? '다음' : '제출하고 채점'}</button></div>`;
  }
  show(`<p class="crumb"><span>${esc(sessionTitle())} · 문제 ${s.i + 1}/${s.list.length}</span></p>
    <p class="qtype">${q.type === 'ox' ? 'O/X' : '객관식'}</p>
    <p class="stem">${esc(q.stem)}</p>
    ${q.code ? `<pre class="code">${esc(q.code)}</pre>` : ''}
    <div class="choices ${q.type === 'ox' ? 'ox' : ''}">${btns}</div>
    ${after}`, tab);

  view.querySelectorAll('.choice').forEach((b) => b.addEventListener('click', () => {
    const j = Number(b.dataset.j);
    s.picks[s.i] = j;
    if (s.kind !== 'mock') store.recordAnswer(q.id, grade(q, choices[j]));
    renderQuestion();
    if (s.kind !== 'mock') document.querySelector('.result')?.scrollIntoView({ block: 'nearest' });
  }));
  document.getElementById('next')?.addEventListener('click', () => {
    if (s.i + 1 < s.list.length) { s.i += 1; renderQuestion(); } else finishSession();
  });
}

function finishSession() {
  const s = session;
  s.done = true;
  const results = s.list.map((q, i) => grade(q, s.choices[i][s.picks[i]]));
  if (s.kind === 'mock') s.list.forEach((q, i) => store.recordAnswer(q.id, results[i]));
  const correct = results.filter(Boolean).length;
  const items = s.list.map((q, i) => {
    const ch = s.choices[i];
    const right = ch.find((c) => c.isAnswer);
    const mine = ch[s.picks[i]];
    const fmt = (c) => (q.type === 'ox' ? c.text : `${NUMS[ch.indexOf(c)]} ${esc(c.text)}`);
    return `<li><div class="line"><span>${i + 1}. ${esc(q.stem)}</span><span class="${results[i] ? 'mark-ok' : 'mark-bad'}">${results[i] ? '정답' : '오답'}</span></div>
      ${results[i] ? '' : `${q.code ? `<pre class="code">${esc(q.code)}</pre>` : ''}<p class="meta">내 답 ${mine ? fmt(mine) : '없음'} · 정답 ${fmt(right)}</p><div class="explain">${esc(q.explain)}</div>`}</li>`;
  }).join('');
  const head = s.kind === 'mock'
    ? `<h1>모의고사 결과</h1><p class="score">${scoreMock(results).points} / ${s.list.length * POINTS_PER_QUESTION}점</p><p class="sub">${s.list.length}문항 중 ${correct}개 맞음 · 문항당 ${POINTS_PER_QUESTION}점</p>`
    : `<h1>${esc(sessionTitle())} 결과</h1><p class="score">${correct} / ${s.list.length}</p><p class="sub">틀린 문제는 오답노트에 모였어요.</p>`;
  const nextUnit = s.kind === 'unit' && s.unit < DB.units.length ? `<a class="btn" href="#/unit/${s.unit + 1}/cards/1">다음 단원: ${s.unit + 1}. ${esc(unitName(s.unit + 1))}</a>` : '';
  show(`${head}
    <ul class="list">${items}</ul>
    ${nextUnit}
    <div class="row-btns">
      ${store.wrongIds().length ? '<a class="btn ghost" href="#/wrong/quiz">틀린 문제 다시 풀기</a>' : ''}
      <a class="btn ghost" href="#/">단원 목록</a>
    </div>`, s.kind === 'mock' ? 'mock' : s.kind === 'wrong' ? 'wrong' : 'home');
}

function runSession(key, kind, opts, emptyHTML, tab) {
  if (!session || session.key !== key || session.done) startSession(key, kind, opts);
  if (!session.list.length) return show(emptyHTML, tab);
  renderQuestion();
}

/* ---------- 오답노트, 모의고사 ---------- */
function renderWrong() {
  const ids = store.wrongIds();
  const qs = ids.map((id) => DB.questions.find((q) => q.id === id)).filter(Boolean);
  const lastLine = (code) => code.trim().split('\n').pop();
  const list = qs.map((q) => `<li><div class="line"><span>${esc(q.stem)}${q.code ? `<br><code class="meta">${esc(lastLine(q.code))}</code>` : ''}</span><span class="meta" style="white-space:nowrap">${store.wrongCount(q.id)}번 틀림</span></div>
    <p class="meta">${q.unit}. ${esc(unitName(q.unit))} · 강의자료 ${esc(q.pages)}</p></li>`).join('');
  show(`<h1>오답노트</h1>
    <p class="sub">${qs.length ? `틀린 문제 ${qs.length}개. 다시 맞히면 목록에서 빠져요.` : '틀린 문제가 없어요.'}</p>
    ${qs.length ? `<a class="btn" href="#/wrong/quiz">틀린 문제만 다시 풀기</a><ul class="list" style="margin-top:20px">${list}</ul>` : '<a class="btn ghost" href="#/">단원 목록으로</a>'}
    <p class="note">강의자료와 실제 pandas 동작이 다른 부분은 '강의자료 기준' 표시가 붙어 있어요. 시험은 강의자료 기준으로 답해요.</p>`, 'wrong');
}

function renderMockStart() {
  show(`<h1>전 범위 모의고사</h1>
    <p class="sub">${DB.questions.length}문항 중 ${Math.min(MOCK_SIZE, DB.questions.length)}문항을 무작위로 내요. 문항당 ${POINTS_PER_QUESTION}점, ${Math.min(MOCK_SIZE, DB.questions.length) * POINTS_PER_QUESTION}점 만점. 풀이 중에는 채점하지 않고 끝나면 한꺼번에 보여 줘요.</p>
    <button type="button" class="btn" id="start">시작하기</button>`, 'mock');
  document.getElementById('start').addEventListener('click', () => {
    session = null;
    location.hash = '#/mock/run';
  });
}

function renderNotFound() {
  show('<h1>페이지를 찾을 수 없어요</h1><a class="btn ghost" href="#/">단원 목록으로</a>', 'home');
}

/* ---------- 라우터 ---------- */
function route() {
  const h = location.hash.replace(/^#/, '') || '/';
  let m;
  if (h === '/') return renderHome();
  if ((m = h.match(/^\/unit\/(\d)\/cards\/(\d+)$/))) return renderCard(Number(m[1]), Number(m[2]));
  if ((m = h.match(/^\/unit\/(\d)\/quiz$/))) {
    const unit = Number(m[1]);
    if (!unitCards(unit).length) return renderNotFound();
    return runSession('unit' + unit, 'unit', { unit }, '<h1>문제가 없어요</h1>', 'home');
  }
  if (h === '/wrong') return renderWrong();
  if (h === '/wrong/quiz') {
    return runSession('wrong', 'wrong', { wrongIds: store.wrongIds() },
      '<h1>오답노트</h1><p class="sub">틀린 문제가 없어요.</p><a class="btn ghost" href="#/">단원 목록으로</a>', 'wrong');
  }
  if (h === '/mock') return renderMockStart();
  if (h === '/mock/run') return runSession('mock', 'mock', {}, '<h1>문제가 없어요</h1>', 'mock');
  return renderNotFound();
}

async function main() {
  try {
    DB = await loadData();
  } catch {
    view.innerHTML = '<h1>데이터를 불러오지 못했어요</h1><p class="sub">인터넷 연결을 확인하고 새로고침해 주세요.</p>';
    return;
  }
  store.prune(new Set(DB.questions.map((q) => q.id)), new Set(DB.cards.map((c) => c.id)));
  window.addEventListener('hashchange', route);
  route();
}

main();
