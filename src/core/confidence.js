/* core/confidence.js — 可信度计算模型（四因子加权，可解释、可应对评审）
   依赖：core/geo.js (daysSince)
   复赛迁移：packages/core/confidence.ts
*/

const SOURCE_BASE = { 'amap': 0.5, 'user': 0.55, 'amap+user': 0.65, 'amap-live': 0.4 };

function freshnessDecay(ts) {
  const d = daysSince(ts);
  if (d <= 7) return 0;      // 一周内：不衰减
  if (d <= 30) return 0.1;   // 一月内：轻微衰减
  if (d <= 90) return 0.2;   // 三月内：明显衰减
  return 0.3;                // 超三月：严重衰减
}

function computeConfidence(t) {
  let c = SOURCE_BASE[t.source] || 0.5;
  const confirms = (t.confirm_count || 0) + (t.recovery_count || 0);
  c += Math.min(0.3, confirms * 0.1);
  c -= freshnessDecay(t.last_update);
  c += Math.min(0.1, (t.comments || []).length * 0.03);
  return Math.max(0, Math.min(1, c));
}
