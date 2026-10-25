/* ============================================================
   今日 3+3 · 规划器
   3 个保底（LightFloors）+ 3 个推进（LightGoals requirements）
   共享模块按 module|metric|unit 合并；不重复消耗今日名额。
   存储：lifeflow-today-v1 = {v:1, days:{date:{done:{key:true}}}}
   ============================================================ */
(function (root) {
  'use strict';
  var KEY = 'lifeflow-today-v1';
  var WEEK_KEY = 'lifeflow-weekly-v1';

  var FLOOR_SPECS = {
    sleep: { moduleId: 'sleep', metric: 'hours', unit: 'h', target: 7 },
    protein: { moduleId: 'diet', metric: 'protein_g', unit: 'g', target: 80 },
    water: { moduleId: 'water', metric: 'volume', unit: 'L', target: 1.5 },
    walk: { moduleId: 'training', metric: 'minutes', unit: 'min', target: 20 },
    meds: { moduleId: 'medication', metric: 'doses', unit: '次', target: 1 },
    mood: { moduleId: 'mood', metric: 'check', unit: '次', target: 1 },
    connect: { moduleId: 'mood', metric: 'connect', unit: '次', target: 1 },
    solitude: { moduleId: 'mood', metric: 'solitude', unit: 'min', target: 10 },
    focus: { moduleId: 'study', metric: 'minutes', unit: 'min', target: 45 },
    output: { moduleId: 'output', metric: 'count', unit: '次', target: 1 },
    ledger: { moduleId: 'expense', metric: 'entries', unit: '笔', target: 1 },
    budget: { moduleId: 'expense', metric: 'budget_check', unit: '次', target: 1 },
    goal: { moduleId: 'goals', metric: 'action', unit: '次', target: 1 }
  };
  var STORE_MOD = {
    sleep: '睡眠', water: '饮水', training: '运动', study: '学习',
    output: '输出', mood: '情绪记录', expense: '记账', diet: '饮食'
  };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function keyOf(moduleId, metric, unit) { return moduleId + '|' + metric + '|' + unit; }
  function read() {
    try { return JSON.parse(root.localStorage.getItem(KEY) || 'null') || { v: 1, days: {} }; } catch (e) { return { v: 1, days: {} }; }
  }
  function write(d) { try { root.localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} return d; }
  function doneMap(date) { return (read().days[date || dateKey()] || {}).done || {}; }
  function toggle(key, date) {
    var d = read(), k = date || dateKey();
    d.days[k] = d.days[k] || { done: {} };
    d.days[k].done = d.days[k].done || {};
    if (d.days[k].done[key]) delete d.days[k].done[key]; else d.days[k].done[key] = true;
    write(d);
    return d.days[k].done;
  }
  function isDone(key, date) { return !!doneMap(date)[key]; }

  function weekday(date) {
    var d = new Date(String(date || dateKey()) + 'T12:00:00');
    return (d.getDay() + 6) % 7; // Mon=0
  }
  function weeklySlots(target) {
    var n = Math.max(1, Math.min(7, Math.round(Number(target) || 1)));
    if (n === 1) return [6];
    var out = [];
    for (var i = 0; i < n; i++) out.push(Math.round(i * 6 / (n - 1)));
    return out.filter(function (v, i, a) { return a.indexOf(v) === i; });
  }
  function weeklyDue(target, date) {
    return weeklySlots(target).indexOf(weekday(date)) >= 0;
  }
  function dateAdd(date, n) {
    var d = new Date(String(date || dateKey()) + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return dateKey(d);
  }
  function weekStart(date) {
    var d = new Date(String(date || dateKey()) + 'T12:00:00');
    var off = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - off);
    return dateKey(d);
  }
  function weekDates(date) {
    var start = weekStart(date), out = [];
    for (var i = 0; i < 7; i++) out.push(dateAdd(start, i));
    return out;
  }
  function moduleAmount(moduleId, metric, date) {
    if (!root.LightStore) return 0;
    var mod = STORE_MOD[moduleId];
    if (!mod) return 0;
    var rows = (root.LightStore.readDay(date).records || []).filter(function (r) { return r.mod === mod; });
    if (!rows.length) return 0;
    function sum(field) {
      return rows.reduce(function (n, r) { return n + (Number(field ? r[field] : r.value) || 0); }, 0);
    }
    if (moduleId === 'sleep' && metric === 'hours') {
      return Math.max.apply(null, rows.map(function (r) { return Number(r.value) || 0; }));
    }
    if (moduleId === 'water' && metric === 'volume') return sum() / 1000;
    if (moduleId === 'training' && metric === 'sessions') return rows.length;
    if (moduleId === 'training' && metric === 'minutes') return sum();
    if (moduleId === 'study' && metric === 'minutes') return sum();
    if (moduleId === 'output' && (metric === 'words' || metric === 'count')) return sum();
    if (moduleId === 'mood' && metric === 'score') {
      var last = rows[rows.length - 1];
      return Number((last.meta || {}).score) || Number(last.value) || 0;
    }
    if (moduleId === 'expense' && metric === 'entries') return rows.length;
    if (moduleId === 'diet' && metric === 'meals') return rows.length;
    return sum();
  }
  function manualDone(key, date) { return !!doneMap(date)[key]; }
  function amountOn(key, date) {
    var parts = String(key).split('|');
    var moduleId = parts[0], metric = parts[1];
    return Math.max(moduleAmount(moduleId, metric, date), manualDone(key, date) ? 1 : 0);
  }
  function weekDone(key, date) {
    return weekDates(date).reduce(function (n, d) { return n + amountOn(key, d); }, 0);
  }
  function floorDoneOn(key, date) {
    if (!root.LightFloors) return false;
    var chosen = (root.LightFloors.summary(date).chosen || []);
    return chosen.some(function (f) {
      var spec = floorSpec(f.id);
      return !!(f.done && spec && keyOf(spec.moduleId, spec.metric, spec.unit) === key);
    });
  }
  function doneOn(key, date, target) {
    if (manualDone(key, date) || floorDoneOn(key, date)) return true;
    var parts = String(key).split('|');
    var value = moduleAmount(parts[0], parts[1], date);
    return target != null ? value >= Number(target) : value > 0;
  }
  function daysBetween(a, b) {
    var d1 = new Date(a + 'T12:00:00'), d2 = new Date(b + 'T12:00:00');
    return Math.round((d2 - d1) / 86400000);
  }
  function weekRead() {
    try { return JSON.parse(root.localStorage.getItem(WEEK_KEY) || 'null') || { v: 1, decisions: {} }; } catch (e) { return { v: 1, decisions: {} }; }
  }
  function weekWrite(d) { try { root.localStorage.setItem(WEEK_KEY, JSON.stringify(d)); } catch (e) {} return d; }
  function weekId(key, date) { return weekStart(date) + '|' + key; }
  function weeklyDecision(key, date) {
    return (weekRead().decisions || {})[weekId(key, date)] || null;
  }
  function weeklyTargetFor(key, base, date) {
    var d = weeklyDecision(key, date);
    if (!d) return base;
    if (d.action === 'carry') return base + (Number(d.amount) || 0);
    if (d.action === 'reduce') return 1;
    return base;
  }
  function weeklyItems(date) {
    if (!root.LightGoals) return [];
    return root.LightGoals.mergeRequirements(root.LightGoals.active(date), date).filter(function (item) {
      return !item.conflict && (item.rows || []).some(function (r) { return r.requirement.cadence === 'weekly'; });
    }).map(function (item) {
      return { key: item.key, moduleId: item.moduleId, target: Number(item.target) || 1, unit: item.unit, goals: item.goals };
    });
  }
  function weeklyReview(date) {
    date = date || dateKey();
    var prev = dateAdd(weekStart(date), -7);
    var pending = [], applied = [];
    weeklyItems(prev).forEach(function (it) {
      var prevDecision = weeklyDecision(it.key, prev);
      var prevTarget = it.target;
      if (prevDecision && prevDecision.action === 'carry') prevTarget += Number(prevDecision.amount) || 0;
      else if (prevDecision && prevDecision.action === 'reduce') prevTarget = 1;
      var done = weekDone(it.key, prev);
      var gap = Math.max(0, prevTarget - done);
      if (!gap) return;
      var row = {
        key: it.key, moduleId: it.moduleId, label: moduleText(it.moduleId),
        target: prevTarget, done: done, gap: gap, unit: it.unit, goals: it.goals, week: prev
      };
      var now = weeklyDecision(it.key, date);
      if (now) applied.push(Object.assign({}, row, { action: now.action, amount: now.amount || 0 }));
      else pending.push(row);
    });
    return { pending: pending, applied: applied, prev: prev };
  }
  function applyWeeklyAction(key, date, action) {
    date = date || dateKey();
    var review = weeklyReview(date);
    var row = review.pending.concat(review.applied).filter(function (x) { return x.key === key; })[0];
    if (!row) return null;
    var amount = action === 'carry' ? Math.min(2, row.gap) : 0;
    var d = weekRead();
    d.decisions[weekId(key, date)] = { action: action, amount: amount, at: new Date().toISOString() };
    weekWrite(d);
    return { action: action, amount: amount, row: row };
  }
  function goalStats(goal, date) {
    date = date || dateKey();
    if (!goal || !goal.requirements || !goal.requirements.length) return null;
    var floor = dateAdd(date, -27);
    var from = goal.activeFrom && goal.activeFrom > floor ? goal.activeFrom : floor;
    var days = Math.max(1, daysBetween(from, date) + 1);
    var expected = 0, actual = 0;
    goal.requirements.forEach(function (r) {
      var key = keyOf(r.moduleId, r.metric, r.unit);
      if (r.cadence === 'weekly') {
        var weeks = Math.max(1, Math.ceil(days / 7));
        expected += weeks;
        var cursor = weekStart(from);
        for (var i = 0; i < weeks; i++) {
          if (weekDone(key, cursor) >= (Number(r.target) || 1)) actual++;
          cursor = dateAdd(cursor, 7);
        }
      } else {
        expected += days;
        for (var j = 0; j < days; j++) {
          if (doneOn(key, dateAdd(from, j), r.target)) actual++;
        }
      }
    });
    if (!expected) return null;
    return {
      percent: Math.round(actual / expected * 100),
      actual: actual,
      expected: expected,
      days: days,
      from: from,
      label: days >= 28 ? '近 4 周' : '近 ' + days + ' 天'
    };
  }

  function floorSpec(id) { return FLOOR_SPECS[id] || null; }
  function weekRange(date) {
    var start = weekStart(date), end = dateAdd(start, 6);
    return { start: start, end: end, label: start.slice(5).replace('-', '/') + '–' + end.slice(5).replace('-', '/') };
  }
  function weekSummary(date) {
    date = date || dateKey();
    var range = weekRange(date);
    var goals = root.LightGoals ? root.LightGoals.active(date).map(function (g) {
      return { id: g.id, title: g.title, stats: goalStats(g, date) };
    }) : [];
    var quotas = weeklyItems(date).map(function (it) {
      var target = weeklyTargetFor(it.key, it.target, date);
      var done = weekDone(it.key, date);
      var d = weeklyDecision(it.key, date);
      return {
        key: it.key, moduleId: it.moduleId, label: moduleText(it.moduleId),
        target: target, baseTarget: it.target, done: done, unit: it.unit,
        action: d ? d.action : null, amount: d ? (Number(d.amount) || 0) : 0,
        complete: done >= target
      };
    });
    var floors = { done: 0, total: 0 };
    var mods = { trainingSessions: 0, trainingMinutes: 0, waterL: 0, studyMinutes: 0, outputWords: 0, sleepDays: [] };
    weekDates(date).forEach(function (d) {
      var day = root.LightFloors ? root.LightFloors.day(d) : null;
      if (day) {
        floors.total += (day.chosen || []).length;
        floors.done += (day.done || []).filter(function (id) { return (day.chosen || []).indexOf(id) >= 0; }).length;
      }
      mods.trainingSessions += moduleAmount('training', 'sessions', d);
      mods.trainingMinutes += moduleAmount('training', 'minutes', d);
      mods.waterL += moduleAmount('water', 'volume', d);
      mods.studyMinutes += moduleAmount('study', 'minutes', d);
      mods.outputWords += moduleAmount('output', 'words', d);
      var sh = moduleAmount('sleep', 'hours', d);
      if (sh) mods.sleepDays.push(sh);
    });
    mods.sleepAvg = mods.sleepDays.length ? Math.round(mods.sleepDays.reduce(function (a, b) { return a + b; }, 0) / mods.sleepDays.length * 10) / 10 : 0;
    mods.waterL = Math.round(mods.waterL * 10) / 10;
    return { date: date, range: range, goals: goals, quotas: quotas, floors: floors, modules: mods };
  }
  function floorLabel(id) {
    var f = (root.LightFloors && root.LightFloors.FLOORS || []).filter(function (x) { return x.id === id; })[0];
    return f ? f.label : id;
  }
  function unitText(unit) { return unit ? ' ' + unit : ''; }
  function metricText(metric) {
    return root.LightGoals && root.LightGoals.metricLabel ? root.LightGoals.metricLabel(metric) : metric;
  }
  function moduleText(id) {
    return root.LightGoals && root.LightGoals.moduleLabel ? root.LightGoals.moduleLabel(id) : id;
  }

  function plan(date) {
    date = date || dateKey();
    if (!root.LightGoals || !root.LightFloors) {
      return { date: date, color: 'unknown', floors: [], progress: [], paused: [], conflicts: [], weekly: [], limit: 0 };
    }
    var fl = root.LightFloors.summary(date);
    var goals = root.LightGoals.active(date);
    var merged = root.LightGoals.mergeRequirements(goals, date);
    var done = doneMap(date);
    var floorByKey = {};
    var floors = (fl.chosen || []).map(function (f) {
      var spec = floorSpec(f.id);
      if (!spec) return null;
      var key = keyOf(spec.moduleId, spec.metric, spec.unit);
      var item = {
        key: key,
        floorId: f.id,
        slot: 'floor',
        moduleId: spec.moduleId,
        metric: spec.metric,
        unit: spec.unit,
        target: spec.target,
        label: f.label,
        goals: [],
        goalIds: [],
        done: !!f.done || doneOn(key, date, spec.target),
        meta: '保底'
      };
      floorByKey[item.key] = item;
      return item;
    }).filter(Boolean);

    var progress = [];
    var conflicts = [];
    var weekly = [];

    merged.forEach(function (item) {
      if (item.conflict) { conflicts.push(item); return; }
      var rows = item.rows || [];
      var required = rows.filter(function (r) { return r.requirement.role !== 'optional'; });
      if (!required.length) return;
      var cadence = required.some(function (r) { return r.requirement.cadence === 'weekly'; }) ? 'weekly' : 'daily';
      var weeklyDone = cadence === 'weekly' ? weekDone(item.key, date) : 0;
      var weeklyTarget = cadence === 'weekly' ? weeklyTargetFor(item.key, Number(item.target) || 1, date) : null;
      var weeklyBase = cadence === 'weekly' ? (Number(item.target) || 1) : null;
      if (cadence === 'weekly' && weeklyDone >= weeklyTarget) {
        weekly.push({ key: item.key, moduleId: item.moduleId, target: weeklyTarget, baseTarget: weeklyBase, done: weeklyDone, unit: item.unit, goals: item.goals, complete: true });
        return;
      }
      if (cadence === 'weekly' && !weeklyDue(weeklyTarget, date)) {
        weekly.push({ key: item.key, moduleId: item.moduleId, target: weeklyTarget, baseTarget: weeklyBase, done: weeklyDone, unit: item.unit, goals: item.goals });
        return;
      }
      var base = floorByKey[item.key];
      if (base) {
        base.target = Math.max(base.target, Number(item.target) || 0);
        base.goals = item.goals;
        base.goalIds = item.goalIds;
        return;
      }
      var target = cadence === 'weekly' ? 1 : Number(item.target) || 1;
      progress.push({
        key: item.key,
        slot: 'progress',
        moduleId: item.moduleId,
        metric: item.metric,
        unit: item.unit,
        target: target,
        weeklyTarget: weeklyTarget,
        weeklyDone: weeklyDone,
        label: moduleText(item.moduleId) + ' ' + target + unitText(item.unit),
        meta: cadence === 'weekly' ? '本周 ' + weeklyDone + '/' + weeklyTarget : '每天',
        goals: item.goals,
        goalIds: item.goalIds,
        done: doneOn(item.key, date, target),
        priority: Math.min.apply(null, required.map(function (r) { return r.goalPriority || 3; }))
      });
    });

    progress.sort(function (a, b) { return (a.priority || 3) - (b.priority || 3); });
    var color = fl.color === 'red' ? 'red' : fl.color === 'yellow' ? 'yellow' : (fl.color === 'green' ? 'green' : 'unknown');
    var limit = color === 'red' ? 0 : color === 'yellow' ? 1 : 3;
    var active = progress.slice(0, limit);
    var paused = progress.slice(limit);

    return {
      date: date,
      color: color,
      limit: limit,
      floors: floors,
      progress: active,
      paused: paused,
      conflicts: conflicts,
      weekly: weekly,
      goals: goals.length,
      done: active.filter(function (x) { return x.done; }).length
    };
  }

  root.LightToday = {
    KEY: KEY,
    WEEK_KEY: WEEK_KEY,
    FLOOR_SPECS: FLOOR_SPECS,
    dateKey: dateKey,
    doneMap: doneMap,
    toggle: toggle,
    isDone: isDone,
    weeklyDue: weeklyDue,
    weeklySlots: weeklySlots,
    weekStart: weekStart,
    weekDone: weekDone,
    moduleAmount: moduleAmount,
    amountOn: amountOn,
    doneOn: doneOn,
    weeklyDecision: weeklyDecision,
    weeklyTargetFor: weeklyTargetFor,
    weeklyReview: weeklyReview,
    applyWeeklyAction: applyWeeklyAction,
    weekRange: weekRange,
    weekSummary: weekSummary,
    goalStats: goalStats,
    plan: plan
  };
})(typeof window !== 'undefined' ? window : globalThis);
