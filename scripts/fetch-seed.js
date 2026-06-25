/* scripts/fetch-seed.js — 一次性拉取滨海新区公厕种子数据
   用法：node scripts/fetch-seed.js
   从部署后的代理 API 拉取 5 个热点区域公厕，去重后输出到 src/data/toilets-seed.json
   拉取后手动合并到 toilets.js 的 MOCK_TOILETS（保留有评论/状态的经典点位）

   坐标说明：
   - 高德 around API 接收 GCJ-02 坐标（location=lng,lat）
   - 返回的 location 也是 GCJ-02
   - toilets.js 中 MOCK_TOILETS 的坐标是 WGS-84（app.js 统一转 GCJ-02）
   - 本脚本拉取后需把 GCJ-02 反转回 WGS-84 写入 MOCK_TOILETS

   反转公式：gcj02ToWgs84（近似逆变换，误差 < 1m，足够种子数据用）*/
const fs = require('fs');
const path = require('path');

const PROXY = 'https://cenad.meowoflow.top/api/amap/place/around';
// 5 个热点区域中心（GCJ-02 [lng, lat]）
const HOTSPOTS = [
  { name: '塘沽外滩', lng: 117.7117, lat: 39.0259 },
  { name: '泰达开发区', lng: 117.7150, lat: 39.0720 },
  { name: '北塘', lng: 117.7500, lat: 39.1030 },
  { name: '大港', lng: 117.5450, lat: 38.8400 },
  { name: '汉沽', lng: 117.7900, lat: 39.2500 },
];

// GCJ-02 → WGS-84 近似逆变换（粗略反推，误差 <1m）
function gcj02ToWgs84(lng, lat) {
  // 简单迭代法：WGS-84 → GCJ-02 的正变换已知，用一次减法近似逆变换
  // 精度足够种子数据（实际点位运行时会用 around API 实时拉取）
  const [gLat, gLng] = [lat, lng];  // 输入是 GCJ-02
  // 用正变换算偏移量，然后反向减去
  // 这里直接调用正变换逻辑（复制自 geo.js）
  const GCJ_A = 6378245.0;
  const GCJ_EE = 0.00669342162296594323;
  function _transformLat(x, y) {
    let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0;
    ret += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0;
    return ret;
  }
  function _transformLng(x, y) {
    let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0;
    ret += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0;
    return ret;
  }
  function wgs84ToGcj02(lng, lat) {
    if (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271) return [lat, lng];
    let dLat = _transformLat(lng - 105.0, lat - 35.0);
    let dLng = _transformLng(lng - 105.0, lat - 35.0);
    const radLat = lat / 180.0 * Math.PI;
    let magic = Math.sin(radLat);
    magic = 1 - GCJ_EE * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / ((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic) * Math.PI);
    dLng = (dLng * 180.0) / (GCJ_A / sqrtMagic * Math.cos(radLat) * Math.PI);
    return [lat + dLat, lng + dLng];
  }
  // 逆变换：近似 WGS-84 = GCJ-02 - (GCJ-02(WGS-84) - WGS-84) ≈ GCJ-02 - 偏移量
  // 先用 GCJ-02 当 WGS-84 算一次正变换得到偏移量，再减去
  const [estLat, estLng] = wgs84ToGcj02(gLng, gLat);
  return [gLat - (estLat - gLat), gLng - (estLng - gLng)];
}

async function fetchAround(hotspot) {
  const url = `${PROXY}?location=${hotspot.lng},${hotspot.lat}&keywords=厕所&radius=3000&offset=25&page=1&extensions=base&sortrule=distance`;
  console.log(`[fetch] ${hotspot.name} ...`);
  try {
    const r = await fetch(url);
    const data = await r.json();
    if (data.status === '1' && data.pois) {
      console.log(`  → ${data.pois.length} 条`);
      return data.pois;
    }
    console.log(`  → 0 条 (${data.info})`);
    return [];
  } catch (e) {
    console.log(`  → 失败: ${e.message}`);
    return [];
  }
}

(async () => {
  const all = new Map();  // 按 id 去重
  for (const h of HOTSPOTS) {
    const pois = await fetchAround(h);
    for (const p of pois) {
      if (all.has(p.id)) continue;
      const [lngStr, latStr] = p.location.split(',');
      const lng = parseFloat(lngStr), lat = parseFloat(latStr);
      const [wLat, wLng] = gcj02ToWgs84(lng, lat);
      all.set(p.id, {
        originalId: p.id,
        name: p.name,
        lat: parseFloat(wLat.toFixed(6)),
        lng: parseFloat(wLng.toFixed(6)),
        address: p.address || '',
        typecode: p.typecode,
        distance: p.distance ? parseInt(p.distance) : null,
        source_hotspot: h.name
      });
    }
  }
  const result = Array.from(all.values());
  // 按距离排序（有 distance 的在前）
  result.sort((a, b) => (a.distance || 99999) - (b.distance || 99999));
  const out = {
    fetched_at: new Date().toISOString(),
    total: result.length,
    hotspots: HOTSPOTS.map(h => h.name),
    pois: result
  };
  const outPath = path.join(__dirname, '..', 'src', 'data', 'toilets-seed.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(`\n[done] ${result.length} 条种子数据 → ${outPath}`);
  console.log(`  覆盖热点：${HOTSPOTS.map(h => h.name).join(' / ')}`);
})();
