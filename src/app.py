# -*- coding: utf-8 -*-
"""
小学自学系统 —— Flask 后端（MVP：tier 1）
仅实现：错题集 CRUD + 今日复习清单自动生成 + 复习调度
数据保存在本地 data/errors.json，不联网、不上云。
"""
import os
import json
import uuid
from datetime import datetime, date, timedelta

from flask import (
    Flask, render_template, request, redirect,
    url_for, flash, abort,
)

app = Flask(__name__, template_folder='templates', static_folder='static')
app.secret_key = 'local-only-not-for-production'

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, '..', 'data')
ERRORS_FILE = os.path.join(DATA_DIR, 'errors.json')
ROADMAP_FILE = os.path.join(DATA_DIR, 'roadmap.json')
CHINESE_FILE = os.path.join(DATA_DIR, 'chinese.json')
RECITE_FILE = os.path.join(DATA_DIR, 'recite.json')
STRATEGY_FILE = os.path.join(DATA_DIR, 'strategy.json')

# 复习间隔（天）：1 / 3 / 7 / 15 / 30 遗忘曲线
REVIEW_INTERVALS = [1, 3, 7, 15, 30]

# 知识线常量（科目 -> [(编号, 名称), ...]）
KNOWLEDGE_LINES = {
    'math': [
        ('A', '整数计算'), ('B', '小数'), ('C', '分数百分数比'),
        ('D', '几何'), ('E', '量单位'), ('F', '代数'),
        ('G', '统计'), ('H', '数学广角'),
    ],
    'chinese': [
        ('P1', '识字写字'), ('P2', '背诵'), ('P3', '阅读'),
        ('P4', '习作'), ('P5', '口语交际'),
    ],
}

ERROR_TYPES = [
    '概念混淆', '计算失误', '审题不清',
    '记忆错漏', '方法不当', '粗心大意', '其他',
]

CHILDREN = [('child_a', '孩子A'), ('child_b', '孩子B')]


# ---------- 存储 ----------
def load_errors():
    if not os.path.exists(ERRORS_FILE):
        return []
    try:
        with open(ERRORS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, ValueError):
        return []


def save_errors(errors):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(ERRORS_FILE, 'w', encoding='utf-8') as f:
        json.dump(errors, f, ensure_ascii=False, indent=2)


def load_roadmap():
    if not os.path.exists(ROADMAP_FILE):
        return {}
    try:
        with open(ROADMAP_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, ValueError):
        return {}


def load_chinese():
    if not os.path.exists(CHINESE_FILE):
        return {}
    try:
        with open(CHINESE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, ValueError):
        return {}


def load_recite():
    if not os.path.exists(RECITE_FILE):
        return {'categories': [], 'grades': [], 'items': []}
    try:
        with open(RECITE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, ValueError):
        return {'categories': [], 'grades': [], 'items': []}


def load_strategy():
    if not os.path.exists(STRATEGY_FILE):
        return {'strategies': []}
    try:
        with open(STRATEGY_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, ValueError):
        return {'strategies': []}


def today_str():
    return date.today().isoformat()


def get_today_review():
    today = today_str()
    return [e for e in load_errors() if e.get('next_review_date', '') <= today]


def schedule_review(error, is_correct):
    """按 1/3/7/15/30 天遗忘曲线推进复习计划。"""
    today = date.today()
    history = error.setdefault('review_history', [])
    history.append({'date': today.isoformat(), 'correct': is_correct})

    if is_correct:
        error['stage'] = min(error.get('stage', 0) + 1, len(REVIEW_INTERVALS) - 1)
        error['consecutive_wrong'] = 0
    else:
        error['stage'] = 0
        error['consecutive_wrong'] = error.get('consecutive_wrong', 0) + 1
        if error['consecutive_wrong'] >= 2:
            error['stubborn'] = True

    next_days = REVIEW_INTERVALS[error['stage']]
    error['next_review_date'] = (today + timedelta(days=next_days)).isoformat()
    error['updated_at'] = datetime.now().isoformat()


def child_name(cid):
    return dict(CHILDREN).get(cid, cid)


# ---------- 路由 ----------
@app.context_processor
def inject_globals():
    return dict(child_name=child_name, children=CHILDREN)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/brother')
def brother():
    return render_template('brother.html')


@app.route('/sister')
def sister():
    return render_template('sister.html')


@app.route('/errors')
def errors_list():
    errors = load_errors()
    subject = request.args.get('subject', '')
    child_id = request.args.get('child_id', '')
    knowledge_line = request.args.get('knowledge_line', '')
    filtered = [
        e for e in errors
        if (not subject or e['subject'] == subject)
        and (not child_id or e['child_id'] == child_id)
        and (not knowledge_line or e.get('knowledge_line') == knowledge_line)
    ]
    # 顽固题、临近复习靠前排序
    filtered.sort(key=lambda e: (not e.get('stubborn'), e.get('next_review_date', '')))
    return render_template(
        'errors.html',
        errors=filtered,
        subject=subject,
        child_id=child_id,
        knowledge_line=knowledge_line,
        knowledge_lines=KNOWLEDGE_LINES,
        error_types=ERROR_TYPES,
    )


@app.route('/errors/new', methods=['GET', 'POST'])
def errors_new():
    if request.method == 'POST':
        errors = load_errors()
        new = {
            'id': str(uuid.uuid4()),
            'child_id': request.form['child_id'],
            'subject': request.form['subject'],
            'grade': int(request.form['grade']),
            'unit': request.form.get('unit', ''),
            'knowledge_line': request.form['knowledge_line'],
            'knowledge_node': request.form.get('knowledge_node', ''),
            'error_type': request.form['error_type'],
            'source': request.form.get('source', ''),
            'proficiency': int(request.form.get('proficiency', 0)),
            'stage': 0,
            'next_review_date': (date.today() + timedelta(days=REVIEW_INTERVALS[0])).isoformat(),
            'consecutive_wrong': 0,
            'stubborn': False,
            'review_history': [],
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat(),
        }
        errors.append(new)
        save_errors(errors)
        flash('错题已添加')
        return redirect(url_for('errors_list'))
    return render_template(
        'error_form.html',
        error=None,
        knowledge_lines=KNOWLEDGE_LINES,
        error_types=ERROR_TYPES,
    )


@app.route('/errors/<eid>/edit', methods=['GET', 'POST'])
def errors_edit(eid):
    errors = load_errors()
    target = next((e for e in errors if e['id'] == eid), None)
    if not target:
        abort(404)
    if request.method == 'POST':
        target['child_id'] = request.form['child_id']
        target['subject'] = request.form['subject']
        target['grade'] = int(request.form['grade'])
        target['unit'] = request.form.get('unit', '')
        target['knowledge_line'] = request.form['knowledge_line']
        target['knowledge_node'] = request.form.get('knowledge_node', '')
        target['error_type'] = request.form['error_type']
        target['source'] = request.form.get('source', '')
        target['proficiency'] = int(request.form.get('proficiency', 0))
        target['updated_at'] = datetime.now().isoformat()
        save_errors(errors)
        flash('错题已更新')
        return redirect(url_for('errors_list'))
    return render_template(
        'error_form.html',
        error=target,
        knowledge_lines=KNOWLEDGE_LINES,
        error_types=ERROR_TYPES,
    )


@app.route('/errors/<eid>/delete', methods=['POST'])
def errors_delete(eid):
    errors = load_errors()
    new_errors = [e for e in errors if e['id'] != eid]
    if len(new_errors) != len(errors):
        save_errors(new_errors)
        flash('错题已删除')
    return redirect(url_for('errors_list'))


@app.route('/review')
def review_list():
    items = get_today_review()
    items.sort(key=lambda e: (not e.get('stubborn'), e.get('next_review_date', '')))
    return render_template('review.html', items=items, today=today_str())


@app.route('/review/<eid>', methods=['POST'])
def review_action(eid):
    errors = load_errors()
    target = next((e for e in errors if e['id'] == eid), None)
    if not target:
        abort(404)
    is_correct = request.form.get('result') == 'correct'
    schedule_review(target, is_correct)
    save_errors(errors)
    flash('已记录，复习计划已更新' if is_correct else '已记录，明日再战')
    return redirect(url_for('review_list'))


@app.route('/roadmap')
def roadmap():
    subject = request.args.get('subject', 'math')
    roadmap_data = load_roadmap()
    if subject not in roadmap_data:
        subject = next(iter(roadmap_data), 'math')
    # 统计每个知识线在错题集中已记录的节点数，用于在导图上标记热度
    errors = load_errors()
    line_counts = {}
    for e in errors:
        code = e.get('knowledge_line', '')
        line_counts[code] = line_counts.get(code, 0) + 1
    return render_template(
        'roadmap.html',
        subject=subject,
        lines=roadmap_data.get(subject, {}).get('lines', []),
        line_counts=line_counts,
        roadmap_data=roadmap_data,
        knowledge_lines=KNOWLEDGE_LINES,
    )


@app.route('/chinese')
def chinese():
    data = load_chinese()
    grades = data.get('grades', ['1', '2', '3', '4', '5', '6'])
    # 按 部首(纵轴) × 年级(横轴) 预分组，便于网格渲染
    grid = {}
    for r in data.get('radicals', []):
        grid[r['name']] = {g: [] for g in grades}
    for c in data.get('chars', []):
        rad = c.get('radical', '')
        g = c.get('grade', '')
        if rad in grid and g in grid[rad]:
            grid[rad][g].append(c)

    return render_template(
        'chinese.html',
        data=data,
        radicals=data.get('radicals', []),
        grades=grades,
        grid=grid,
    )


@app.route('/recite')
def recite():
    recite = load_recite()
    grades = recite.get('grades', ['1', '2', '3', '4', '5', '6'])
    cats = recite.get('categories', [])
    recite_grid = {cat: {g: [] for g in grades} for cat in cats}
    for it in recite.get('items', []):
        cat = it.get('category')
        g = str(it.get('grade', ''))
        if cat in recite_grid and g in recite_grid[cat]:
            recite_grid[cat][g].append(it)

    return render_template(
        'recite.html',
        poems=recite.get('items', []),
        recite_grid=recite_grid,
        recite_cats=cats,
        recite_grades=grades,
    )


@app.route('/mathcalc')
def mathcalc():
    return render_template('mathcalc.html')


@app.route('/strategy')
def strategy():
    data = load_strategy()
    return render_template(
        'strategy.html',
        strategies=data.get('strategies', []),
    )


if __name__ == '__main__':
    os.makedirs(DATA_DIR, exist_ok=True)
    # 首次运行初始化空数据文件
    if not os.path.exists(ERRORS_FILE):
        save_errors([])
    app.run(debug=True, port=5000)
