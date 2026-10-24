/* ============================================================
   训练 v2 · 数据与指标
   方案：PPL 3 练 1 休 + 功能三项 + 低冲击有氧；3 周 build + 1 周 deload。
   存储：localStorage['lifeflow-train-v2'] = {v, startDate, sessions, body, profile}
   ============================================================ */
(function (root) {
  'use strict';
  var KEY = 'lifeflow-train-v2';
  var DAY = 86400000;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function parseDay(s) {
    var p = String(s || '').split('-').map(Number);
    return new Date(p[0], (p[1] || 1) - 1, p[2] || 1, 12, 0, 0);
  }
  function addDays(key, n) {
    var d = parseDay(key); d.setDate(d.getDate() + n); return dateKey(d);
  }
  function daysBetween(a, b) {
    return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / DAY);
  }

  var PLAN = [
    {
      id: 'push', name: 'Push', focus: 'push', desc: '胸 / 肩 / 三头', cardio: 15,
      ability: 'power',
      strength: [
        { name: '杠铃卧推', muscle: 'chest', sets: 3, reps: '6–8' },
        { name: '上斜哑铃卧推', muscle: 'chest', sets: 3, reps: '8–10' },
        { name: '哑铃侧平举', muscle: 'shoulders', sets: 2, reps: '12–15' },
        { name: '绳索三头下压', muscle: 'triceps', sets: 2, reps: '10–12' }
      ]
    },
    {
      id: 'pull', name: 'Pull', focus: 'pull', desc: '背 / 后束 / 二头', cardio: 15,
      ability: 'rotation',
      strength: [
        { name: '引体 / 高位下拉', muscle: 'back', sets: 3, reps: '6–10' },
        { name: '坐姿绳索划船', muscle: 'back', sets: 3, reps: '6–10' },
        { name: '面拉', muscle: 'rear_delts', sets: 2, reps: '15' },
        { name: '哑铃弯举', muscle: 'biceps', sets: 2, reps: '10–12' }
      ]
    },
    {
      id: 'legs', name: 'Legs', focus: 'legs', desc: '股四 / 后链 / 小腿', cardio: 0,
      ability: 'carry',
      strength: [
        { name: '杠铃深蹲', muscle: 'quads', sets: 3, reps: '5–8' },
        { name: '罗马尼亚硬拉', muscle: 'hamstrings', sets: 3, reps: '6–8' },
        { name: '腿举', muscle: 'quads', sets: 2, reps: '8–10' },
        { name: '站姿提踵', muscle: 'calves', sets: 2, reps: '12–15' }
      ]
    },
    { id: 'rest', name: '休息', focus: 'rest', desc: '走路 / 恢复', cardio: 0, strength: [], ability: null }
  ];

  var ABILITY = {
    carry: {
      name: '农夫行走', metric: 'carry',
      main: '4 组 × 25m', aux: '3 组 × 30m', mainSets: 4, auxSets: 3
    },
    power: {
      name: '爆发力 · 跳箱', metric: 'power',
      main: '4 组 × 3 次', aux: '3 组 × 3 次', mainSets: 4, auxSets: 3
    },
    rotation: {
      name: '负重旋转', metric: 'rotation',
      main: '4 组 × 6/侧', aux: '3 组 × 8/侧', mainSets: 4, auxSets: 3
    }
  };

  function clonePlan() { return JSON.parse(JSON.stringify(PLAN)); }
  function blank() { return { v: 2, startDate: dateKey(), sessions: [], body: [], profile: { goal: 'lean', deloadMode: 'A', forceDeload: false }, plan: clonePlan() }; }
  function db() {
    var d = null;
    try { d = JSON.parse(root.localStorage.getItem(KEY) || 'null'); } catch (e) {}
    if (!d || !Array.isArray(d.sessions)) d = blank();
    if (!d.startDate) d.startDate = dateKey();
    if (!Array.isArray(d.body)) d.body = [];
    if (!d.profile) d.profile = { goal: 'lean' };
    if (!d.profile.deloadMode) d.profile.deloadMode = 'A';
    if (typeof d.profile.forceDeload !== 'boolean') d.profile.forceDeload = false;
    if (!Array.isArray(d.plan) || d.plan.length !== 4) d.plan = clonePlan();
    return d;
  }
  function save(d) {
    try { root.localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
    return d;
  }

  function cycle(date) {
    var d = db(), today = date || dateKey();
    var diff = daysBetween(d.startDate, today);
    var idx = ((diff % 4) + 4) % 4;
    return { index: idx, day: d.plan[idx], startDate: d.startDate, diff: diff };
  }
  function plan() { return db().plan; }
  function saveDay(day) {
    if (!day || !day.id) return null;
    var d = db();
    var i = d.plan.findIndex(function (p) { return p.id === day.id; });
    if (i < 0) return null;
    var clean = {
      id: day.id,
      name: String(day.name || '').slice(0, 12) || d.plan[i].name,
      focus: day.focus || d.plan[i].focus,
      desc: String(day.desc || '').slice(0, 32),
      ability: day.ability || null,
      cardio: Math.max(0, Math.min(60, Number(day.cardio) || 0)),
      strength: (day.strength || []).filter(function (x) { return x && String(x.name || '').trim(); }).map(function (x) {
        return {
          name: String(x.name).trim().slice(0, 16),
          muscle: x.muscle || 'other',
          sets: Math.max(1, Math.min(8, Number(x.sets) || 3)),
          reps: String(x.reps || '8–12').slice(0, 12)
        };
      }).slice(0, 8)
    };
    d.plan[i] = clean;
    save(d);
    return clean;
  }
  function isDeload(date) {
    var d = db();
    var diff = daysBetween(d.startDate, date || dateKey());
    return ((Math.floor(diff / 7) % 4) + 4) % 4 === 3;
  }
  function block(date) {
    var d = db();
    var diff = daysBetween(d.startDate, date || dateKey());
    var week = ((Math.floor(diff / 7) % 4) + 4) % 4;
    return {
      week: week + 1,
      isDeload: week === 3,
      daysToDeload: week === 3 ? 0 : (3 - week) * 7 - (diff % 7)
    };
  }
  function isDeloadNow(date) {
    return isDeload(date) || !!db().profile.forceDeload;
  }
  function getProfile() { return db().profile; }
  function setProfile(patch) {
    var d = db();
    Object.keys(patch || {}).forEach(function (k) { d.profile[k] = patch[k]; });
    save(d);
    return d.profile;
  }
  function setStartDate(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key || ''))) return null;
    var d = db();
    d.startDate = key;
    save(d);
    return key;
  }
  function monthAbility(date) {
    var d = parseDay(date || dateKey());
    return ['carry', 'rotation', 'power'][d.getMonth() % 3];
  }

  function lastSet(name) {
    var list = db().sessions.filter(function (s) { return s.status === 'completed'; })
      .sort(function (a, b) { return (b.startedAt || '').localeCompare(a.startedAt || ''); });
    for (var i = 0; i < list.length; i++) {
      var ex = (list[i].exercises || []).filter(function (x) { return x.name === name; })[0];
      if (ex && ex.sets && ex.sets.length) {
        var done = ex.sets.filter(function (x) { return x.done; });
        return done.length ? done[done.length - 1] : ex.sets[ex.sets.length - 1];
      }
    }
    return null;
  }

  function makeSets(ex, deload, mode) {
    var sets = [];
    var n = deload ? 2 : ex.targetSets;
    var last = lastSet(ex.name);
    var factor = mode === 'B' ? 0.9 : 0.8;
    for (var i = 0; i < n; i++) {
      var w = last && last.weight != null ? last.weight : '';
      if (deload && w) w = Math.round(Number(w) * factor / 2.5) * 2.5;
      sets.push({
        weight: w,
        reps: last && last.reps != null ? last.reps : '',
        rpe: deload ? 6 : (last && last.rpe ? last.rpe : 8),
        done: false
      });
    }
    return sets;
  }

  function buildExercises(day, deload, date, mode) {
    var out = [];
    if (!day || day.focus === 'rest') return out;
    var main = monthAbility(date);
    var isMain = day.ability === main;
    var a = day.ability ? ABILITY[day.ability] : null;
    var abilityEx = null;
    if (a) {
      var n = deload ? 2 : (isMain ? a.mainSets : a.auxSets);
      var sets = [];
      for (var i = 0; i < n; i++) {
        sets.push(a.metric === 'carry'
          ? { weight: '', distance: isMain ? 25 : 30, done: false }
          : a.metric === 'power'
            ? { reps: 3, weight: '', done: false }
            : { weight: '', reps: isMain ? 6 : 8, done: false });
      }
      abilityEx = {
        id: 'a_' + day.ability, kind: 'ability', metric: a.metric, name: a.name,
        target: deload ? '2 组 · 轻' : (isMain ? a.main : a.aux),
        isMain: isMain && !deload, sets: sets
      };
    }
    (day.strength || []).forEach(function (s) {
      var ex = {
        id: 'e_' + s.name, kind: 'strength', name: s.name, muscle: s.muscle,
        targetSets: deload ? 2 : s.sets, targetReps: deload ? '8–12' : s.reps, sets: []
      };
      ex.sets = makeSets(ex, deload, mode);
      out.push(ex);
    });
    if (abilityEx) {
      if (day.focus === 'push') out.unshift(abilityEx); else out.push(abilityEx);
    }
    if (day.cardio) {
      out.push({
        id: 'c_cardio', kind: 'cardio', name: '低冲击有氧', targetMin: deload ? 15 : day.cardio,
        minutes: '', rpe: 4, done: false
      });
    }
    return out;
  }

  function start(date) {
    var today = date || dateKey();
    var d = db();
    var active = d.sessions.filter(function (s) { return s.status === 'active'; })[0];
    if (active) return active;
    var c = cycle(today);
    if (c.day.focus === 'rest') return null;
    var profile = d.profile || {};
    var deload = isDeloadNow(today);
    var mode = profile.deloadMode === 'B' ? 'B' : 'A';
    var s = {
      id: 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
      date: today,
      cycleIndex: c.index,
      planId: c.day.id,
      name: c.day.name + (deload ? ' · 减载' : ''),
      focus: c.day.focus,
      phase: deload ? 'deload' : 'build',
      deloadMode: deload ? mode : null,
      startedAt: new Date().toISOString(),
      endedAt: null,
      durationMin: 0,
      status: 'active',
      warmupDone: [],
      exercises: buildExercises(c.day, deload, today, mode),
      notes: ''
    };
    d.sessions.push(s);
    save(d);
    return s;
  }
  function active() {
    return db().sessions.filter(function (s) { return s.status === 'active'; })[0] || null;
  }
  function get(id) {
    return db().sessions.filter(function (s) { return s.id === id; })[0] || null;
  }
  function update(s) {
    var d = db();
    var i = d.sessions.findIndex(function (x) { return x.id === s.id; });
    if (i >= 0) d.sessions[i] = s;
    save(d);
    return s;
  }
  function finish(id) {
    var s = get(id);
    if (!s) return null;
    s.endedAt = new Date().toISOString();
    s.durationMin = Math.max(1, Math.round((new Date(s.endedAt) - new Date(s.startedAt)) / 60000));
    s.status = 'completed';
    update(s);
    recordStore(s);
    return s;
  }
  function abandon(id) {
    var s = get(id);
    if (!s) return null;
    s.status = 'abandoned';
    s.endedAt = new Date().toISOString();
    update(s);
    return s;
  }
  function removeSession(id) {
    var d = db();
    var i = d.sessions.findIndex(function (x) { return x.id === id; });
    if (i < 0) return false;
    var s = d.sessions.splice(i, 1)[0];
    save(d);
    if (root.LightStore) {
      try {
        var day = root.LightStore.readDay(s.date);
        (day.records || []).forEach(function (r) {
          if (r.meta && r.meta.sessionId === s.id) root.LightStore.remove(r.id);
        });
      } catch (e) {}
    }
    return true;
  }

  function doneSets(s) {
    var n = 0;
    (s.exercises || []).forEach(function (e) {
      (e.sets || []).forEach(function (x) { if (x.done) n++; });
    });
    return n;
  }
  function volume(s) {
    var v = 0;
    (s.exercises || []).forEach(function (e) {
      if (e.kind !== 'strength') return;
      (e.sets || []).forEach(function (x) {
        if (x.done) v += (Number(x.weight) || 0) * (Number(x.reps) || 0);
      });
    });
    return Math.round(v);
  }
  function cardioMin(s) {
    var n = 0;
    (s.exercises || []).forEach(function (e) {
      if (e.kind === 'cardio' && e.done) n += Number(e.minutes) || 0;
    });
    return n;
  }
  function e1rm(w, r) {
    var weight = Number(w) || 0, reps = Number(r) || 0;
    if (!weight || !reps) return 0;
    return Math.round(weight * (1 + reps / 30) * 10) / 10;
  }

  function completed() {
    return db().sessions.filter(function (s) { return s.status === 'completed'; });
  }
  function lastDays(n, date) {
    var end = date || dateKey(), start = addDays(end, -(n - 1));
    return completed().filter(function (s) { return s.date >= start && s.date <= end; });
  }
  function stats(n, date) {
    var list = lastDays(n || 7, date);
    var out = { sessions: list.length, strength: 0, cardio: 0, ability: 0, minutes: 0, volume: 0, sets: 0 };
    list.forEach(function (s) {
      var hasStrength = (s.exercises || []).some(function (e) {
        return e.kind === 'strength' && (e.sets || []).some(function (x) { return x.done; });
      });
      if (hasStrength) out.strength++;
      if ((s.exercises || []).some(function (e) { return e.kind === 'ability' && (e.sets || []).some(function (x) { return x.done; }); })) out.ability++;
      out.cardio += cardioMin(s);
      out.minutes += Number(s.durationMin) || 0;
      out.volume += volume(s);
      out.sets += doneSets(s);
    });
    return out;
  }
  function muscleSets(n, date) {
    var map = {};
    lastDays(n || 7, date).forEach(function (s) {
      (s.exercises || []).forEach(function (e) {
        if (e.kind !== 'strength') return;
        (e.sets || []).forEach(function (x) {
          if (!x.done) return;
          if (x.rpe != null && Number(x.rpe) < 7) return;
          map[e.muscle || 'other'] = (map[e.muscle || 'other'] || 0) + 1;
        });
      });
    });
    return map;
  }
  function bestE1rm(name) {
    var best = 0;
    completed().forEach(function (s) {
      (s.exercises || []).forEach(function (e) {
        if (e.name !== name) return;
        (e.sets || []).forEach(function (x) {
          if (!x.done) return;
          var v = e1rm(x.weight, x.reps);
          if (v > best) best = v;
        });
      });
    });
    return best;
  }
  function recent(n) {
    return completed().sort(function (a, b) {
      return (b.startedAt || '').localeCompare(a.startedAt || '');
    }).slice(0, n || 5);
  }

  function bestLift(name) {
    var best = null;
    completed().forEach(function (s) {
      (s.exercises || []).forEach(function (e) {
        if (e.name !== name) return;
        (e.sets || []).forEach(function (x) {
          if (!x.done) return;
          var score = e1rm(x.weight, x.reps);
          if (!best || score > best.e1rm) best = { weight: Number(x.weight) || 0, reps: Number(x.reps) || 0, e1rm: score, date: s.date };
        });
      });
    });
    return best;
  }
  function prForSession(s) {
    if (!s) return [];
    var previous = completed().filter(function (x) { return x.id !== s.id; });
    var out = [];
    (s.exercises || []).forEach(function (e) {
      if (e.kind !== 'strength') return;
      var best = null;
      (e.sets || []).forEach(function (x) {
        if (!x.done) return;
        var score = e1rm(x.weight, x.reps);
        if (score > 0 && (!best || score > best.e1rm)) best = { weight: Number(x.weight), reps: Number(x.reps), e1rm: score };
      });
      if (!best) return;
      var prev = 0;
      previous.forEach(function (ps) {
        (ps.exercises || []).forEach(function (pe) {
          if (pe.name !== e.name) return;
          (pe.sets || []).forEach(function (x) {
            if (!x.done) return;
            var score = e1rm(x.weight, x.reps);
            if (score > prev) prev = score;
          });
        });
      });
      if (prev > 0 && best.e1rm > prev + 0.01) out.push({ name: e.name, weight: best.weight, reps: best.reps, e1rm: best.e1rm, prev: prev });
    });
    return out;
  }
  function legacyRaw() {
    try { return JSON.parse(root.localStorage.getItem('lifeflow-train-records') || '[]'); } catch (e) { return []; }
  }
  function legacyList(n) {
    return legacyRaw().filter(function (x) { return x && x.name; }).sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || ''));
    }).slice(0, n || 5);
  }
  function exportAll() {
    var d = db();
    return {
      v: 2,
      exportedAt: new Date().toISOString(),
      startDate: d.startDate,
      profile: d.profile,
      sessions: d.sessions,
      body: d.body,
      legacy: legacyRaw()
    };
  }

  function bodyAdd(date, weight, waist) {
    var d = db(), key = date || dateKey();
    var row = { date: key, weight: weight == null || weight === '' ? null : Number(weight), waist: waist == null || waist === '' ? null : Number(waist) };
    var i = d.body.findIndex(function (x) { return x.date === key; });
    if (i >= 0) d.body[i] = row; else d.body.push(row);
    d.body.sort(function (a, b) { return a.date.localeCompare(b.date); });
    save(d);
    return row;
  }
  function bodyList(n) {
    return db().body.slice(-1 * (n || 12));
  }
  function bodyLatest() {
    var b = db().body;
    return b.length ? b[b.length - 1] : null;
  }

  function recordStore(s) {
    if (!root.LightStore) return;
    try {
      var day = root.LightStore.readDay(s.date);
      (day.records || []).forEach(function (r) {
        if (r.meta && r.meta.sessionId === s.id) root.LightStore.remove(r.id);
      });
      root.LightStore.record({
        mod: '运动', metric: 'minutes', value: s.durationMin, date: s.date,
        source: 'training', meta: { sessionId: s.id, source: 'training' }
      });
    } catch (e) {}
  }

  root.LightTraining = {
    KEY: KEY, PLAN: PLAN, dateKey: dateKey, addDays: addDays, cycle: cycle,
    isDeload: isDeload, isDeloadNow: isDeloadNow, block: block, monthAbility: monthAbility, ABILITY: ABILITY,
    plan: plan, saveDay: saveDay, getProfile: getProfile, setProfile: setProfile, setStartDate: setStartDate,
    start: start, active: active, get: get, update: update, finish: finish, abandon: abandon, removeSession: removeSession,
    doneSets: doneSets, volume: volume, cardioMin: cardioMin, e1rm: e1rm,
    stats: stats, muscleSets: muscleSets, bestE1rm: bestE1rm, bestLift: bestLift, prForSession: prForSession,
    recent: recent, lastSet: lastSet, bodyAdd: bodyAdd, bodyList: bodyList, bodyLatest: bodyLatest,
    legacyRaw: legacyRaw, legacyList: legacyList, exportAll: exportAll, recordStore: recordStore
  };
})(typeof window !== 'undefined' ? window : globalThis);

