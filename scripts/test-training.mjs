/**
 * 训练 v2 纯逻辑验收：node scripts/test-training.mjs
 */
import fs from 'node:fs';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k)
};
let records = [];
globalThis.LightStore = {
  readDay: () => ({ records }),
  remove: (id) => { records = records.filter((r) => r.id !== id); return true; },
  record: (x) => { records.push({ id: 'r' + records.length, ...x }); return records[records.length - 1]; }
};
new Function(fs.readFileSync('pages/core/training.js', 'utf8'))();
const T = globalThis.LightTraining;
const DAY = '2026-10-23';

let pass = 0; const rows = [];
function ok(name, cond, detail = '') { rows.push([cond ? 'PASS' : 'FAIL', name, detail]); if (cond) pass++; }

/* 固定起点 */
localStorage.setItem(T.KEY, JSON.stringify({ v: 2, startDate: DAY, sessions: [], body: [], profile: { goal: 'lean' } }));

const c0 = T.cycle(DAY);
ok('起点是 Day 1 Push', c0.index === 0 && c0.day.id === 'push', JSON.stringify(c0.day));
ok('第 2 天 Pull', T.cycle('2026-10-24').day.id === 'pull');
ok('第 3 天 Legs', T.cycle('2026-10-25').day.id === 'legs');
ok('第 4 天 Rest', T.cycle('2026-10-26').day.id === 'rest');
ok('跨周不重置', T.cycle('2026-10-30').index === ((7 % 4) + 4) % 4);

const s = T.start(DAY);
ok('开始训练生成 session', !!s && s.status === 'active' && s.exercises.length >= 5, s && s.exercises.map((e) => e.kind).join(','));
ok('Push 先爆发力', s.exercises[0].kind === 'ability' && s.exercises[0].metric === 'power', JSON.stringify(s.exercises[0]));
ok('力量动作 4 个', s.exercises.filter((e) => e.kind === 'strength').length === 4);
ok('有氧在最后', s.exercises[s.exercises.length - 1].kind === 'cardio');
ok('力量默认 3 组', s.exercises.filter((e) => e.kind === 'strength')[0].sets.length === 3);

/* 记录一组 + 有氧 */
const strength = s.exercises.filter((e) => e.kind === 'strength')[0];
strength.sets[0].weight = 80; strength.sets[0].reps = 8; strength.sets[0].rpe = 8; strength.sets[0].done = true;
const cardio = s.exercises[s.exercises.length - 1];
cardio.minutes = 15; cardio.done = true;
T.update(s);
const finished = T.finish(s.id);
ok('结束后状态 completed', finished.status === 'completed' && finished.durationMin >= 1, JSON.stringify({ d: finished.durationMin }));
ok('容量 = 80×8', T.volume(finished) === 640, String(T.volume(finished)));
ok('有氧分钟 15', T.cardioMin(finished) === 15, String(T.cardioMin(finished)));
ok('一次 session 只写一条运动事实', records.length === 1 && records[0].value === finished.durationMin, JSON.stringify(records));

/* 重复写不叠加 */
T.recordStore(finished);
ok('重复结算不叠加', records.length === 1, String(records.length));

/* 减载周 */
const deload = T.start('2026-11-13');
ok('第 22 天进入减载', deload.phase === 'deload' && deload.name.includes('减载'), deload.name);
const ds = deload.exercises.filter((e) => e.kind === 'strength')[0];
ok('减载力量 2 组', ds.sets.length === 2, String(ds.sets.length));
ok('减载 RPE 6', Number(ds.sets[0].rpe) === 6, String(ds.sets[0].rpe));
T.abandon(deload.id);

/* 减载模式 B：重量 90% */
T.setProfile({ deloadMode: 'B' });
const d2 = T.start('2026-11-16');
const ds2 = d2.exercises.filter((e) => e.kind === 'strength')[0];
ok('B 模式减载重量 90%', Number(ds2.sets[0].weight) === 72.5, JSON.stringify(ds2.sets[0]));
T.abandon(d2.id);

/* PR：同一动作更重 → 事件 */
const s2 = T.start(DAY);
const bench2 = s2.exercises.filter((e) => e.name === '杠铃卧推')[0];
bench2.sets[0].weight = 90; bench2.sets[0].reps = 8; bench2.sets[0].done = true;
T.update(s2);
T.finish(s2.id);
const prs = T.prForSession(s2);
ok('更重的一组识别为 PR', prs.some((p) => p.name === '杠铃卧推' && p.weight === 90), JSON.stringify(prs));

/* 导出包含 v2 + 旧记录 */
localStorage.setItem('lifeflow-train-records', JSON.stringify([{ name: '旧动作' }]));
const exp = T.exportAll();
ok('导出包含 session 与旧记录', exp.sessions.filter((x) => x.status === 'completed').length === 2 && exp.legacy.length === 1, JSON.stringify({ s: exp.sessions.length, l: exp.legacy.length }));

/* 起点可改 */
T.setStartDate('2026-10-22');
ok('改起点后今天是 Pull', T.cycle(DAY).day.id === 'pull', T.cycle(DAY).day.id);

/* 身体记录 */
T.bodyAdd(DAY, 72.4, 81);
T.bodyAdd('2026-10-30', 71.8, 80.5);
ok('体重记录按日期排序', T.bodyLatest().weight === 71.8 && T.bodyList().length === 2, JSON.stringify(T.bodyList()));

for (const r of rows) console.log(r[0].padEnd(5), r[1], r[2] ? '· ' + r[2] : '');
console.log(`\n训练逻辑校验：${pass}/${rows.length} PASS`);
process.exit(rows.some((r) => r[0] === 'FAIL') ? 1 : 0);


