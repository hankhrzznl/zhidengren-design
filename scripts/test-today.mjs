/**
 * 今日 3+3 规划器：node scripts/test-today.mjs
 */
import fs from 'node:fs';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k)
};
new Function(fs.readFileSync('pages/core/floors.js', 'utf8'))();
new Function(fs.readFileSync('pages/core/goals.js', 'utf8'))();
new Function(fs.readFileSync('pages/core/today.js', 'utf8'))();
const F = globalThis.LightFloors, G = globalThis.LightGoals, T = globalThis.LightToday;
const MON = '2026-10-26', TUE = '2026-10-27';

let pass = 0; const rows = [];
function ok(name, cond, detail = '') { rows.push([cond ? 'PASS' : 'FAIL', name, detail]); if (cond) pass++; }

F.saveDay({ sleep: 4, soreness: 4, mood: 4, stress: 4 }, MON);
G.save({
  id: 'g-thin', title: '薄肌', status: 'active', priority: 1, primary: true,
  activeFrom: '2026-10-01', activeTo: '2027-03-31',
  requirements: [
    { id: 'r-sleep', moduleId: 'sleep', metric: 'hours', target: 7, unit: 'h', cadence: 'daily' },
    { id: 'r-train', moduleId: 'training', metric: 'sessions', target: 3, unit: '次', cadence: 'weekly' }
  ]
});
G.save({
  id: 'g-exam', title: '考公', status: 'active', priority: 2,
  activeFrom: '2026-10-01', activeTo: '2026-12-20',
  requirements: [
    { id: 'r-sleep2', moduleId: 'sleep', metric: 'hours', target: 7, unit: 'h', cadence: 'daily' },
    { id: 'r-study', moduleId: 'study', metric: 'minutes', target: 120, unit: 'min', cadence: 'daily' }
  ]
});

const mon = T.plan(MON);
ok('3 个保底', mon.floors.length === 3, JSON.stringify(mon.floors.map((x) => x.label)));
ok('共享睡眠只出现一次', mon.floors.filter((x) => x.moduleId === 'sleep').length === 1 && mon.floors[0].goals.length === 2, JSON.stringify(mon.floors[0]));
ok('周一训练按周配额出现', mon.progress.some((x) => x.moduleId === 'training') && mon.progress.some((x) => x.moduleId === 'study'), JSON.stringify(mon.progress.map((x) => x.moduleId)));
ok('今日推进不超过 3', mon.progress.length <= 3, String(mon.progress.length));

const tue = T.plan(TUE);
ok('周二训练不重复出现', !tue.progress.some((x) => x.moduleId === 'training'), JSON.stringify(tue.progress.map((x) => x.moduleId)));
ok('周二显示本周还差训练', tue.weekly.some((x) => x.moduleId === 'training' && x.target === 3), JSON.stringify(tue.weekly));

const yellow = F.saveDay({ sleep: 3 }, MON);
const y = T.plan(MON);
ok('黄状态只留 1 个推进', y.color === 'yellow' && y.limit === 1 && y.progress.length === 1, JSON.stringify({ c: y.color, l: y.limit, n: y.progress.length }));

F.saveDay({ sleep: 2 }, MON);
const red = T.plan(MON);
ok('红状态不生成推进', red.color === 'red' && red.progress.length === 0 && red.paused.length >= 1, JSON.stringify({ c: red.color, p: red.progress.length, q: red.paused.length }));

F.saveDay({ sleep: 4 }, MON);
const key = 'training|sessions|次';
T.toggle(key, MON);
const done = T.plan(MON);
ok('勾选推进写回', done.progress.filter((x) => x.key === key)[0].done === true && done.done === 1, JSON.stringify({ done: done.done }));
T.toggle(key, MON);

G.save({
  id: 'g-thin', title: '薄肌', status: 'active', priority: 1, primary: true,
  activeFrom: '2026-10-01', activeTo: '2027-03-31',
  requirements: [{ id: 'r-sleep', moduleId: 'sleep', metric: 'hours', target: 8, unit: 'h', cadence: 'daily' }]
});
const high = T.plan(MON);
ok('共享保底取更高目标', high.floors[0].target === 8, String(high.floors[0].target));

G.save({
  id: 'g-cut', title: '减脂', status: 'active', priority: 1, activeFrom: '2026-10-01',
  requirements: [{ id: 'r-energy', moduleId: 'diet', metric: 'energy', target: 1800, unit: 'kcal', direction: 'at_most', cadence: 'daily' }]
});
G.save({
  id: 'g-bulk', title: '增肌', status: 'active', priority: 2, activeFrom: '2026-10-01',
  requirements: [{ id: 'r-energy2', moduleId: 'diet', metric: 'energy', target: 2400, unit: 'kcal', direction: 'at_least', cadence: 'daily' }]
});
const conflict = T.plan(MON);
ok('方向冲突显示冲突', conflict.conflicts.length === 1, JSON.stringify(conflict.conflicts.map((x) => x.goals)));

/* 周配额累计：周一/周四/周日 */
const TRAIN = 'training|sessions|次', THU = '2026-10-29', SUN = '2026-11-01';
G.save({
  id: 'g-train2', title: '训练目标', status: 'active', activeFrom: MON,
  requirements: [{ id: 't2', moduleId: 'training', metric: 'sessions', target: 3, unit: '次', cadence: 'weekly' }]
});
T.toggle(TRAIN, MON);
const one = T.plan(MON);
const oneTrain = one.progress.filter((x) => x.key === TRAIN)[0];
ok('周配额显示 1/3', /1\/3/.test(oneTrain.meta), JSON.stringify(oneTrain));
T.toggle(TRAIN, THU);
T.toggle(TRAIN, SUN);
const full = T.plan(SUN);
ok('周配额完成后不再出现', !full.progress.some((x) => x.key === TRAIN) && full.weekly.some((x) => x.key === TRAIN && x.complete), JSON.stringify(full.weekly));
const gWeek = G.save({
  id: 'g-week', title: '周配额目标', status: 'active', activeFrom: MON,
  requirements: [{ id: 'w-train', moduleId: 'training', metric: 'sessions', target: 3, unit: '次', cadence: 'weekly' }]
});
const ws = T.goalStats(gWeek, SUN);
ok('周配额目标进度 100%', ws && ws.percent === 100, JSON.stringify(ws));

const gDay = G.save({
  id: 'g-day', title: '日目标', status: 'active', activeFrom: MON,
  requirements: [{ id: 'd-study', moduleId: 'study', metric: 'minutes', target: 1, unit: 'min', cadence: 'daily' }]
});
T.toggle('study|minutes|min', MON);
const ds = T.goalStats(gDay, MON);
ok('日目标进度 100%', ds && ds.percent === 100, JSON.stringify(ds));

/* 模块日志：训练记录自动折算，不需要再勾 3+3 */
const LOG_MON = '2026-11-02', LOG_THU = '2026-11-05', LOG_SUN = '2026-11-08';
const storeDays = {
  [LOG_MON]: [{ mod: '运动', metric: 'minutes', value: 45 }],
  [LOG_THU]: [{ mod: '运动', metric: 'minutes', value: 50 }],
  [LOG_SUN]: [{ mod: '运动', metric: 'minutes', value: 40 }],
  [MON]: [
    { mod: '睡眠', metric: 'hours', value: 7.5 },
    { mod: '饮水', metric: 'ml', value: 1500 }
  ]
};
globalThis.LightStore = { readDay: (d) => ({ records: storeDays[d] || [] }) };
ok('模块记录折算训练次数', T.moduleAmount('training', 'sessions', LOG_MON) === 1, String(T.moduleAmount('training', 'sessions', LOG_MON)));
ok('模块记录折算睡眠/饮水', T.moduleAmount('sleep', 'hours', MON) === 7.5 && T.moduleAmount('water', 'volume', MON) === 1.5);
const gLog = G.save({
  id: 'g-log', title: '日志目标', status: 'active', activeFrom: LOG_MON,
  requirements: [{ id: 'l-train', moduleId: 'training', metric: 'sessions', target: 3, unit: '次', cadence: 'weekly' }]
});
const logPlan = T.plan(LOG_SUN);
ok('模块日志自动完成周配额', logPlan.weekly.some((x) => x.key === 'training|sessions|次' && x.complete && x.done === 3), JSON.stringify(logPlan.weekly));
const logStats = T.goalStats(gLog, LOG_SUN);
ok('模块日志驱动目标进度', logStats && logStats.percent === 100, JSON.stringify(logStats));

/* 上周缺口 → 顺延 / 降级 / 跳过 */
const PREV = '2026-10-19';
G.save({
  id: 'g-prev', title: '上周目标', status: 'active', activeFrom: PREV,
  requirements: [{ id: 'p-train', moduleId: 'training', metric: 'sessions', target: 3, unit: '次', cadence: 'weekly' }]
});
const review = T.weeklyReview(MON);
const gapRow = review.pending.filter((x) => x.key === 'training|sessions|次')[0];
ok('上周缺口可识别', gapRow && gapRow.gap === 3, JSON.stringify(review.pending));
const carry = T.applyWeeklyAction('training|sessions|次', MON, 'carry');
ok('顺延最多 +2', carry && carry.amount === 2 && T.weeklyTargetFor('training|sessions|次', 3, MON) === 5, JSON.stringify(carry));
ok('顺延后不再待处理', T.weeklyReview(MON).pending.every((x) => x.key !== 'training|sessions|次'));
T.applyWeeklyAction('training|sessions|次', MON, 'reduce');
ok('降级为 1 次/周', T.weeklyTargetFor('training|sessions|次', 3, MON) === 1);
T.applyWeeklyAction('training|sessions|次', MON, 'skip');
ok('跳过后保持基础目标', T.weeklyTargetFor('training|sessions|次', 3, MON) === 3);
const wsum = T.weekSummary(MON);
ok('周复盘包含目标与配额', wsum.goals.length > 0 && wsum.quotas.some((x) => x.key === 'training|sessions|次'), JSON.stringify({ g: wsum.goals.length, q: wsum.quotas.length }));
ok('周复盘包含模块/保底', wsum.modules && wsum.floors && wsum.floors.total >= 0, JSON.stringify(wsum.floors));

for (const r of rows) console.log(r[0].padEnd(5), r[1], r[2] ? '· ' + r[2] : '');
console.log(`\n今日 3+3 校验：${pass}/${rows.length} PASS`);
process.exit(rows.some((r) => r[0] === 'FAIL') ? 1 : 0);

