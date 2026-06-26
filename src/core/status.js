/* core/status.js — 状态分层 + 映射（spotlight 平衡核心）
   依赖：core/geo.js (daysSince)
   复赛迁移：packages/core/status.ts
*/

const STATUS_MAP = {
  open:    { label: '开放中', cls: 'status-open',    emoji: '🟢' },
  locked:  { label: '已锁门', cls: 'status-locked',  emoji: '🔴' },
  closed:  { label: '暂停营业', cls: 'status-locked', emoji: '🔴' },
  repair:  { label: '维修中', cls: 'status-repair',  emoji: '🟠' },
  removed: { label: '已拆除', cls: 'status-removed', emoji: '⚫' },
  unknown: { label: '未知',   cls: 'status-unknown', emoji: '⚪' }
};

const SOURCE_MAP = {
  'amap':       { label: '地图数据', cls: 'source-amap' },
  'user':       { label: '用户上报', cls: 'source-user' },
  'amap+user':  { label: '地图+用户', cls: 'source-amap' },
  'amap-live':  { label: '实时搜索', cls: 'source-live' }
};

const REMOVED_RECHECK_WINDOW = 7;

function removedTier(t) {
  const cc = t.confirm_count || 1;
  if (cc >= 2) return 'confirmed';
  const days = daysSince(t.last_removed_report_time || t.last_update);
  if (days >= REMOVED_RECHECK_WINDOW) return 'stale';
  return 'suspected';
}

function recoveryTier(t) {
  if (t.status !== 'open' || !t.recovery_count) return null;
  // 防御性检查：时间戳缺失（旧版 localStorage 数据/数据损坏）时视为无效，降级到默认状态
  if (!t.last_recovery_report_time) return null;
  const rc = t.recovery_count;
  if (rc >= 2) return 'confirmed';
  const days = daysSince(t.last_recovery_report_time);
  if (days >= REMOVED_RECHECK_WINDOW) return 'stale';
  return 'suspected';
}

/* ============ 点位真伪分层（pending→suspected→verified→stale→archived） ============ */
const POINT_VERIFY_WINDOW = 30;      // 30 天无确认降级 stale
const POINT_ARCHIVE_WINDOW = 90;     // 90 天无确认归档移除
const POINT_CONFIRM_THRESHOLD = 2;   // ≥2 人独立确认升 verified

function pointTier(t) {
  // 纯高德数据默认已验证（无众包修改）
  // amap+user（地图+用户众包）和 user（纯用户上报）需要走确认分层
  if (t.source === 'amap' || t.source === 'amap-live') {
    // 纯地图来源：如果有用户状态变更记录（confirm_count > 0），也走分层
    if ((t.confirm_count || 0) === 0 && (t.recovery_count || 0) === 0) return 'verified';
  }
  const confirms = t.confirm_count || 0;
  if (confirms >= POINT_CONFIRM_THRESHOLD) return 'verified';
  if (confirms === 1) return 'suspected';
  const days = daysSince(t.last_update);
  if (days >= POINT_ARCHIVE_WINDOW) return 'archived';
  if (days >= POINT_VERIFY_WINDOW) return 'stale';
  return 'pending';
}

/* markerClass — 移动端优先视传：4 个语义颜色
   green=能用  red=不能用  uncertain=不确定  gray=信息不可靠
   注意：source=amap-live 不再单独返回 live，按状态归入 green/red */
function markerClass(t) {
  // 已拆除：按确认程度分层（优先判断，不被 pointTier 覆盖）
  if (t.status === 'removed') {
    const tier = removedTier(t);
    if (tier === 'confirmed') return 'red';       // 多人确认 → 红
    if (tier === 'suspected') return 'uncertain';  // 单人疑似 → 半透明红
    return 'gray';                                  // 超期待复核 → 灰
  }
  // 锁门/暂停营业/维修 → 红（优先判断，不被 pointTier 覆盖）
  if (t.status === 'locked' || t.status === 'closed' || t.status === 'repair') return 'red';
  // 开放中：用户众包相关点位（user / amap+user）按真伪分层映射颜色
  // 纯地图来源（amap / amap-live）且无用户确认记录的默认绿色
  if (t.source === 'user' || t.source === 'amap+user') {
    // 先检查恢复状态（疑似恢复 → 半透明红，恢复超期 → 灰）
    const rt = recoveryTier(t);
    if (rt === 'suspected') return 'uncertain';
    if (rt === 'stale') return 'gray';
    // 再按确认分层
    const pt = pointTier(t);
    if (pt === 'verified') return 'green';
    if (pt === 'stale' || pt === 'archived') return 'gray';
    return 'uncertain';
  }
  // 开放中：纯地图来源，检查恢复状态
  if (t.status === 'open') {
    const rt = recoveryTier(t);
    if (rt === 'suspected') return 'uncertain';
    if (rt === 'stale') return 'gray';
  }
  // 信息过旧 → 灰
  if (isOld(t)) return 'gray';
  // 默认 → 绿（能用）
  return 'green';
}

function statusMeta(t) {
  if (t.status === 'removed') {
    const tier = removedTier(t);
    const cc = t.confirm_count || 1;
    const days = daysSince(t.last_removed_report_time || t.last_update);
    if (tier === 'confirmed') {
      return { label: '已确认拆除', cls: 'status-removed', emoji: '⚫', sub: cc + '人反馈·' + days + '天前' };
    }
    if (tier === 'suspected') {
      return { label: '疑似拆除', cls: 'status-repair', emoji: '🟠', sub: '仅' + cc + '人反馈·' + days + '天前·待二次确认' };
    }
    return { label: '拆除待复核', cls: 'status-unknown', emoji: '⚪', sub: '仅' + cc + '人反馈·' + days + '天前·已降级' };
  }
  const rt = recoveryTier(t);
  if (rt === 'suspected') {
    const rc = t.recovery_count;
    const days = daysSince(t.last_recovery_report_time);
    return { label: '开放中', cls: 'status-open', emoji: '🟢', sub: rc + '人复核·' + days + '天前·待二次确认' };
  }
  if (rt === 'stale') {
    const rc = t.recovery_count;
    const days = daysSince(t.last_recovery_report_time);
    return { label: '开放待复核', cls: 'status-unknown', emoji: '⚪', sub: '仅' + rc + '人复核·' + days + '天前·已降级' };
  }
  return STATUS_MAP[t.status] || STATUS_MAP.unknown;
}
