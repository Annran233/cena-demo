/* ui/nearby.js — 周边推荐列表（按 Haversine 距离排序）
   依赖：core/geo.js, core/status.js, ui/map.js, ui/panel.js (openPanel)
   复赛迁移：web/src/components/NearbyList.ts
*/

function renderNearbyList() {
  const allToilets = getAllToilets();
  // 筛选 → 计算距离 → 按距离升序排序
  const items = allToilets
    .filter(toiletPassesFilter)
    .map(t => {
      const dist = t._dist || haversine(searchCenter[0], searchCenter[1], t.lat, t.lng);
      return { t, dist };
    })
    .sort((a, b) => a.dist - b.dist);

  document.getElementById('nearbyTitle').textContent = searchCenterName + '附近厕所';

  const container = document.getElementById('nearbyItems');
  // 空数据处理
  if (items.length === 0) {
    container.innerHTML = '<div style="padding:14px;color:var(--text-sub);font-size:13px;text-align:center;">附近暂无厕所数据</div>';
    return;
  }

  // 移动端限流：屏幕小，列表太长影响体验，最多显示 20 条
  const MOBILE_MAX = 20;
  const isMobile = window.innerWidth < 768;
  const totalCount = items.length;
  // 桌面端不限制（取全部），移动端取最近的 N 条
  const displayItems = isMobile ? items.slice(0, MOBILE_MAX) : items;
  const displayCount = displayItems.length;
  // 是否触发了截断（仅移动端且总数超过限制时为 true）
  const isTruncated = isMobile && totalCount > displayCount;

  // 渲染列表项（idx 为显示序号，用于编号）
  container.innerHTML = displayItems.map((item, idx) => {
    const t = item.t;
    const d = formatDist(item.dist);
    const cls = markerClass(t);
    const numCls = cls;
    const subParts = [];
    if (t.source === 'amap-live') {
      subParts.push('🟣 实时');
    } else {
      const st = statusMeta(t);
      subParts.push(st.emoji + ' ' + st.label);
    }
    if (t.accessible) subParts.push('♿');
    if (t.family) subParts.push('👨‍👩‍👧');
    if (t.water) subParts.push('🚐');
    const distText = d.text.replace(/([0-9.]+)(.*)/, '<span class="dist-num">$1</span>$2');
    return `
      <div class="nearby-item" data-id="${t.id}">
        <div class="nearby-item__num ${numCls}">${idx + 1}</div>
        <div class="nearby-item__body">
          <div class="nearby-item__name">${t.name}</div>
          ${t.desc ? `<div class="nearby-item__desc">${t.desc}</div>` : ''}
          <div class="nearby-item__sub">${subParts.join(' · ')}</div>
        </div>
        <div class="nearby-item__dist">${distText}<span class="nearby-item__walk">${d.walk}</span></div>
      </div>
    `;
  }).join('') + (isTruncated
    // 截断时在列表底部追加提示：灰色小字、居中、padding 与空数据样式一致
    ? `<div style="padding:14px;color:var(--text-sub);font-size:13px;text-align:center;">已显示最近 ${displayCount} 条，共 ${totalCount} 条</div>`
    : '');

  // 仅对实际渲染出的 nearby-item 绑定点击事件（提示 div 不含 .nearby-item，不会被绑定）
  container.querySelectorAll('.nearby-item').forEach(el => {
    el.addEventListener('click', () => {
      const t = getAllToilets().find(x => x.id === el.dataset.id);
      if (t) {
        map.setView([t.lat, t.lng], 17);
        openPanel(t);
        const list = document.getElementById('nearbyList');
        list.classList.add('is-collapsed');
      }
    });
  });
}

function toggleNearbyList() {
  const list = document.getElementById('nearbyList');
  list.classList.toggle('is-collapsed');
}

function expandNearbyList() {
  document.getElementById('nearbyList').classList.remove('is-collapsed');
}

/* 收起周边列表（移动端点击 marker 时调用，列表收到底部不遮挡地图） */
function collapseNearbyList() {
  document.getElementById('nearbyList').classList.add('is-collapsed');
}
