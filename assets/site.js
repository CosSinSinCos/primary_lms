// 小学自学系统 · 静态站点脚本（GitHub Pages 版）
// 复用 Flask 版的前端渲染逻辑，改为 fetch 读取 data/*.json；隐藏错题集相关功能。
const STATIC_BASE = 'src/static/';

function escapeHTML(s) {
  return String(s == null ? '' : s).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}

// ---------- 侧边栏（静态导航，不含错题集） ----------
function mountSidebar() {
  const el = document.getElementById('sidebar');
  if (!el) return;
  const nav = [
    { group: '语文', items: [
      { href: 'roadmap.html?subject=chinese', label: '语文导图', page: 'roadmap-chinese' },
      { href: 'chinese.html', label: '语文生字', page: 'chinese' },
      { href: 'recite.html', label: '文章背诵', page: 'recite' },
    ]},
    { group: '数学', items: [
      { href: 'roadmap.html?subject=math', label: '数学导图', page: 'roadmap-math' },
      { href: 'mathcalc.html', label: '数学计算', page: 'mathcalc' },
      { href: 'strategy.html', label: '解题思路', page: 'strategy' },
    ]},
  ];
  let html = '<a class="brand" href="index.html">小学自学系统</a>';
  nav.forEach(g => {
    const groupClass = g.group === '语文' ? 'side-group-chinese' : (g.group === '数学' ? 'side-group-math' : '');
    html += '<div class="side-group ' + groupClass + '">' + g.group + '</div><nav class="main-menu">';
    g.items.forEach(it => {
      html += '<a class="menu-item" data-page="' + it.page + '" href="' + it.href + '">' + it.label + '</a>';
    });
    html += '</nav>';
  });
  el.innerHTML = html;
  const cur = document.body.dataset.page || '';
  el.querySelectorAll('.menu-item').forEach(a => {
    if (a.dataset.page === cur) a.classList.add('active');
  });
}

// ---------- 知识点导图 ----------
let ROADMAP_DATA = null;
function showNode(btn) {
  document.querySelectorAll('.node-chip.selected').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const subject = document.getElementById('roadmap-root').dataset.subject;
  const lineCode = btn.dataset.line;
  const grade = btn.dataset.grade;
  const idx = parseInt(btn.dataset.idx, 10);
  let node = null;
  if (ROADMAP_DATA && ROADMAP_DATA[subject]) {
    const line = ROADMAP_DATA[subject].lines.find(l => l.code === lineCode);
    if (line && line.grades[grade]) node = line.grades[grade][idx];
  }
  if (!node) return;
  renderBoard(node, subject, lineCode);
  const board = document.getElementById('board');
  if (board && window.scrollY > board.getBoundingClientRect().top + window.scrollY - 80) {
    board.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function renderBoard(node, subject, lineCode) {
  document.getElementById('board-empty').hidden = true;
  const content = document.getElementById('board-content');
  content.hidden = false;
  document.getElementById('board-title').textContent = node.name || '';
  const wrap = document.getElementById('board-sections');
  wrap.innerHTML = '';
  if (node.example) wrap.appendChild(makeSection('📝 例题', node.example, 'sec-example'));
  if (node.textbook || node.textbook_svg) wrap.appendChild(makeTextbookSection(node));
  if (node.comic || node.comic_svg) {
    if (node.comic_svg) wrap.appendChild(makeImageSection('🎨 趣味漫画', node.comic_svg, 'sec-comic'));
    else wrap.appendChild(makeComic(node.comic, node.textbook));
  }
  const link = document.getElementById('board-errlink');
  if (link) link.hidden = true;
}

function makeSection(title, text, cls) {
  const sec = document.createElement('div');
  sec.className = 'bd-section ' + (cls || '');
  const h = document.createElement('div');
  h.className = 'bd-sec-title';
  h.textContent = title;
  const body = document.createElement('div');
  body.className = 'bd-sec-body';
  body.textContent = text;
  sec.appendChild(h);
  sec.appendChild(body);
  return sec;
}

function makeTextbookSection(node) {
  const sec = document.createElement('div');
  sec.className = 'bd-section sec-textbook';
  const h = document.createElement('div');
  h.className = 'bd-sec-title';
  h.textContent = '📖 课本原文';
  sec.appendChild(h);
  if (node.textbook_svg) {
    const figBox = document.createElement('div');
    figBox.className = 'bd-fig-box';
    const img = document.createElement('img');
    img.className = 'bd-fig';
    img.src = STATIC_BASE + node.textbook_svg;
    img.alt = node.name + ' 课本讲解图';
    figBox.appendChild(img);
    sec.appendChild(figBox);
  }
  if (node.textbook) {
    const body = document.createElement('div');
    body.className = 'bd-sec-body bd-quote';
    body.textContent = node.textbook;
    sec.appendChild(body);
  }
  return sec;
}

function makeImageSection(title, svgPath, cls) {
  const sec = document.createElement('div');
  sec.className = 'bd-section ' + (cls || '');
  const h = document.createElement('div');
  h.className = 'bd-sec-title';
  h.textContent = title;
  sec.appendChild(h);
  const img = document.createElement('img');
  img.className = 'bd-comic-img';
  img.src = STATIC_BASE + svgPath;
  img.alt = '趣味漫画';
  sec.appendChild(img);
  return sec;
}

// ---------- 语文：生字 / 背诵 黑板 ----------
let CHINESE_DATA = null;
let RECITE_DATA = null;

function tianziSVG(text, opts) {
  opts = opts || {};
  const size = opts.size || 150;
  const fs = opts.fs || 84;
  const fill = opts.fill || '#222';
  return '<svg class="tianzi" viewBox="0 0 100 100" width="' + size + '" height="' + size + '" role="img" aria-label="' + text + '">'
    + '<rect x="3" y="3" width="94" height="94" fill="#fffdf6" stroke="#e23b3b" stroke-width="4" rx="3"/>'
    + '<line x1="50" y1="5" x2="50" y2="95" stroke="#e89494" stroke-width="1.4" stroke-dasharray="4 4"/>'
    + '<line x1="5" y1="50" x2="95" y2="50" stroke="#e89494" stroke-width="1.4" stroke-dasharray="4 4"/>'
    + '<text x="50" y="50" text-anchor="middle" dominant-baseline="central" font-size="' + fs + '" fill="' + fill + '" '
    + 'font-family="\'KaiTi\',\'STKaiti\',\'楷体\',serif">' + text + '</text></svg>';
}

function findChar(id) {
  if (!CHINESE_DATA) return null;
  return CHINESE_DATA.chars.find(c => c.id === Number(id)) || null;
}
function findPoem(id) {
  if (!RECITE_DATA) return null;
  return RECITE_DATA.find(p => p.id === Number(id)) || null;
}

function showChar(btn) {
  document.querySelectorAll('.char-chip.selected').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const c = findChar(btn.dataset.id);
  if (!c) return;
  setBoardTag('📖 生字');
  document.getElementById('board-title').textContent = c.char;
  const wrap = document.getElementById('board-sections');
  wrap.innerHTML = '';

  // 左侧：田字格（偏旁红色）+ 拼音 + 说文解字/词源
  const main = makeDiv('cb-main', []);
  const tzWrap = makeDiv('cb-tianzi-wrap', []);
  const tz = document.createElement('div');
  tz.className = 'cb-tianzi tianzi-anim';
  tz.innerHTML = tianziSVG(c.char, { size: 130, fs: 80, fill: '#e74c3c' });
  const py = document.createElement('div');
  py.className = 'cb-pinyin';
  py.textContent = c.pinyin || '';
  tzWrap.appendChild(tz);
  tzWrap.appendChild(py);
  main.appendChild(tzWrap);

  let ety = '';
  if (c.radical) {
    ety += '<b>偏旁「' + escapeHTML(c.radical) + '」：</b>' + escapeHTML(c.radical_role || '') + '。';
    if (c.radical_note) ety += escapeHTML(c.radical_note) + ' ';
  }
  if (c.phonetic) ety += '<b>表音：</b>' + escapeHTML(c.phonetic) + ' ';
  if (c.etymology) ety += '<b>《词源》：</b>' + escapeHTML(c.etymology) + ' ';
  if (c.meaning) ety += '<b>本义：</b>' + escapeHTML(c.meaning) + ' ';
  if (c.origin) ety += '<b>出处：</b>' + escapeHTML(c.origin) + ' ';
  if (c.allusion) ety += '<b>典故：</b>' + escapeHTML(c.allusion) + ' ';
  if (!ety) ety = '—';
  const et = makeDiv('cb-etymology', []);
  et.innerHTML = ety;
  main.appendChild(et);

  // 右侧：组词 / 成语 / 句子（各一行不换行）
  const side = makeDiv('cb-side', []);
  let words = (c.words || []).map(w => w.word).join('、');
  side.appendChild(makeSideLine('组词：', words || '—', false));
  let idioms = '';
  if (c.idioms && c.idioms.length) idioms = c.idioms.join('、');
  side.appendChild(makeSideLine('成语：', idioms || '—', false));
  side.appendChild(makeSideLine('句子：', c.sentence || '—', true));

  wrap.appendChild(makeDiv('char-board', [main, side]));
  scrollBoard();
}

function makeSideLine(label, text, multiline) {
  const d = document.createElement('div');
  d.className = 'cb-side-line' + (multiline ? ' cb-multiline' : '');
  d.innerHTML = '<span class="cb-side-label">' + label + '</span>' + escapeHTML(text);
  return d;
}

function showPoem(btn) {
  document.querySelectorAll('.poem-chip.selected').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const p = findPoem(btn.dataset.id);
  if (!p) return;
  setBoardTag('📜 背诵');
  document.getElementById('board-title').textContent = '《' + p.title + '》';
  const wrap = document.getElementById('board-sections');
  wrap.innerHTML = '';
  wrap.appendChild(makeDiv('bd-section', [secTitle('作者'), secBodyHTML(escapeHTML(p.dynasty) + ' · ' + escapeHTML(p.author))]));
  const poem = makeDiv('bd-section sec-poem', []);
  poem.appendChild(secTitle('全文'));
  const body = document.createElement('div');
  body.className = 'bd-sec-body bd-poem';
  body.innerHTML = (p.lines || []).map(l => escapeHTML(l)).join('<br>');
  poem.appendChild(body);
  wrap.appendChild(poem);
  if (p.poet_story) wrap.appendChild(makeDiv('bd-section', [secTitle('📖 诗人小传'), secBodyHTML(escapeHTML(p.poet_story))]));
  if (p.origin) wrap.appendChild(makeDiv('bd-section', [secTitle('📜 诗作来历（史料出处）'), secBodyHTML(escapeHTML(p.origin))]));
  if (p.note) wrap.appendChild(makeDiv('bd-section', [secTitle('💡 简析 / 背诵提示'), secBodyHTML(escapeHTML(p.note))]));
  scrollBoard();
}

// ---- 语文黑板小工具 ----
function setBoardTag(txt) {
  document.getElementById('board-empty').hidden = true;
  document.getElementById('board-content').hidden = false;
  document.getElementById('board-tag').textContent = txt;
}
function secTitle(t) {
  const h = document.createElement('div');
  h.className = 'bd-sec-title';
  h.textContent = t;
  return h;
}
function secBodyHTML(html) {
  const b = document.createElement('div');
  b.className = 'bd-sec-body';
  b.innerHTML = html;
  return b;
}
function makeDiv(cls, children) {
  const d = document.createElement('div');
  d.className = cls;
  children.forEach(c => d.appendChild(c));
  return d;
}
function scrollBoard() {
  const board = document.getElementById('board');
  if (board) board.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 漫画：首格展示课本原文，其余按行拆成多格动画分镜
function makeComic(comicText, textbook) {
  const sec = document.createElement('div');
  sec.className = 'bd-section sec-comic';
  const h = document.createElement('div');
  h.className = 'bd-sec-title';
  h.textContent = '🎨 趣味漫画';
  sec.appendChild(h);
  const strip = document.createElement('div');
  strip.className = 'comic-strip';
  if (textbook) {
    const tbPanel = document.createElement('div');
    tbPanel.className = 'comic-panel comic-textbook';
    const bookIcon = document.createElement('div');
    bookIcon.className = 'comic-book';
    bookIcon.textContent = '📖';
    const tbText = document.createElement('div');
    tbText.className = 'comic-textbook-body';
    tbText.textContent = textbook;
    tbPanel.appendChild(bookIcon);
    tbPanel.appendChild(tbText);
    strip.appendChild(tbPanel);
  }
  const lines = (comicText || '').split('\n').filter(s => s.trim().length);
  const charRe = /^([\p{Extended_Pictographic}\uFE0F\u200D]+)\s*(.*)$/u;
  lines.forEach((line, i) => {
    const m = line.match(charRe);
    const char = m ? m[1] : '📣';
    const speech = m ? m[2] : line;
    const panel = document.createElement('div');
    panel.className = 'comic-panel';
    panel.style.animationDelay = ((textbook ? 1 : 0) + i * 0.28) + 's';
    const charEl = document.createElement('div');
    charEl.className = 'comic-char';
    charEl.textContent = char;
    const bubble = document.createElement('div');
    bubble.className = 'comic-bubble';
    bubble.textContent = speech;
    panel.appendChild(charEl);
    panel.appendChild(bubble);
    strip.appendChild(panel);
  });
  sec.appendChild(strip);
  return sec;
}

// ---------- 解题思路 ----------
let STRATEGY_DATA = null;
function showStrategy(btn) {
  document.querySelectorAll('.strategy-card.selected').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  if (!STRATEGY_DATA) return;
  const s = STRATEGY_DATA.find(x => x.id === btn.dataset.id);
  if (!s) return;
  document.getElementById('board-empty').hidden = true;
  const content = document.getElementById('board-content');
  content.hidden = false;
  document.getElementById('board-tag').textContent = '🧠 解题策略';
  document.getElementById('board-title').textContent = s.name;
  const wrap = document.getElementById('board-sections');
  wrap.innerHTML = '';
  if (s.summary) wrap.appendChild(makeSection('💡 一句话', s.summary, 'sec-summary'));
  if (s.when) wrap.appendChild(makeSection('🎯 什么时候用', s.when, 'sec-when'));
  if (Array.isArray(s.steps) && s.steps.length) {
    const sec = document.createElement('div');
    sec.className = 'bd-section sec-steps';
    sec.appendChild(secTitle('🪜 解题步骤'));
    const ol = document.createElement('ol');
    ol.className = 'bd-steps';
    s.steps.forEach(st => {
      const li = document.createElement('li');
      li.textContent = st;
      ol.appendChild(li);
    });
    sec.appendChild(ol);
    wrap.appendChild(sec);
  }
  if (s.example_q) {
    const sec = document.createElement('div');
    sec.className = 'bd-section sec-example';
    sec.appendChild(secTitle('📝 例题'));
    const q = document.createElement('div');
    q.className = 'bd-sec-body bd-quote';
    q.textContent = s.example_q;
    sec.appendChild(q);
    if (s.example_a) {
      const a = document.createElement('div');
      a.className = 'bd-sec-body bd-answer';
      a.innerHTML = '<b>解答：</b>' + escapeHTML(s.example_a);
      sec.appendChild(a);
    }
    wrap.appendChild(sec);
  }
  scrollBoard();
}

// ---------- 数据加载与骨架生成 ----------
function loadRoadmap() {
  const params = new URLSearchParams(location.search);
  let subject = params.get('subject') || 'math';
  fetch('data/roadmap.json').then(r => r.json()).then(data => {
    ROADMAP_DATA = data;
    if (!data[subject]) subject = Object.keys(data)[0] || 'math';
    document.body.dataset.page = 'roadmap-' + subject;
    mountSidebar();
    const root = document.getElementById('roadmap-root');
    if (!root) return;
    root.dataset.subject = subject;
    root.innerHTML = '';
    const grades = ['1', '2', '3', '4', '5', '6'];
    const gradeName = { '1': '一年级', '2': '二年级', '3': '三年级', '4': '四年级', '5': '五年级', '6': '六年级' };
    (data[subject].lines || []).forEach(line => {
      const sec = document.createElement('section');
      sec.className = 'line-card';
      sec.dataset.line = line.code;
      const head = document.createElement('header');
      head.className = 'line-head';
      const code = document.createElement('span');
      code.className = 'line-code';
      code.textContent = line.code;
      const name = document.createElement('span');
      name.className = 'line-name';
      name.textContent = line.name;
      head.appendChild(code);
      head.appendChild(name);
      sec.appendChild(head);
      const gg = document.createElement('div');
      gg.className = 'grade-grid';
      grades.forEach(g => {
        const nodes = (line.grades && line.grades[g]) || [];
        const col = document.createElement('div');
        col.className = 'grade-col';
        const gl = document.createElement('div');
        gl.className = 'grade-label';
        gl.textContent = gradeName[g];
        col.appendChild(gl);
        if (nodes.length) {
          const nl = document.createElement('div');
          nl.className = 'node-list';
          nodes.forEach((node, idx) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'node-chip';
            b.dataset.line = line.code;
            b.dataset.grade = g;
            b.dataset.idx = idx;
            b.onclick = () => showNode(b);
            const dot = document.createElement('span');
            dot.className = 'node-dot';
            b.appendChild(dot);
            b.appendChild(document.createTextNode(node.name));
            nl.appendChild(b);
          });
          col.appendChild(nl);
        } else {
          const ne = document.createElement('div');
          ne.className = 'node-empty';
          ne.textContent = '—';
          col.appendChild(ne);
        }
        gg.appendChild(col);
      });
      sec.appendChild(gg);
      root.appendChild(sec);
    });
  }).catch(e => {
    const root = document.getElementById('roadmap-root');
    if (root) root.innerHTML = '<div class="empty">导图数据加载失败，请确认通过 GitHub Pages 访问（而非本地直接打开文件）。</div>';
  });
}

function loadChinese() {
  fetch('data/chinese.json').then(r => r.json()).then(data => {
    CHINESE_DATA = data;
    const grades = data.grades || ['1', '2', '3', '4', '5', '6'];
    const radicals = data.radicals || [];
    const chars = data.chars || [];
    const grid = {};
    radicals.forEach(r => { grid[r.name] = {}; grades.forEach(g => grid[r.name][g] = []); });
    chars.forEach(c => {
      const rad = c.radical, g = String(c.grade);
      if (grid[rad] && grid[rad][g]) grid[rad][g].push(c);
    });
    const root = document.getElementById('radical-table');
    if (!root) return;
    root.innerHTML = '';
    radicals.forEach(rad => {
      const row = document.createElement('div');
      row.className = 'radical-row';
      const name = document.createElement('div');
      name.className = 'radical-name';
      name.title = rad.note || '';
      name.textContent = rad.name;
      row.appendChild(name);
      const cells = document.createElement('div');
      cells.className = 'grade-cells';
      grades.forEach(g => {
        const cell = document.createElement('div');
        cell.className = 'grade-cell';
        const list = grid[rad.name][g];
        if (list.length) {
          list.forEach(c => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'char-chip';
            b.dataset.id = c.id;
            b.onclick = () => showChar(b);
            b.textContent = c.char;
            cell.appendChild(b);
          });
        } else {
          const e = document.createElement('span');
          e.className = 'cell-empty';
          e.textContent = '·';
          cell.appendChild(e);
        }
        cells.appendChild(cell);
      });
      row.appendChild(cells);
      root.appendChild(row);
    });
  }).catch(e => {
    const root = document.getElementById('radical-table');
    if (root) root.innerHTML = '<div class="empty">生字数据加载失败。</div>';
  });
}

function loadRecite() {
  fetch('data/recite.json').then(r => r.json()).then(data => {
    RECITE_DATA = data.items || [];
    const grades = data.grades || ['1', '2', '3', '4', '5', '6'];
    const cats = data.categories || [];
    const grid = {};
    cats.forEach(cat => { grid[cat] = {}; grades.forEach(g => grid[cat][g] = []); });
    RECITE_DATA.forEach(p => {
      const cat = p.category, g = String(p.grade);
      if (grid[cat] && grid[cat][g]) grid[cat][g].push(p);
    });
    const root = document.getElementById('recite-grid');
    if (!root) return;
    root.innerHTML = '';
    const corner = document.createElement('div');
    corner.className = 'recite-corner';
    root.appendChild(corner);
    grades.forEach(g => {
      const h = document.createElement('div');
      h.className = 'recite-col-head';
      h.textContent = g + '年级';
      root.appendChild(h);
    });
    cats.forEach(cat => {
      const rh = document.createElement('div');
      rh.className = 'recite-row-head';
      rh.textContent = cat;
      root.appendChild(rh);
      grades.forEach(g => {
        const cell = document.createElement('div');
        cell.className = 'recite-cell';
        const list = grid[cat][g];
        if (list.length) {
          list.forEach(p => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'poem-chip';
            b.dataset.id = p.id;
            b.onclick = () => showPoem(b);
            const t = document.createElement('span');
            t.className = 'poem-title';
            t.textContent = p.title;
            const m = document.createElement('span');
            m.className = 'poem-meta';
            m.textContent = (p.dynasty || '') + (p.author ? '·' + p.author : '');
            b.appendChild(t);
            b.appendChild(m);
            cell.appendChild(b);
          });
        } else {
          const e = document.createElement('span');
          e.className = 'cell-empty';
          e.textContent = '·';
          cell.appendChild(e);
        }
        root.appendChild(cell);
      });
    });
  }).catch(e => {
    const root = document.getElementById('recite-grid');
    if (root) root.innerHTML = '<div class="empty">背诵数据加载失败。</div>';
  });
}

function loadStrategy() {
  fetch('data/strategy.json').then(r => r.json()).then(data => {
    STRATEGY_DATA = data.strategies || [];
    const root = document.getElementById('strategy-grid');
    if (!root) return;
    root.innerHTML = '';
    STRATEGY_DATA.forEach(s => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'strategy-card';
      b.dataset.id = s.id;
      b.onclick = () => showStrategy(b);
      const n = document.createElement('span');
      n.className = 'strategy-name';
      n.textContent = s.name;
      const sm = document.createElement('span');
      sm.className = 'strategy-sum';
      sm.textContent = s.summary || '';
      b.appendChild(n);
      b.appendChild(sm);
      root.appendChild(b);
    });
  }).catch(e => {
    const root = document.getElementById('strategy-grid');
    if (root) root.innerHTML = '<div class="empty">解题思路数据加载失败。</div>';
  });
}

// ---------- 初始化 ----------
document.addEventListener('DOMContentLoaded', function () {
  mountSidebar();
  const page = document.body.dataset.page || '';
  if (page === 'roadmap') loadRoadmap();
  else if (page === 'chinese') loadChinese();
  else if (page === 'recite') loadRecite();
  else if (page === 'strategy') loadStrategy();
});
