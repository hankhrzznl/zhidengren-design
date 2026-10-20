/* ============================================================
   账单文本解析 bill-parse.js
   用途：从微信/支付宝/银行短信/复制文本里，猜出金额、商户、分类。
   纯函数，不碰 localStorage，方便单测与复用。
   ============================================================ */
(function (root) {
  'use strict';

  var CATS = [
    [/餐|饭|奶茶|咖啡|外卖|美团|饿了么|烧烤|火锅|面馆/, '餐饮'],
    [/地铁|公交|打车|滴滴|出租|高铁|火车|机票|加油|停车|充电桩/, '交通'],
    [/超市|商城|淘宝|京东|拼多多|购物|便利店|盒马|山姆|服饰/, '购物'],
    [/房租|租金|物业|水费|电费|燃气/, '房租'],
    [/还款|信用卡|花呗|白条|借呗|分期/, '还款']
  ];

  function parse(text) {
    var raw = String(text == null ? '' : text).replace(/\r/g, '');
    if (!raw.trim()) return null;

    var amount = null;
    var m = raw.match(/(?:¥|￥)\s*([0-9]+(?:\.[0-9]{1,2})?)/);
    if (m) amount = Number(m[1]);
    if (amount == null) {
      m = raw.match(/(?:金额|消费|支付|付款|扣款|合计|实付)[^0-9]{0,8}([0-9]+(?:\.[0-9]{1,2})?)/);
      if (m) amount = Number(m[1]);
    }
    if (amount == null) {
      var nums = raw.match(/\b([0-9]+\.[0-9]{2})\b/g);
      if (nums && nums.length) amount = Number(nums[nums.length - 1]);
    }
    if (!(amount > 0)) return null;

    var note = '';
    var nm = raw.match(/(?:商户|收款方|交易对方|对方|商家)[:：]?\s*([^\n]{1,30})/);
    if (nm) note = nm[1].trim();
    if (!note) {
      var lines = raw.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      note = lines[0] ? lines[0].slice(0, 30) : '';
    }

    var cat = '日常';
    CATS.some(function (pair) {
      if (pair[0].test(raw)) { cat = pair[1]; return true; }
      return false;
    });

    var hint = '';
    ['微信', '支付宝', '花呗', '白条', '招商', '银行', '现金'].some(function (k) {
      if (raw.indexOf(k) >= 0) { hint = k; return true; }
      return false;
    });

    return {
      amount: Math.round(amount * 100) / 100,
      note: note,
      cat: cat,
      accountHint: hint,
      raw: raw.slice(0, 200)
    };
  }

  root.LightBillParse = { parse: parse };
})(typeof window !== 'undefined' ? window : globalThis);

