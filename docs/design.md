# 小学自学系统 — 设计文档

> 版本：tier 1（骨架 + MVP）
> 形态：本地网页版，家长在自己电脑上使用，**不联网、不上云**。

---

## 1. 项目概述

一套面向小学自学（数学 1–6 年级 + 语文）的本地学习管理系统（LMS），帮助家长规划、跟踪两个孩子的学习进度。

- **核心约束**：纯本地运行，数据保存在本机 `data/` 目录，无后端云服务、无网络请求。
- **多孩子**：支持两个孩子（child_a / child_b），维度评估数据互不可见、不对比。
- **技术取舍**：MVP 用 Flask 轻量后端 + 本地 JSON 文件，后续可平滑替换为 SQLite（数据模型不变）。

---

## 2. 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 后端 | Python + Flask | 提供页面渲染与 JSON 读写接口 |
| 前端 | 原生 HTML / CSS / JS | 无框架，降低本地部署门槛 |
| 存储 | 本地 JSON 文件 | `data/*.json`，后续可换 SQLite |
| 运行 | `python src/app.py` | 本机访问 `http://127.0.0.1:5000` |

---

## 3. 目录结构

```
primary_lms/
├── docs/
│   └── design.md              # 本文档
├── src/
│   ├── app.py                 # Flask 入口 / 路由 / 存储逻辑
│   ├── templates/             # Jinja2 模板
│   │   ├── base.html
│   │   ├── index.html         # 首页仪表盘
│   │   ├── errors.html        # 错题列表（筛选 + 增删入口）
│   │   ├── error_form.html    # 新增/编辑表单（含知识线联动）
│   │   └── review.html        # 今日复习清单
│   └── static/
│       ├── css/style.css
│       └── js/app.js
├── data/                      # 本地存储（不提交 git）
│   ├── errors.json            # 错题集
│   ├── characters.json        # 生字词（未来 tier）
│   ├── recitations.json       # 背诵记录（未来 tier）
│   └── roadmap.json           # 知识路线图静态结构（未来 tier）
└── requirements.txt           # Flask 依赖
```

---

## 4. 核心模块与数据模型

### 4.1 知识路线图（roadmap）

数学 1–6 年级按 8 条**知识线**贯通：

| 编号 | 知识线 | 编号 | 知识线 |
|---|---|---|---|
| A | 整数计算 | E | 量单位 |
| B | 小数 | F | 代数 |
| C | 分数百分数比 | G | 统计 |
| D | 几何 | H | 数学广角 |

语文按 5 条线：

| 编号 | 知识线 | 编号 | 知识线 |
|---|---|---|---|
| P1 | 识字写字 | P4 | 习作 |
| P2 | 背诵 | P5 | 口语交际 |
| P3 | 阅读 | | |

路线图本身为静态结构数据，存放于 `data/roadmap.json`（后续 tier 填充）。

### 4.2 错题集（errors）—— MVP 已实现

数学 / 语文通用。字段：

```json
{
  "id": "uuid",
  "child_id": "child_a | child_b",
  "subject": "math | chinese",
  "grade": 1,
  "unit": "一上-第三单元",
  "knowledge_line": "A",
  "knowledge_node": "20以内进位加法",
  "error_type": "概念混淆 | 计算失误 | 审题不清 | 记忆错漏 | 方法不当 | 粗心大意 | 其他",
  "source": "课本P12 / 试卷 / 练习册",
  "proficiency": 0,          // 熟练度 ★0–5（家长手动评级）
  "stage": 0,                // 复习阶段索引 0–4，对应 1/3/7/15/30 天
  "next_review_date": "2026-07-20",
  "consecutive_wrong": 0,    // 连续错误次数
  "stubborn": false,         // 顽固题标记（连续错 2 次）
  "review_history": [{"date": "2026-07-19", "correct": true}],
  "created_at": "2026-07-19T10:00:00",
  "updated_at": "2026-07-19T10:00:00"
}
```

**复习调度规则（1 / 3 / 7 / 15 / 30 天遗忘曲线）**

设间隔数组 `INTERVALS = [1, 3, 7, 15, 30]`，每题持有一个 `stage` 索引：

- **答对**：`stage = min(stage+1, 4)`，`next_review_date = today + INTERVALS[stage]`，`consecutive_wrong` 清零。
- **答错**：`stage = 0`，`consecutive_wrong += 1`，`next_review_date = today + 1`（明天再练）。
- **连续错 2 次**：`stubborn = true`，提示「回课本重学」。

### 4.3 生字词系统（characters）—— 未来 tier

语文版错题集变体，每日听写 10 个（5 新 + 5 复习），错词按 1/3/7/15/30 天复现。

```json
{
  "id": "uuid",
  "child_id": "child_a",
  "word": "睥睨",
  "pinyin": "pì nì",
  "grade": 5,
  "unit": "...",
  "stage": 0,
  "next_review_date": "2026-07-20",
  "consecutive_wrong": 0,
  "dictation_history": []
}
```

### 4.4 背诵模块（recitations）—— 未来 tier

每篇三态：未背 / 会背 / 会默。**默写才算达标**；会默后第 7、30 天抽默。

```json
{
  "id": "uuid",
  "child_id": "child_a",
  "title": "静夜思",
  "grade": 2,
  "status": "unrecited | recited | written",
  "recited_at": null,
  "written_at": null,
  "follow_up_dates": ["2026-07-26", "2026-08-19"]
}
```

### 4.5 维度评估（assessment）—— 未来 tier

数学 M1–M5 + 语文 C1–C5（共 10 维），仅**月考驱动**，仅家长后台可见。

```json
{
  "id": "uuid",
  "child_id": "child_a",
  "subject": "math",
  "month": "2026-07",
  "dimensions": {"M1": 85, "M2": 72, "M3": 90, "M4": 68, "M5": 80},
  "smoothed": {"M1": 83, "M2": 70, "M3": 88, "M4": 67, "M5": 79}
}
```

- **显示分平滑**：`显示分 = 上月 × 40% + 本月 × 60%`。
- `<70` 分维度标记重点。
- 两孩子维度数据互不可见、不对比。

---

## 5. 页面路由

| 路径 | 方法 | 页面 | MVP | 说明 |
|---|---|---|---|---|
| `/` | GET | 首页仪表盘 | ✅ | 今日待复习 / 顽固题 / 错题总数 |
| `/errors` | GET | 错题列表 | ✅ | 按孩子 / 科目筛选 |
| `/errors/new` | GET/POST | 新增错题 | ✅ | 写入 errors.json |
| `/errors/<id>/edit` | GET/POST | 编辑错题 | ✅ | |
| `/errors/<id>/delete` | POST | 删除错题 | ✅ | |
| `/review` | GET | 今日复习清单 | ✅ | 自动汇总 `next_review_date ≤ today` |
| `/review/<id>` | POST | 标记复习结果 | ✅ | correct/wrong → 触发调度 |

后续 tier 路由（规划）：`/characters`、`/recitations`、`/assessment`、`/roadmap`。

---

## 6. MVP 范围（tier 1）

已实现：
1. 错题表 **增 / 删 / 改 / 查**（CRUD）。
2. **今日复习清单自动生成**（按 `next_review_date` 过滤）。
3. 复习结果反馈（对 / 错 → 触发 1/3/7/15/30 天调度，连续错 2 次标顽固）。

未实现（后续 tier）：生字词听写、背诵三态、维度评估、路线图浏览。

---

## 7. 启动方式

```bash
cd primary_lms
pip install -r requirements.txt
python src/app.py
# 浏览器打开 http://127.0.0.1:5000
```

> 全程本地运行，无需联网。
