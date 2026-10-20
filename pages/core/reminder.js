/* ============================================================
   每月对账提醒 reminder.js
   用途：每月固定一天提醒导出支付宝/微信账单 CSV，导入补零钱消费。
   存储：localStorage['lifeflow-import-reminder'] = {day: 5, lastDone: '2026-10'}
   ============================================================ */
(function (root) {
  'use strict';
  var KEY = 'lifeflow-import-reminder';

  function monthKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1);
  }
  function config() {
    try {
      var c = JSON.parse(root.localStorage.getItem(KEY) || 'null') || {};
      return { day: Math.min(28, Math.max(0, Number(c.day) || 0)), lastDone: String(c.lastDone || '') };
    } catch (e) { return { day: 0, lastDone: '' }; }
  }
  function save(cfg) {
    var c = { day: Math.min(28, Math.max(0, Number(cfg.day) || 0)), lastDone: String(cfg.lastDone || '') };
    root.localStorage.setItem(KEY, JSON.stringify(c));
    return c;
  }
  function markDone(day) {
    var c = config();
    c.lastDone = monthKey(day ? new Date(day) : new Date());
    return save(c);
  }
  function dueInfo(today) {
    var c = config();
    if (!c.day) return { enabled: false };
    var d = today ? new Date(today) : new Date();
    var due = new Date(d.getFullYear(), d.getMonth(), c.day);
    var base = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var days = Math.round((due.getTime() - base.getTime()) / 86400000);
    var mk = monthKey(d);
    var done = c.lastDone === mk;
    return {
      enabled: true,
      day: c.day,
      due: due.getFullYear() + '-' + (due.getMonth() + 1) + '-' + due.getDate(),
      days: days,
      done: done,
      month: mk,
      should: !done && days <= 0
    };
  }
  function ics(day) {
    var d = day || config().day || 5;
    var now = new Date();
    var start = new Date(now.getFullYear(), now.getMonth(), d);
    if (start.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) {
      start = new Date(now.getFullYear(), now.getMonth() + 1, d);
    }
    var ymd = function (x) { return x.getFullYear() + String(x.getMonth() + 1).padStart(2, '0') + String(x.getDate()).padStart(2, '0'); };
    var stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ZhiDengRen//Import Reminder//CN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:lifeflow-import-' + d + '@my-lifeos.com',
      'DTSTAMP:' + stamp,
      'DTSTART;VALUE=DATE:' + ymd(start),
      'RRULE:FREQ=MONTHLY;BYMONTHDAY=' + d,
      'SUMMARY:导出支付宝/微信账单 → 导入记账',
      'DESCRIPTION:支付宝/微信导出 CSV，打开 my-lifeos.com/app/v3/bill-import.html 导入，补齐零钱消费。',
      'BEGIN:VALARM',
      'TRIGGER:-PT0M',
      'ACTION:DISPLAY',
      'DESCRIPTION:每月对账：导出账单 CSV 并导入',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
  }

  root.LightReminder = {
    config: config,
    save: save,
    markDone: markDone,
    dueInfo: dueInfo,
    ics: ics,
    monthKey: monthKey
  };
})(typeof window !== 'undefined' ? window : globalThis);
