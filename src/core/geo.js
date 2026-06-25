/* core/geo.js — 坐标转换 + 距离计算 + 时间工具
   依赖：无
   复赛迁移：packages/core/geo.ts（零成本，加类型注解即可）
*/

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

function daysSince(ts) { return Math.floor((Date.now() - ts) / 86400000); }
function isOld(t) { return daysSince(t.last_update) > 30; }

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

function formatDist(m) {
  if (m < 1000) return { text: m + 'm', walk: Math.max(1, Math.round(m/1.2/60)) + '分钟' };
  return { text: (m/1000).toFixed(1) + 'km', walk: Math.max(1, Math.round(m/1.2/60)) + '分钟' };
}

/* 射线法判断点是否在多边形内（地理围栏）
   polygon: [[lat, lng], ...] 顶点数组（首尾可重复可不重复）
   返回 true=在多边形内，false=在外
   边界点视为在内（保守策略，避免误伤边界用户） */
function pointInPolygon(lat, lng, polygon) {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i][1], yi = polygon[i][0];  // lng, lat
    const xj = polygon[j][1], yj = polygon[j][0];
    // 点的 y 在边的 y 范围内（含上端点）
    if ((yi > lat) !== (yj > lat)) {
      // 计算边在该 y 处的 x 坐标（线性插值）
      const xIntersect = xi + (lat - yi) / (yj - yi) * (xj - xi);
      if (lng < xIntersect) inside = !inside;
    }
  }
  return inside;
}
