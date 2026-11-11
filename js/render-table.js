// 실행 전후 데이터 표를 HTML 문자열로 만든다(DOM 불필요).

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function tableHTML(t, { deletedCols = [], changedCols = [] } = {}) {
  const chg = new Set((t.changed || []).map(([r, c]) => r + ':' + c));
  const head = t.columns
    .map((c, j) => {
      const cls = deletedCols.includes(c) ? ' class="delc"' : changedCols.includes(j) ? ' class="chgc"' : '';
      return `<th${cls}>${esc(c)}</th>`;
    })
    .join('');
  const body = t.rows
    .map((row, i) => {
      const cells = row
        .map((v, j) => {
          const isNa = v === 'NaN' || v === 'NaT' || v === 'None';
          const cls = [chg.has(i + ':' + j) ? 'chg' : '', isNa ? 'na' : ''].filter(Boolean).join(' ');
          return `<td${cls ? ` class="${cls}"` : ''}>${esc(v)}</td>`;
        })
        .join('');
      return `<tr><th class="ix">${esc(t.index[i])}</th>${cells}</tr>`;
    });
  return `<div class="ex-table"><div class="ex-name">${esc(t.name)}</div><div class="ex-scroll"><table><thead><tr><th class="ix"></th>${head}</tr></thead><tbody>${body.join('')}</tbody></table></div></div>`;
}

/** before 표 → 코드 → after 표(또는 출력 텍스트) */
export function exampleHTML(e) {
  const after = e.after;
  const removed = new Set(after.deleted || []);
  const beforeHTML = e.before
    .map((t, k) => {
      const html = tableHTML(t, { deletedCols: k === 0 && e.before.length === 1 ? after.deletedCols || [] : [] });
      if (!removed.size) return html;
      // 삭제될 행을 before 표에서 줄 그어 표시
      return html.replace(/<tr><th class="ix">([^<]*)<\/th>/g, (m, ix) =>
        removed.has(ix) ? `<tr class="del"><th class="ix">${ix}</th>` : m);
    })
    .join('');
  const afterHTML = 'text' in after
    ? `<pre class="ex-text">${esc(after.text)}</pre>`
    : tableHTML(after, { changedCols: after.changedCols || [] });
  return `<div class="example"><pre class="ex-code">${esc(e.code)}</pre><div class="ex-flow"><div class="ex-before">${beforeHTML}</div><div class="ex-arrow" aria-hidden="true">→</div><div class="ex-after">${afterHTML}</div></div></div>`;
}
