/* ui/nearby.js — 周边推荐列表（按 Haversine 距离排序）
   依赖：core/geo.js, core/status.js, ui/map.js, ui/panel.js (openPanel)
   复赛迁移：web/src/components/NearbyList.ts
*/

function renderNearbyList() {
  const allToilets = getAllToilets();
  const items = allToilets
    .filter(toiletPassesFilter)
    .map(t => {
      const dist = t._dist || haversine(searchCenter[0], searchCenter[1], t.lat, t.lng);
      return { t, dist };
    })
    .sort((a, b) => a.dist - b.dist);

  document.getElementById('nearbyTitle').textContent = searchCenterName + '附近厕所';

  const container = document.getElementById('nearbyItems');
  if (items.length === 0) {
    container.innerHTML = '<div style="padding:14px;color:var(--text-sub);font-size:13px;text-align:center;">附近暂无厕所数据</div>';
    return;
  }

  container.innerHTML = items.map((item, idx) => {
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
  }).join('');

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
