// Cloudflare Pages Function：高德 API 代理
// 路由：/api/amap/* → https://restapi.amap.com/v3/*
// 用法：前端调用 /api/amap/place/around?location=...&keywords=...（不带 key）
//
// 安全策略：
// 1. Key 在服务端从 env.AMAP_KEY 注入，前端零暴露
// 2. 路径白名单：仅放行 /place/around、/place/text、/geocode/regeo
// 3. 强制返回 JSON（剥离 callback 参数，不走 JSONP）
// 4. 单 IP 60s 内 ≤30 次请求（基于 Cache API 滑动窗口，超限返回 429）
// 5. 同域访问（cena-demo.pages.dev / cenad.meowoflow.top）无需 CORS
//
// 复赛扩展方向（暂未实现）：
// - 改用 Durable Objects 做精确限流
// - 引入 KV 缓存热点周边搜索结果
// - 增加请求日志（Workers Analytics）

const ALLOWED_PATHS = new Set([
  '/place/around',
  '/place/text',
  '/geocode/regeo',
]);

const RATE_LIMIT_WINDOW = 60;   // 秒
const RATE_LIMIT_MAX = 30;      // 单 IP 单窗口最大请求数
const UPSTREAM_TTL = 60;         // 边缘缓存秒数（相同 URL 60s 内复用）

export async function onRequest(context) {
  const { request, env, params } = context;

  // 1. 方法限制：高德 REST API 仅支持 GET
  if (request.method !== 'GET') {
    return json({ status: '0', info: 'METHOD_NOT_ALLOWED' }, 405);
  }

  // 2. 路径白名单
  const pathParts = params.path || [];
  const amapPath = '/' + pathParts.join('/');
  if (!ALLOWED_PATHS.has(amapPath)) {
    return json({ status: '0', info: 'PATH_NOT_ALLOWED' }, 403);
  }

  // 3. 检查 Key 配置
  const amapKey = env.AMAP_KEY;
  if (!amapKey) {
    return json({ status: '0', info: 'AMAP_KEY_NOT_CONFIGURED' }, 500);
  }

  // 4. 限流：基于 Cache API 做滑动窗口计数
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const bucket = Math.floor(Date.now() / 1000 / RATE_LIMIT_WINDOW);
  const rateKey = new Request('https://rl.local/' + ip + '/' + bucket, request);
  const cache = caches.default;
  const cached = await cache.match(rateKey);
  let count = cached ? parseInt(await cached.text(), 10) : 0;
  if (count >= RATE_LIMIT_MAX) {
    return json({ status: '0', info: 'RATE_LIMITED', msg: '请求过于频繁，请稍后再试' }, 429);
  }
  count++;
  // 写入计数（窗口到期自动失效）
  await cache.put(rateKey, new Response(String(count), {
    headers: { 'Cache-Control': 'max-age=' + RATE_LIMIT_WINDOW }
  }));

  // 5. 构造上游 URL：剥离 key/callback，附加服务端 Key
  const reqUrl = new URL(request.url);
  const upstream = new URL('https://restapi.amap.com/v3' + amapPath);
  reqUrl.searchParams.forEach((v, k) => {
    if (k !== 'key' && k !== 'callback') {
      upstream.searchParams.set(k, v);
    }
  });
  upstream.searchParams.set('key', amapKey);

  // 6. 转发到高德（边缘缓存 60s）
  try {
    const resp = await fetch(upstream.toString(), {
      method: 'GET',
      headers: { 'User-Agent': 'Cena-Pages-Function/1.0' },
      cf: { cacheTtl: UPSTREAM_TTL, cacheEverything: true }
    });
    const text = await resp.text();
    return new Response(text, {
      status: resp.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=' + UPSTREAM_TTL
      }
    });
  } catch (e) {
    return json({ status: '0', info: 'UPSTREAM_ERROR', detail: e.message }, 502);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
