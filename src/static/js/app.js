// 新增/编辑错题时，根据所选科目联动显示对应的知识线选项
function updateKnowledgeLines() {
  const subject = document.getElementById('subject');
  const kl = document.getElementById('knowledge_line');
  if (!subject || !kl) return;
  const subj = subject.value;
  let firstVisible = -1;
  Array.from(kl.options).forEach((opt, i) => {
    const isMatch = !opt.dataset.subject || opt.dataset.subject === subj;
    opt.hidden = !isMatch;
    if (isMatch && firstVisible === -1) firstVisible = i;
  });
  // 若当前选中项被隐藏，则切到第一个可见项
  if (kl.selectedOptions[0] && kl.selectedOptions[0].hidden && firstVisible !== -1) {
    kl.selectedIndex = firstVisible;
  }
}

document.addEventListener('DOMContentLoaded', updateKnowledgeLines);

// 知识点导图：点击节点 → 在顶部黑板展示，节点高亮
let ROADMAP_DATA = null;
try {
  const el = document.getElementById('roadmap-data');
  if (el) ROADMAP_DATA = JSON.parse(el.textContent);
} catch (e) { ROADMAP_DATA = null; }

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

  // 让黑板回到视野顶部（尤其在小屏）
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

  if (node.example) {
    wrap.appendChild(makeSection('📝 例题', node.example, 'sec-example'));
  }
  if (node.textbook || node.textbook_svg) {
    wrap.appendChild(makeTextbookSection(node));
  }
  if (node.comic || node.comic_svg) {
    if (node.comic_svg) {
      wrap.appendChild(makeImageSection('🎨 趣味漫画', node.comic_svg, 'sec-comic'));
    } else {
      wrap.appendChild(makeComic(node.comic, node.textbook));
    }
  }

  const link = document.getElementById('board-errlink');
  link.href = '/errors?subject=' + encodeURIComponent(subject) + '&knowledge_line=' + encodeURIComponent(lineCode);
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

// 课本原文：教科书风SVG讲解图 + 人教版文字摘录
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
    img.src = '/static/' + node.textbook_svg;
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

// 趣味漫画：生活化矢量场景图
function makeImageSection(title, svgPath, cls) {
  const sec = document.createElement('div');
  sec.className = 'bd-section ' + (cls || '');
  const h = document.createElement('div');
  h.className = 'bd-sec-title';
  h.textContent = title;
  sec.appendChild(h);

  const img = document.createElement('img');
  img.className = 'bd-comic-img';
  img.src = '/static/' + svgPath;
  img.alt = '趣味漫画';
  sec.appendChild(img);
  return sec;
}

// ===================== 语文：生字 / 背诵 黑板 =====================
let CHINESE_DATA = null;
try {
  const el = document.getElementById('chinese-data');
  if (el) CHINESE_DATA = JSON.parse(el.textContent);
} catch (e) { CHINESE_DATA = null; }

let RECITE_DATA = null;
try {
  const el = document.getElementById('recite-data');
  if (el) RECITE_DATA = JSON.parse(el.textContent);
} catch (e) { RECITE_DATA = null; }

// 田字格 SVG：红格、虚线十字、黑字（楷体）。text 可为字或笔画名。
function tianziSVG(text, opts) {
  opts = opts || {};
  const size = opts.size || 150;
  const fs = opts.fs || 84;
  return '<svg class="tianzi" viewBox="0 0 100 100" width="' + size + '" height="' + size + '" role="img" aria-label="' + text + '">'
    + '<rect x="3" y="3" width="94" height="94" fill="#fffdf6" stroke="#e23b3b" stroke-width="4" rx="3"/>'
    + '<line x1="50" y1="5" x2="50" y2="95" stroke="#e89494" stroke-width="1.4" stroke-dasharray="4 4"/>'
    + '<line x1="5" y1="50" x2="95" y2="50" stroke="#e89494" stroke-width="1.4" stroke-dasharray="4 4"/>'
    + '<text x="50" y="50" text-anchor="middle" dominant-baseline="central" font-size="' + fs + '" fill="#222" '
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
  document.getElementById('board-title').textContent = c.char + '　' + c.pinyin;
  const wrap = document.getElementById('board-sections');
  wrap.innerHTML = '';

  // 左列：拼音 / 笔画动态图 / 偏旁部首（表音表义 + 《词源》）
  const left = makeDiv('bd-col bd-col-left', []);

  // 拼音
  left.appendChild(makeDiv('bd-section', [
    secTitle('🔤 拼音'),
    secBodyHTML('<span class="bd-pinyin">' + c.pinyin + '</span> <span class="bd-sub">（' + c.type + ' · 共 ' + c.strokes + ' 画）</span>')
  ]));

  // 笔画动态图：田字格大字 + 逐笔书写动画（不显示横撇竖文字）
  const tg = makeDiv('bd-section sec-tianzi', []);
  tg.appendChild(secTitle('✍️ 笔画（共 ' + c.strokes + ' 笔）'));
  const tgBox = document.createElement('div');
  tgBox.className = 'tianzi-box tianzi-anim';
  tgBox.innerHTML = tianziSVG(c.char, { size: 150, fs: 90 });
  // 逐笔书写动画：按笔数生成依次点亮的笔序小点
  const steps = document.createElement('div');
  steps.className = 'stroke-dots';
  (c.stroke_order || []).forEach((s, i) => {
    const dot = document.createElement('span');
    dot.className = 'stroke-dot';
    dot.style.animationDelay = (i * 0.5) + 's';
    dot.textContent = (i + 1);
    steps.appendChild(dot);
  });
  tgBox.appendChild(steps);
  tg.appendChild(tgBox);
  left.appendChild(tg);

  // 偏旁部首：表音 / 表义 + 《词源》解释
  let bu = '<b>' + c.radical + '</b> —— ' + (c.radical_role || '');
  if (c.radical_note) bu += '<br>' + c.radical_note;
  if (c.phonetic) bu += '<br><span class="bd-sub">表音：' + c.phonetic + '</span>';
  if (c.etymology) bu += '<br><span class="bd-sub">《词源》：' + c.etymology + '</span>';
  left.appendChild(makeDiv('bd-section', [secTitle('🔎 偏旁部首'), secBodyHTML(bu)]));

  // 右列：组词 / 成语 / 造句（按用户要求的换行排版）
  const right = makeDiv('bd-col bd-col-right', []);

  // 组词：XXX；
  let words = (c.words || []).map(w => w.word).join('；');
  if (words) words += '；';
  right.appendChild(makeDiv('bd-section', [secTitle('🧩 组词'), secBodyHTML(words || '—')]));

  // 成语：XXX；
  let idioms = '';
  if (c.idioms && c.idioms.length) {
    idioms = c.idioms.join('；') + '；';
  }
  right.appendChild(makeDiv('bd-section', [secTitle('🌟 成语'), secBodyHTML(idioms || '—')]));

  // 造句：XXXXXX
  right.appendChild(makeDiv('bd-section', [secTitle('✏️ 造句'), secBodyHTML(c.sentence || '—')]));

  wrap.appendChild(makeDiv('bd-split', [left, right]));
  scrollBoard();
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

  wrap.appendChild(makeDiv('bd-section', [secTitle('作者'), secBodyHTML(p.dynasty + ' · ' + p.author)]));

  const poem = makeDiv('bd-section sec-poem', []);
  poem.appendChild(secTitle('全文'));
  const body = document.createElement('div');
  body.className = 'bd-sec-body bd-poem';
  body.innerHTML = (p.lines || []).map(l => escapeHTML(l)).join('<br>');
  poem.appendChild(body);
  wrap.appendChild(poem);

  if (p.poet_story) {
    wrap.appendChild(makeDiv('bd-section', [secTitle('📖 诗人小传'), secBodyHTML(p.poet_story)]));
  }
  if (p.origin) {
    wrap.appendChild(makeDiv('bd-section', [secTitle('📜 诗作来历（史料出处）'), secBodyHTML(p.origin)]));
  }
  if (p.note) {
    wrap.appendChild(makeDiv('bd-section', [secTitle('💡 简析 / 背诵提示'), secBodyHTML(p.note)]));
  }

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
function escapeHTML(s) {
  return String(s).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}
function scrollBoard() {
  const board = document.getElementById('board');
  if (board) board.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===================== 原有：漫画 =====================
// 漫画：首格展示课本原文，其余按行拆成多格动画分镜（角色 emoji + 对话气泡依次弹入）
function makeComic(comicText, textbook) {
  sec.className = 'bd-section sec-comic';
  const h = document.createElement('div');
  h.className = 'bd-sec-title';
  h.textContent = '🎨 趣味漫画';
  sec.appendChild(h);

  const strip = document.createElement('div');
  strip.className = 'comic-strip';

  // 首格：课本原文（让孩子对应教材，有熟悉感）
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

// ===================== 数学：解题思路 黑板 =====================
let STRATEGY_DATA = null;
try {
  const el = document.getElementById('strategy-data');
  if (el) STRATEGY_DATA = JSON.parse(el.textContent);
} catch (e) { STRATEGY_DATA = null; }

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
    const h = document.createElement('div');
    h.className = 'bd-sec-title';
    h.textContent = '🪜 解题步骤';
    sec.appendChild(h);
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
