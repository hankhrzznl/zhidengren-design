/* 执灯人 · Service Worker —— 网络优先：在线拿最新版并回写缓存，离线回退缓存
   历史坑：原先用 cache.addAll() 预缓存，其中 ./assets/tab-avatar.png 已删除（第七轮改为内联 SVG 头像）、
   ./styles/main.css 没有任何页面加载；addAll 是全成全败语义，一个 404 就让 install 整体 reject，
   SW 从此永远不激活且控制台不报错。现改为逐条 add + 单条容错。 */
const CACHE = 'lifeflow-hub-v7';
const ASSETS = [
  './',
  './index.html',
  './desktop.html',
  './manifest.json',
  './tokens.css',
  './assets/icon.svg',
  './assets/apple-touch-icon.png',
  './assets/ai-mascot-dark.png',
  './core/light.js',
  './core/accounts.js',
  './core/store.js'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(ASSETS.map(function (u) {
        // 单条失败不影响整体安装
        return c.add(u).catch(function () {});
      }));
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url;
  try { url = new URL(e.request.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;

  /* 页面导航：缓存优先，立刻给上次的页面，同时在后台更新。
     弱网/国内线路下「打开要等一分钟」的根因就是每次都在等网络。 */
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.open(CACHE).then(function (c) {
        return c.match(e.request).then(function (hit) {
          var update = fetch(e.request).then(function (res) {
            if (res && res.ok) c.put(e.request, res.clone()).catch(function () {});
            return res;
          }).catch(function () { return null; });
          return hit || update.then(function (res) {
            return res || c.match('./index.html') || c.match('./');
          });
        });
      })
    );
    return;
  }

  /* 静态资源：stale-while-revalidate，命中缓存立即返回，后台再更新 */
  e.respondWith(
    caches.open(CACHE).then(function (c) {
      return c.match(e.request).then(function (hit) {
        var update = fetch(e.request).then(function (res) {
          if (res && res.ok) c.put(e.request, res.clone()).catch(function () {});
          return res;
        }).catch(function () { return null; });
        return hit || update.then(function (res) { return res || Response.error(); });
      });
    })
  );
});

