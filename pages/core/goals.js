/* ============================================================
   目标 v2 · 数据层
   目标域唯一写者：页面不得直接写 localStorage，统一走 LightGoals。
   v2 = { v:2, items:[ Goal ] }
   v1 = lifeflow-goal-items 只读保留，首次读取时迁移。
   ============================================================ */
(function (root) {
  'use strict';

  var V1_KEY = 'lifeflow-goal-items';
  var V2_KEY = 'lifeflow-goals-v2';

  var MODULES = [
    { id: 'sleep', label: '睡眠' },
    { id: 'diet', label: '饮食' },
    { id: 'water', label: '饮水' },
    { id: 'training', label: '训练' },
    { id: 'study', label: '学习' },
    { id: 'mood', label: '情绪' },
    { id: 'expense', label: '记账' },
    { id: 'posture', label: '休息' },
    { id: 'medication', label: '吃药' },
    { id: 'wellness', label: '功法' },
    { id: 'habit', label: '习惯' },
    { id: 'other', label: '其他' }
  ];
  var MODULE_BY_ID = {};
  var MODULE_BY_LABEL = {};
  MODULES.forEach(function (m) {
    MODULE_BY_ID[m.id] = m;
    MODULE_BY_LABEL[m.label] = m.id;
  });
  MODULE_BY_LABEL['运动'] = 'training';
  MODULE_BY_LABEL['训练'] = 'training';
  MODULE_BY_LABEL['阅读'] = 'habit';

  var METRIC_LABELS = { hours: '睡眠时长', minutes: '分钟', sessions: '次数', volume: '容量', protein_g: '蛋白克数', score: '评分', spend: '金额', count: '次数', doses: '次' };
  var MODULE_DEFAULTS = {
    sleep: { metric: 'hours', unit: 'h', target: 7, hint: '睡眠时长' },
    diet: { metric: 'protein_g', unit: 'g', target: 120, hint: '蛋白质克数' },
    water: { metric: 'volume', unit: 'L', target: 1.5, hint: '饮水量' },
    training: { metric: 'sessions', unit: '次', target: 3, cadence: 'weekly', hint: '训练次数' },
    study: { metric: 'minutes', unit: 'min', target: 60, hint: '专注分钟' },
    mood: { metric: 'score', unit: '分', target: 3, hint: '情绪评分' },
    expense: { metric: 'spend', unit: '元', target: 100, hint: '记账金额' },
    posture: { metric: 'minutes', unit: 'min', target: 30, hint: '休息分钟' },
    medication: { metric: 'doses', unit: '次', target: 1, hint: '服药次数' },
    wellness: { metric: 'minutes', unit: 'min', target: 20, hint: '功法分钟' },
    habit: { metric: 'count', unit: '次', target: 1, hint: '习惯次数' },
    other: { metric: 'count', unit: '次', target: 1, hint: '自定义指标' }
  };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
  function read(key) {
    try { return JSON.parse(root.localStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function write(key, value) {
    try { root.localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    return value;
  }

  function moduleForLabel(label) {
    return MODULE_BY_LABEL[String(label || '').trim()] || 'other';
  }
  function moduleLabel(id) {
    return (MODULE_BY_ID[id] && MODULE_BY_ID[id].label) || '其他';
  }
  function defaultsFor(id) {
    return MODULE_DEFAULTS[id] || MODULE_DEFAULTS.other;
  }
  function metricLabel(metric) {
    return METRIC_LABELS[metric] || metric;
  }

  function normalizeRequirement(raw) {
    if (!raw || !raw.moduleId) return null;
    var target = Number(raw.target);
    if (!isFinite(target) || target <= 0) return null;
    var cadence = ['daily', 'weekly', 'custom'].indexOf(raw.cadence) >= 0 ? raw.cadence : 'daily';
    var direction = ['at_least', 'at_most', 'range'].indexOf(raw.direction) >= 0 ? raw.direction : 'at_least';
    var role = raw.role === 'optional' ? 'optional' : 'required';
    return {
      id: raw.id || uid('req'),
      moduleId: String(raw.moduleId),
      metric: String(raw.metric || 'count'),
      target: target,
      unit: String(raw.unit || ''),
      cadence: cadence,
      direction: direction,
      role: role,
      merge: raw.merge || 'max',
      stageId: raw.stageId || null,
      source: raw.source || 'goal',
      days: Array.isArray(raw.days) ? raw.days.slice(0, 7) : null
    };
  }

  function legacyOf(raw) {
    raw = raw || {};
    return {
      measure: raw.legacyMeasure || raw.measure || null,
      progress: raw.legacyProgress != null ? raw.legacyProgress : (raw.progress != null ? raw.progress : null),
      days: raw.days != null ? raw.days : null,
      today: raw.today != null ? raw.today : null,
      step: raw.step || null,
      stages: Array.isArray(raw.stages) ? raw.stages : [],
      tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
      strategy: raw.strategy || null,
      summary: raw.summary || '',
      nextStep: raw.nextStep || ''
    };
  }

  function normalizeGoal(raw) {
    raw = raw || {};
    var now = dateKey(new Date());
    var legacy = legacyOf(raw);
    var out = {};
    Object.keys(raw).forEach(function (k) { out[k] = raw[k]; });
    out.id = raw.id || uid('goal');
    out.title = String(raw.title || '未命名目标').slice(0, 40);
    out.vision = String(raw.vision || '');
    out.status = ['active', 'paused', 'done', 'archived'].indexOf(raw.status) >= 0 ? raw.status : 'active';
    out.priority = Math.min(3, Math.max(1, Number(raw.priority) || 3));
    out.primary = !!raw.primary;
    out.activeFrom = raw.activeFrom || now;
    out.activeTo = raw.activeTo || null;
    out.phase = String(raw.phase || '');
    out.domain = String(raw.domain || '自定义');
    out.requirements = (Array.isArray(raw.requirements) ? raw.requirements : []).map(normalizeRequirement).filter(Boolean);
    out.strategies = Array.isArray(raw.strategies) ? raw.strategies : [];
    out.milestones = Array.isArray(raw.milestones) ? raw.milestones : [];
    out.legacyMeasure = legacy.measure;
    out.legacyProgress = legacy.progress;
    out.legacy = legacy;
    out.updatedAt = raw.updatedAt || new Date().toISOString();
    return out;
  }

  function migrate() {
    var v2 = read(V2_KEY);
    if (v2 && Array.isArray(v2.items)) {
      return { migrated: 0, existed: true, raw: v2 };
    }
    var v1 = read(V1_KEY);
    var items = v1 && Array.isArray(v1.items) ? v1.items : (Array.isArray(v1) ? v1 : []);
    if (!items.length) {
      return { migrated: 0, existed: false, raw: null };
    }
    var out = {
      v: 2,
      source: 'v1',
      migratedAt: new Date().toISOString(),
      items: items.map(function (g) {
        var goal = normalizeGoal(g);
        goal.legacyMeasure = g.measure || null;
        goal.legacyProgress = g.progress != null ? g.progress : null;
        goal.migratedFrom = 'v1';
        return goal;
      })
    };
    write(V2_KEY, out);
    return { migrated: out.items.length, existed: false, raw: out };
  }

  function ensure() {
    var v2 = read(V2_KEY);
    if (v2 && Array.isArray(v2.items)) return v2;
    var m = migrate();
    return m.raw || { v: 2, items: [] };
  }

  function list() {
    return ensure().items.slice();
  }

  function get(id) {
    return list().filter(function (g) { return String(g.id) === String(id); })[0] || null;
  }

  function save(goal) {
    var db = ensure();
    var clean = normalizeGoal(goal);
    var idx = -1;
    db.items.forEach(function (g, i) { if (String(g.id) === String(clean.id)) idx = i; });
    if (idx >= 0) db.items[idx] = clean; else db.items.push(clean);
    db.v = 2;
    write(V2_KEY, db);
    return clean;
  }

  function remove(id) {
    var db = ensure();
    var before = db.items.length;
    db.items = db.items.filter(function (g) { return String(g.id) !== String(id); });
    if (db.items.length !== before) write(V2_KEY, db);
    return db.items.length !== before;
  }

  function active(date) {
    var key = date || dateKey(new Date());
    return list().filter(function (g) {
      if (g.status !== 'active') return false;
      if (g.activeFrom && g.activeFrom > key) return false;
      if (g.activeTo && g.activeTo < key) return false;
      return true;
    }).sort(function (a, b) {
      if (a.primary !== b.primary) return a.primary ? -1 : 1;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return String(a.activeTo || '9999').localeCompare(String(b.activeTo || '9999'));
    });
  }

  function requirementsFor(goal, date) {
    if (!goal) return [];
    var key = date || dateKey(new Date());
    return (goal.requirements || []).filter(function (r) {
      if (!r.stageId) return true;
      var stage = (goal.strategies || []).filter(function (s) { return String(s.id) === String(r.stageId); })[0];
      if (!stage) return true;
      if (stage.start && stage.start > key) return false;
      if (stage.end && stage.end < key) return false;
      return true;
    });
  }

  function mergeRequirements(goals, date) {
    var groups = {};
    (goals || active(date)).forEach(function (g) {
      requirementsFor(g, date).forEach(function (r) {
        var key = r.moduleId + '|' + r.metric + '|' + r.unit;
        if (!groups[key]) groups[key] = [];
        groups[key].push({
          requirement: r,
          goalId: g.id,
          goalTitle: g.title,
          goalPriority: g.priority,
          goalPrimary: !!g.primary
        });
      });
    });

    var items = [];
    Object.keys(groups).forEach(function (key) {
      var rows = groups[key];
      var directions = {};
      rows.forEach(function (x) { directions[x.requirement.direction] = true; });
      var dirs = Object.keys(directions);
      var conflict = dirs.length > 1;
      var targets = rows.map(function (x) { return x.requirement.target; });
      var target = null;
      if (!conflict) {
        target = dirs[0] === 'at_most' ? Math.min.apply(null, targets) : Math.max.apply(null, targets);
      }
      var min = Math.min.apply(null, targets);
      var max = Math.max.apply(null, targets);
      var wide = !conflict && min > 0 && max / min > 1.2;
      items.push({
        key: key,
        moduleId: rows[0].requirement.moduleId,
        metric: rows[0].requirement.metric,
        unit: rows[0].requirement.unit,
        target: target,
        direction: conflict ? 'conflict' : dirs[0],
        goalIds: rows.map(function (x) { return x.goalId; }).filter(function (v, i, a) { return a.indexOf(v) === i; }),
        goals: rows.map(function (x) { return x.goalTitle; }).filter(function (v, i, a) { return a.indexOf(v) === i; }),
        conflict: conflict,
        reason: conflict ? '同一模块方向相反，不能自动合并' : '',
        wide: wide,
        warning: wide ? '目标差异超过 20%，请确认' : '',
        rows: rows
      });
    });
    return items.sort(function (a, b) { return a.key.localeCompare(b.key); });
  }

  function addRequirement(goalId, req) {
    var g = get(goalId);
    if (!g) return null;
    var clean = normalizeRequirement(req);
    if (!clean) return null;
    g.requirements = (g.requirements || []).concat([clean]);
    return save(g);
  }

  function removeRequirement(goalId, reqId) {
    var g = get(goalId);
    if (!g) return false;
    var before = (g.requirements || []).length;
    g.requirements = (g.requirements || []).filter(function (r) { return String(r.id) !== String(reqId); });
    if (g.requirements.length === before) return false;
    save(g);
    return true;
  }

  function exportAll() {
    return { v: 2, exportedAt: new Date().toISOString(), goals: list(), legacyV1: read(V1_KEY) };
  }

  root.LightGoals = {
    V1_KEY: V1_KEY,
    V2_KEY: V2_KEY,
    MODULES: MODULES,
    dateKey: dateKey,
    moduleForLabel: moduleForLabel,
    moduleLabel: moduleLabel,
    defaultsFor: defaultsFor, metricLabel: metricLabel,
    normalizeGoal: normalizeGoal,
    normalizeRequirement: normalizeRequirement,
    migrate: migrate,
    list: list,
    get: get,
    save: save,
    remove: remove,
    active: active,
    requirementsFor: requirementsFor,
    mergeRequirements: mergeRequirements,
    addRequirement: addRequirement,
    removeRequirement: removeRequirement,
    exportAll: exportAll
  };
})(typeof window !== 'undefined' ? window : globalThis);
