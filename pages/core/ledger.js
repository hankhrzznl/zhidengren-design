/* ============================================================
   执灯人 · 账本内核 ledger.js（v1）
   ------------------------------------------------------------
   职责：账户、流水、分期的纯数据层；钱怎么算都在这里，页面只负责画。

   存储：localStorage['lifeflow-ledger-v1']
     {
       v: 1,
       accounts: [{id,name,type:'asset'|'credit',kind,opening,limit,billDay,repayDay,color}],
       tx:      [{id,ts,date,type:'expense'|'income'|'transfer'|'repay',amount,accountId,toId,category,note}],
       plans:   [{id,accountId,name,principal,periods,feeRate,monthly,startDate,paid}]
     }

   口径：
   - 资产账户余额 = opening + income + transferIn - expense - transferOut - repayOut
   - 信用账户已用 = opening + expense - repayIn
   - 净资产 = 资产合计 - 信用已用
   - 分期只做「还款计划」，本金已在信用已用里，不再重复计负债
   ============================================================ */
(function (root) {
  'use strict';

  var KEY = 'lifeflow-ledger-v1';
  var VERSION = 1;

  function empty() { return { v: VERSION, accounts: [], tx: [], plans: [] }; }

  function load() {
    try {
      var raw = root.localStorage && root.localStorage.getItem(KEY);
      if (!raw) return empty();
      var db = JSON.parse(raw);
      if (!db || typeof db !== 'object') return empty();
      db.v = db.v || VERSION;
      db.accounts = db.accounts || [];
      db.tx = db.tx || [];
      db.plans = db.plans || [];
      return db;
    } catch (e) { return empty(); }
  }

  function save(db) {
    try {
      root.localStorage.setItem(KEY, JSON.stringify(db));
      return true;
    } catch (e) { return false; }
  }

  function id(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function monthKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1);
  }

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  /* 不再预置演示账户：账本从空开始，用户自己加 */

  function listAccounts() { return load().accounts.slice(); }

  function accountById(db, accountId) {
    db = db || load();
    for (var i = 0; i < db.accounts.length; i++) if (db.accounts[i].id === accountId) return db.accounts[i];
    return null;
  }

  function addAccount(input) {
    input = input || {};
    var name = String(input.name || '').trim();
    if (!name) return null;
    var db = load();
    var acc = {
      id: id('acc_'),
      name: name,
      type: input.type === 'credit' ? 'credit' : 'asset',
      kind: input.kind || (input.type === 'credit' ? 'credit' : 'bank'),
      opening: num(input.opening),
      limit: input.type === 'credit' ? num(input.limit) : 0,
      billDay: num(input.billDay) || 1,
      repayDay: num(input.repayDay) || 10,
      color: input.color || (input.type === 'credit' ? '#8B5CF6' : '#4DC3FF')
    };
    db.accounts.push(acc);
    if (!save(db)) return null;
    return acc;
  }

  function updateAccount(accountId, patch) {
    var db = load();
    var acc = accountById(db, accountId);
    if (!acc) return null;
    Object.keys(patch || {}).forEach(function (k) {
      if (k === 'opening' || k === 'limit' || k === 'billDay' || k === 'repayDay') acc[k] = num(patch[k]);
      else if (k === 'name') acc.name = String(patch[k]).slice(0, 20);
      else acc[k] = patch[k];
    });
    save(db);
    return acc;
  }

  /* 账户余额：从 opening + 流水实时算，不存冗余 */
  function accountBalance(db, accountId) {
    db = db || load();
    var acc = accountById(db, accountId);
    if (!acc) return 0;
    var bal = num(acc.opening);
    db.tx.forEach(function (t) {
      var a = num(t.amount);
      if (acc.type === 'asset') {
        if (t.type === 'income' && t.accountId === accountId) bal += a;
        else if (t.type === 'expense' && t.accountId === accountId) bal -= a;
        else if (t.type === 'transfer' && t.accountId === accountId) bal -= a;
        else if (t.type === 'transfer' && t.toId === accountId) bal += a;
        else if (t.type === 'repay' && t.accountId === accountId) bal -= a;
      } else {
        if (t.type === 'expense' && t.accountId === accountId) bal += a;
        else if (t.type === 'repay' && t.toId === accountId) bal -= a;
      }
    });
    return Math.round(bal * 100) / 100;
  }

  function addTx(input) {
    input = input || {};
    var amount = num(input.amount);
    if (amount <= 0) return null;
    var type = input.type || 'expense';
    if (!['expense', 'income', 'transfer', 'repay'].includes(type)) return null;
    if (!input.accountId) return null;
    var db = load();
    if (!accountById(db, input.accountId)) return null;
    var tx = {
      id: id('tx_'),
      ts: Date.now(),
      date: input.date || dateKey(),
      type: type,
      amount: Math.round(amount * 100) / 100,
      accountId: input.accountId,
      category: String(input.category || (type === 'income' ? '收入' : '日常')),
      note: String(input.note || '').slice(0, 60)
    };
    if (type === 'transfer' || type === 'repay') {
      if (!input.toId || input.toId === input.accountId) return null;
      tx.toId = input.toId;
    }
    db.tx.push(tx);
    if (!save(db)) return null;
    return tx;
  }

  function removeTx(txId) {
    var db = load();
    var i = db.tx.findIndex(function (t) { return t.id === txId; });
    if (i < 0) return false;
    db.tx.splice(i, 1);
    return save(db);
  }

  function plans() { return load().plans.slice(); }

  function addPlan(input) {
    input = input || {};
    var periods = Math.round(num(input.periods));
    if (periods < 1 || !input.accountId) return null;
    var feeRate = num(input.feeRate);
    var monthly = num(input.monthly);
    var principal = num(input.principal);
    /* 两种录法：知道「每期还多少」最直观；只有总价时再按月摊 */
    if (monthly > 0) {
      principal = Math.round(monthly * periods * 100) / 100;
    } else if (principal > 0) {
      monthly = Math.round((principal * (1 + feeRate / 100) / periods) * 100) / 100;
    } else {
      return null;
    }
    var db = load();
    var plan = {
      id: id('plan_'),
      accountId: input.accountId,
      name: String(input.name || '分期').slice(0, 20),
      principal: Math.round(principal * 100) / 100,
      periods: periods,
      feeRate: feeRate,
      monthly: monthly,
      startDate: input.startDate || dateKey(),
      paid: 0
    };
    db.plans.push(plan);
    /* 本金记成一笔信用支出（这样「已用」就包含了它，计划只管还款节奏） */
    db.tx.push({
      id: id('tx_'),
      ts: Date.now(),
      date: plan.startDate,
      type: 'expense',
      amount: principal,
      accountId: plan.accountId,
      category: '分期本金',
      note: plan.name
    });
    if (!save(db)) return null;
    return plan;
  }

  function repayPlan(planId, fromAccountId) {
    var db = load();
    var plan = db.plans.find(function (p) { return p.id === planId; });
    if (!plan) return null;
    if (plan.paid >= plan.periods) return null;
    if (!fromAccountId) return null;
    db.tx.push({
      id: id('tx_'),
      ts: Date.now(),
      date: dateKey(),
      type: 'repay',
      amount: plan.monthly,
      accountId: fromAccountId,
      toId: plan.accountId,
      category: '分期还款',
      note: plan.name
    });
    plan.paid += 1;
    if (!save(db)) return null;
    return plan;
  }

  function planRemaining(plan) { return Math.max(0, plan.periods - plan.paid) * plan.monthly; }

  /* 某个月应还多少：每笔分期各自按自己的期数排，12 期和 24 期不会互相牵连 */
  function monthlyDue(month) {
    var db = load();
    var mk = month || monthKey();
    var items = [], total = 0;
    db.plans.forEach(function (p) {
      for (var n = 1; n <= p.periods; n++) {
        var d = addMonths(p.startDate, n);
        var m = d.slice(0, d.lastIndexOf('-'));
        if (m === mk) {
          items.push({ planId: p.id, name: p.name, accountId: p.accountId, monthly: p.monthly, installment: n, paid: n <= p.paid });
          total += p.monthly;
          break;
        }
      }
    });
    return { month: mk, total: Math.round(total * 100) / 100, items: items };
  }

  /* 未来 n 个月每月应还 */
  function upcoming(n, fromMonth) {
    var start = fromMonth || monthKey();
    var count = n || 6;
    var out = [];
    for (var i = 0; i < count; i++) {
      var d = addMonths(start + '-1', i);
      var mk = d.slice(0, d.lastIndexOf('-'));
      var due = monthlyDue(mk);
      out.push({ month: mk, label: Number(mk.split('-')[1]) + '月', total: due.total, count: due.items.length });
    }
    return out;
  }

  /* 一次性还掉某个月所有到期分期（从指定资产账户扣） */
  function payMonth(month, fromAccountId) {
    if (!fromAccountId) return { count: 0, total: 0 };
    var db = load();
    var mk = month || monthKey();
    var count = 0, total = 0;
    db.plans.forEach(function (p) {
      if (p.paid >= p.periods) return;
      var next = p.paid + 1;
      var d = addMonths(p.startDate, next);
      if (d.slice(0, d.lastIndexOf('-')) !== mk) return;
      db.tx.push({
        id: id('tx_'),
        ts: Date.now(),
        date: d,
        type: 'repay',
        amount: p.monthly,
        accountId: fromAccountId,
        toId: p.accountId,
        category: '分期还款',
        note: p.name
      });
      p.paid += 1;
      count += 1;
      total += p.monthly;
    });
    if (count) save(db);
    return { count: count, total: Math.round(total * 100) / 100 };
  }

  /* ---- 账单日 / 还款日 ---- */
  function nextDayOfMonth(day, from) {
    day = Math.min(28, Math.max(1, Math.round(num(day) || 1)));
    var d = from ? new Date(from) : new Date();
    var y = d.getFullYear(), m = d.getMonth(), today = d.getDate();
    var target = new Date(y, m, day);
    if (day < today) target = new Date(y, m + 1, day);
    return target;
  }
  function ymd(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function md(d) { return (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
  function dayDiff(a, b) {
    var x = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
    var y = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
    return Math.round((x - y) / 86400000);
  }
  /* 每个信用账户下一期账单日 / 还款日 + 本月应还 */
  function billingInfo(today) {
    var db = load();
    var t = today ? new Date(today) : new Date();
    var dueByAcc = {};
    monthlyDue().items.forEach(function (it) { dueByAcc[it.accountId] = (dueByAcc[it.accountId] || 0) + it.monthly; });
    return db.accounts.filter(function (a) { return a.type === 'credit'; }).map(function (a) {
      var bill = nextDayOfMonth(a.billDay || 1, t);
      var repay = nextDayOfMonth(a.repayDay || 10, t);
      /* 还款日在账单日之前，说明是「下个月还」 */
      if (repay.getTime() <= bill.getTime()) repay = new Date(repay.getFullYear(), repay.getMonth() + 1, repay.getDate());
      return {
        accountId: a.id,
        name: a.name,
        billDay: a.billDay || 1,
        repayDay: a.repayDay || 10,
        billDate: ymd(bill),
        repayDate: ymd(repay),
        billLabel: md(bill),
        repayLabel: md(repay),
        daysToBill: dayDiff(bill, t),
        daysToRepay: dayDiff(repay, t),
        due: Math.round((dueByAcc[a.id] || 0) * 100) / 100
      };
    }).sort(function (x, y) { return x.daysToRepay - y.daysToRepay; });
  }

  /* ---- 本月预算 / 分类汇总 ---- */
  function setBudget(amount, month) {
    var db = load();
    db.budget = { month: month || monthKey(), amount: Math.max(0, num(amount)) };
    if (!save(db)) return null;
    return db.budget;
  }

  function budgetOf(month) {
    var db = load();
    var mk = month || monthKey();
    return db.budget && db.budget.month === mk ? num(db.budget.amount) : 0;
  }

  function categoryBreakdown(month, limit) {
    var db = load();
    var mk = month || monthKey();
    var map = {};
    db.tx.forEach(function (t) {
      if (t.type !== 'expense') return;
      var d = String(t.date || '');
      if (d.slice(0, d.lastIndexOf('-')) !== mk) return;
      var c = t.category || '日常';
      map[c] = (map[c] || 0) + num(t.amount);
    });
    return Object.keys(map).map(function (c) {
      return { category: c, amount: Math.round(map[c] * 100) / 100 };
    }).sort(function (a, b) { return b.amount - a.amount; }).slice(0, limit || 3);
  }

  function totals(month) {
    var db = load();
    var mk = month || monthKey();
    var assets = 0, creditUsed = 0, monthSpend = 0, monthIncome = 0;
    db.accounts.forEach(function (a) {
      var bal = accountBalance(db, a.id);
      if (a.type === 'credit') creditUsed += Math.max(0, bal);
      else assets += bal;
    });
    db.tx.forEach(function (t) {
      if (String(t.date).slice(0, t.date.lastIndexOf('-')) !== mk) return;
      if (t.type === 'expense') monthSpend += num(t.amount);
      if (t.type === 'income') monthIncome += num(t.amount);
    });
    var net = assets - creditUsed;
    return {
      assets: Math.round(assets * 100) / 100,
      creditUsed: Math.round(creditUsed * 100) / 100,
      net: Math.round(net * 100) / 100,
      monthSpend: Math.round(monthSpend * 100) / 100,
      monthIncome: Math.round(monthIncome * 100) / 100,
      accounts: db.accounts.length,
      plans: db.plans.length
    };
  }

  /* ---- 月报：单月汇总 / 六个月趋势 / 分期自动还款 ---- */
  function monthSummary(month) {
    var db = load();
    var mk = month || monthKey();
    var income = 0, expense = 0;
    var byCat = {}, byAcc = {};
    db.tx.forEach(function (t) {
      if (t.type !== 'expense' && t.type !== 'income') return;
      var d = String(t.date || '');
      if (d.slice(0, d.lastIndexOf('-')) !== mk) return;
      var a = num(t.amount);
      if (t.type === 'income') { income += a; return; }
      expense += a;
      var c = t.category || '日常';
      byCat[c] = (byCat[c] || 0) + a;
      byAcc[t.accountId] = (byAcc[t.accountId] || 0) + a;
    });
    var round = function (x) { return Math.round(x * 100) / 100; };
    var categories = Object.keys(byCat).map(function (c) {
      return { category: c, amount: round(byCat[c]), share: expense ? Math.round(byCat[c] / expense * 100) : 0 };
    }).sort(function (a, b) { return b.amount - a.amount; });
    var accounts = Object.keys(byAcc).map(function (id) {
      var acc = accountById(db, id);
      return { id: id, name: acc ? acc.name : '账户', amount: round(byAcc[id]) };
    }).sort(function (a, b) { return b.amount - a.amount; });
    return { month: mk, income: round(income), expense: round(expense), balance: round(income - expense), byCategory: categories, byAccount: accounts };
  }

  function monthlyTrend(n, endMonth) {
    var db = load();
    var count = n || 6;
    var out = [];
    var end = endMonth ? endMonth.split('-').map(Number) : null;
    var now = end ? new Date(end[0], end[1] - 1, 1) : new Date();
    for (var i = count - 1; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      var mk = d.getFullYear() + '-' + (d.getMonth() + 1);
      var expense = 0, income = 0;
      db.tx.forEach(function (t) {
        var ds = String(t.date || '');
        if (ds.slice(0, ds.lastIndexOf('-')) !== mk) return;
        if (t.type === 'expense') expense += num(t.amount);
        if (t.type === 'income') income += num(t.amount);
      });
      out.push({ month: mk, label: (d.getMonth() + 1) + '月', expense: Math.round(expense * 100) / 100, income: Math.round(income * 100) / 100 });
    }
    return out;
  }

  /* 加 n 个月；月末对齐（1/31 + 1 月 = 2/28/29） */
  function addMonths(dateStr, n) {
    var p = String(dateStr).split('-').map(Number);
    var y = p[0], m = p[1] - 1, day = p[2] || 1;
    var d = new Date(y, m + n, 1);
    var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  /* 日期比较用数字，避免 2026-9-15 与 2026-10-15 的字符串坑 */
  function dateNum(dateStr) {
    var p = String(dateStr || '').split('-').map(Number);
    return (p[0] || 0) * 10000 + (p[1] || 0) * 100 + (p[2] || 1);
  }

  /* 到期自动记一期：从第一个资产账户扣，记在应还日；可补多期 */
  function autoRepayDue(today) {
    var db = load();
    var t = today || dateKey();
    var n = 0;
    db.plans.forEach(function (p) {
      while (p.paid < p.periods) {
        var due = addMonths(p.startDate, p.paid + 1);
        if (dateNum(due) > dateNum(t)) break;
        var from = db.accounts.filter(function (a) { return a.type === 'asset'; })[0];
        if (!from) break;
        db.tx.push({
          id: id('tx_'),
          ts: Date.now(),
          date: due,
          type: 'repay',
          amount: p.monthly,
          accountId: from.id,
          toId: p.accountId,
          category: '分期自动还款',
          note: p.name
        });
        p.paid += 1;
        n += 1;
        if (n > 60) break;
      }
    });
    if (n) save(db);
    return n;
  }

  /* 清演示数据：
     - 旧「记账」页内置的 6 条示例（按备注+金额识别）
     - 只剩默认 5 个空账户时，整本清掉
     - 旧 key 与迁移标记一并删掉，避免再次导入 */
  var LEGACY_DEMO = [
    { note: '午餐 · 沙拉碗', amount: 38 },
    { note: '地铁通勤', amount: 6 },
    { note: '日用品补给', amount: 126.5 },
    { note: '晚餐 · 家常菜', amount: 52 },
    { note: '水电燃气', amount: 214 },
    { note: '周末电影', amount: 88 }
  ];
  var DEFAULT_IDS = ['acc_wechat', 'acc_alipay', 'acc_bank1', 'acc_huabei', 'acc_baitiao'];

  function cleanDemo() {
    var changed = false;
    try {
      var db = load();
      var before = db.tx.length;
      db.tx = db.tx.filter(function (t) {
        return !LEGACY_DEMO.some(function (d) {
          return String(t.note || '') === d.note && Math.abs(num(t.amount) - d.amount) < 0.01;
        });
      });
      if (db.tx.length !== before) changed = true;

      var onlyDefault = db.accounts.length > 0 && db.accounts.every(function (a) { return DEFAULT_IDS.indexOf(a.id) >= 0; });
      var allZero = db.accounts.every(function (a) { return num(a.opening) === 0 && num(a.limit) === 0; });
      if (onlyDefault && allZero && db.tx.length === 0 && db.plans.length === 0) {
        root.localStorage.removeItem(KEY);
        changed = true;
      } else if (changed) {
        save(db);
      }
      root.localStorage.removeItem('lifeflow-expense-items');
      root.localStorage.removeItem('lifeflow-expense-budget');
      root.localStorage.removeItem('lifeflow-ledger-migrated');
    } catch (e) {}
    return changed;
  }

  /* 用户手动清空整本账 */
  function reset() {
    try {
      root.localStorage.removeItem(KEY);
      root.localStorage.removeItem('lifeflow-expense-items');
      root.localStorage.removeItem('lifeflow-expense-budget');
      root.localStorage.removeItem('lifeflow-ledger-migrated');
      return true;
    } catch (e) { return false; }
  }

  root.LightLedger = {
    KEY: KEY,
    load: load,
    save: save,
    cleanDemo: cleanDemo,
    reset: reset,
    listAccounts: listAccounts,
    accountById: accountById,
    addAccount: addAccount,
    updateAccount: updateAccount,
    accountBalance: accountBalance,
    addTx: addTx,
    removeTx: removeTx,
    plans: plans,
    addPlan: addPlan,
    repayPlan: repayPlan,
    planRemaining: planRemaining,
    monthlyDue: monthlyDue,
    billingInfo: billingInfo,
    upcoming: upcoming,
    payMonth: payMonth,
    setBudget: setBudget,
    budgetOf: budgetOf,
    categoryBreakdown: categoryBreakdown,
    monthSummary: monthSummary,
    monthlyTrend: monthlyTrend,
    addMonths: addMonths,
    autoRepayDue: autoRepayDue,
    totals: totals,
    monthKey: monthKey,
    dateKey: dateKey
  };
})(typeof window !== 'undefined' ? window : globalThis);


