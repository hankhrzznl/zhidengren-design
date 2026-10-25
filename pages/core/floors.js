/* ============================================================
   今日保底 · floors.js
   不是 20 个模块打分，而是：四域保底 + 五流约束 + 每天只保 3 个底。
   存储：localStorage['lifeflow-floors-v1'] = {v:1, days:{date:{...}}}
   ============================================================ */
(function (root) {
  'use strict';
  var KEY = 'lifeflow-floors-v1';

  var FLOORS = [
    { id: 'sleep', domain: '体', label: '睡够 7h', short: '睡眠' },
    { id: 'protein', domain: '体', label: '1 顿有蛋白', short: '蛋白' },
    { id: 'water', domain: '体', label: '喝水 1.5L', short: '喝水' },
    { id: 'walk', domain: '体', label: '活动 20min', short: '活动' },
    { id: 'meds', domain: '体', label: '按医嘱吃药', short: '吃药' },
    { id: 'mood', domain: '情', label: '情绪签到', short: '情绪' },
    { id: 'connect', domain: '情', label: '联系一个人', short: '连接' },
    { id: 'solitude', domain: '情', label: '独处 10min', short: '独处' },
    { id: 'focus', domain: '智', label: '1 个 45min 专注', short: '专注' },
    { id: 'output', domain: '智', label: '周输出 1 次', short: '输出' },
    { id: 'ledger', domain: '志', label: '记 1 笔', short: '记账' },
    { id: 'budget', domain: '志', label: '周预算检视', short: '预算' },
    { id: 'goal', domain: '志', label: '推进 1 个目标', short: '目标' }
  ];
  var TIGHT = [
    { id: 'time', label: '时间' },
    { id: 'energy', label: '精力' },
    { id: 'attention', label: '注意力' },
    { id: 'emotion', label: '情绪' },
    { id: 'money', label: '钱' }
  ];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function db() {
    var d = null;
    try { d = JSON.parse(root.localStorage.getItem(KEY) || 'null'); } catch (e) {}
    if (!d || !d.days) d = { v: 1, days: {} };
    return d;
  }
  function save(d) {
    try { root.localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
    return d;
  }
  function floor(id) {
    return FLOORS.filter(function (f) { return f.id === id; })[0] || null;
  }
  function blankDay() {
    return { sleep: null, soreness: null, mood: null, stress: null, tightest: '', chosen: [], done: [] };
  }
  function day(date) {
    var d = db(), key = date || dateKey();
    return d.days[key] || blankDay();
  }
  function colorOf(dayObj) {
    var scores = [dayObj.sleep, dayObj.soreness, dayObj.mood, dayObj.stress].filter(function (v) { return v != null; });
    if (!scores.length) return 'unknown';
    var lows = scores.filter(function (v) { return v <= 2; }).length;
    if (dayObj.sleep != null && dayObj.sleep <= 2) return 'red';
    if (lows >= 2) return 'red';
    if ((dayObj.sleep != null && dayObj.sleep <= 3) || lows >= 1) return 'yellow';
    return 'green';
  }
  function defaultChosen(dayObj) {
    var t = dayObj.tightest;
    if (t === 'attention') return ['focus', 'sleep', 'walk'];
    if (t === 'emotion') return ['mood', 'connect', 'sleep'];
    if (t === 'money') return ['ledger', 'sleep', 'protein'];
    if (t === 'time') return ['sleep', 'protein', 'walk'];
    if (t === 'energy') return ['sleep', 'protein', 'walk'];
    if (colorOf(dayObj) === 'green') return ['sleep', 'protein', 'walk'];
    return ['sleep', 'protein', 'walk'];
  }
  function saveDay(patch, date) {
    var d = db(), key = date || dateKey();
    var cur = d.days[key] || blankDay();
    Object.keys(patch || {}).forEach(function (k) { cur[k] = patch[k]; });
    cur.chosen = (cur.chosen || []).filter(function (id) { return !!floor(id); }).slice(0, 3);
    cur.done = (cur.done || []).filter(function (id) { return cur.chosen.indexOf(id) >= 0; });
    d.days[key] = cur;
    save(d);
    return cur;
  }
  function choose(ids, date) {
    ids = (ids || []).filter(function (id) { return !!floor(id); });
    if (!ids.length) ids = defaultChosen(day(date));
    return saveDay({ chosen: ids.slice(0, 3), done: [] }, date);
  }
  function toggleDone(id, date) {
    var d = db(), key = date || dateKey();
    var cur = d.days[key] || blankDay();
    if (cur.chosen.indexOf(id) < 0) return cur;
    var i = cur.done.indexOf(id);
    if (i >= 0) cur.done.splice(i, 1); else cur.done.push(id);
    d.days[key] = cur;
    save(d);
    return cur;
  }
  function summary(date) {
    var d = day(date);
    var color = colorOf(d);
    var chosen = d.chosen.length ? d.chosen : defaultChosen(d);
    return {
      date: date || dateKey(),
      color: color,
      tightest: d.tightest,
      chosen: chosen.map(function (id) { var f = floor(id); return f ? Object.assign({}, f, { done: d.done.indexOf(id) >= 0 }) : null; }).filter(Boolean),
      done: chosen.filter(function (id) { return d.done.indexOf(id) >= 0; }).length,
      paused: ['学习加量', '社交', '穿搭']
    };
  }

  root.LightFloors = {
    KEY: KEY, FLOORS: FLOORS, TIGHT: TIGHT, dateKey: dateKey,
    day: day, colorOf: colorOf, defaultChosen: defaultChosen,
    saveDay: saveDay, choose: choose, toggleDone: toggleDone, summary: summary,
    floor: floor
  };
})(typeof window !== 'undefined' ? window : globalThis);

