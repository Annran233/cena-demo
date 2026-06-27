/* ui/map.js — 地图渲染逻辑（变量声明 + 函数定义，初始化在 app.js）
   依赖：core/geo.js, core/status.js, data/toilets.js, ui/panel.js (openPanel)
   复赛迁移：web/src/components/Map.ts
*/

let map, markers = [], currentFilter = 'all', liveToilets = [], liveToiletIdCounter = 0;
let clusterGroup = null; // 聚合图层（低缩放级别时使用）
let pickPinMarker = null; // 上报拾取图钉（可拖动）
let pickMapClickHandler = null; // 拾取模式下地图点击 handler
let selectedToiletId = null; // 当前选中厕所 ID（renderMarkers 后自动恢复高亮）

function getAllToilets() {
  // 合并顺序：userToilets（持久化，最高优先级）→ liveToilets（实时搜索）→ MOCK_TOILETS
  // 去重规则：userToilets 中的 promoted 点位有 originalId 字段，
  //   对应 MOCK/live 中同 id 的原始点位应被过滤（避免重复 marker / 旧状态覆盖）
  //   同时保留 name 去重兜底（处理同名但无 originalId 的情况）
  // 距离过滤：三类点位统一以 searchCenter 为中心 3km 半径，避免跨城市显示

  // 1. userToilets：过滤 archived（90天无确认归档）+ 3km 距离范围
  const visibleUser = userToilets.filter(t => {
    if (pointTier(t) === 'archived') return false;
    const d = haversine(searchCenter[0], searchCenter[1], t.lat, t.lng);
    return d <= 3000;
  });

  // 2. 从附近用户点位和 liveToilets 收集已出现的 id/name（用于去重，避免重复 marker）
  const userOriginalIds = new Set();
  const userNames = new Set();
  for (const ut of visibleUser) {
    if (ut.originalId) userOriginalIds.add(ut.originalId);
    userNames.add(ut.name);
  }
  const liveIds = new Set();
  const liveNames = new Set();
  for (const lt of liveToilets) {
    liveIds.add(lt.id);
    liveNames.add(lt.name);
  }

  // 3. liveToilets：去重 + 3km 安全距离过滤（本地筛选已限 3km，加边界兜底）
  const liveWithSupplements = liveToilets
    .filter(t => {
      if (userOriginalIds.has(t.id) || userNames.has(t.name)) return false;
      const d = haversine(searchCenter[0], searchCenter[1], t.lat, t.lng);
      return d <= 3000;
    })
    .map(t => { const copy = { ...t }; applySupplementToToilet(copy); applyDescSupplementToToilet(copy); return copy; });

  // 4. MOCK_TOILETS：3km 距离 + 去重（排除 userToilets 和 liveToilets 中已有的），应用补充标签
  const nearbyMock = MOCK_TOILETS.filter(t => {
    const d = haversine(searchCenter[0], searchCenter[1], t.lat, t.lng);
    return d <= 3000
      && !userOriginalIds.has(t.id) && !userNames.has(t.name)
      && !liveIds.has(t.id) && !liveNames.has(t.name);
  }).map(t => {
    const copy = { ...t };
    applySupplementToToilet(copy);
    applyDescSupplementToToilet(copy);
    return copy;
  });

  return [...visibleUser, ...liveWithSupplements, ...nearbyMock];
}

/* 清除所有 marker（含聚合层） */
function clearMarkers() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  if (clusterGroup) clusterGroup.clearLayers();
}

/* 高亮选中厕所的 marker：放大 + 白色脉冲光环，在密集 POI 中一眼可辨 */
function highlightMarker(toiletId) {
  selectedToiletId = toiletId;
  applyHighlight();
}

/* 内部：将 is-selected class 应用到对应 marker DOM */
function applyHighlight() {
  // 先清除旧高亮
  document.querySelectorAll('.toilet-marker.is-selected').forEach(el => {
    el.classList.remove('is-selected');
    const parent = el.closest('.leaflet-marker-icon');
    if (parent) parent.style.zIndex = '';
  });
  if (!selectedToiletId) return;
  // 遍历直显 marker（聚合态下 marker DOM 不存在，高亮无意义）
  const target = markers.find(m => m._toiletId === selectedToiletId);
  if (!target) return;
  const el = target.getElement();
  if (!el) return;
  const dot = el.querySelector('.toilet-marker');
  if (!dot) return;
  dot.classList.add('is-selected');
  // 提升 marker 层级，确保光环不被相邻 marker 遮挡
  el.style.zIndex = 1000;
}

/* 清除选中高亮 */
function clearMarkerHighlight() {
  selectedToiletId = null;
  applyHighlight();
}

/* 聚合图标：MD3 Badge 风格，根据聚合内点位主状态决定颜色，数量级决定尺寸 */
function createClusterIcon(cluster) {
  const children = cluster.getAllChildMarkers();
  const count = children.length;
  let greenCount = 0, redCount = 0, uncertainCount = 0, grayCount = 0;
  children.forEach(m => {
    const html = m.options.icon && m.options.icon.options && m.options.icon.options.html;
    if (html && html.includes('green')) greenCount++;
    else if (html && html.includes('red')) redCount++;
    else if (html && html.includes('uncertain')) uncertainCount++;
    else grayCount++;
  });
  let cls = 'green';
  const max = Math.max(greenCount, redCount, uncertainCount, grayCount);
  if (max === greenCount) cls = 'green';
  else if (max === redCount) cls = 'red';
  else if (max === uncertainCount) cls = 'uncertain';
  else cls = 'gray';

  let size;
  if (count < 10) size = 36;
  else if (count < 50) size = 40;
  else if (count < 100) size = 44;
  else size = 48;
  const half = size / 2;
  const label = count > 99 ? '99+' : count;
  const fontSize = count < 10 ? 14 : count < 50 ? 13 : count < 100 ? 12 : 11;

  return L.divIcon({
    className: 'toilet-cluster-icon',
    html: '<div class="toilet-cluster ' + cls + '" style="width:' + size + 'px;height:' + size + 'px;font-size:' + fontSize + 'px;line-height:' + size + 'px;">' + label + '</div>',
    iconSize: [size, size],
    iconAnchor: [half, half]
  });
}

function toiletPassesFilter(t) {
  switch (currentFilter) {
    case 'accessible': return t.accessible;
    case 'family': return t.family;
    case 'water': return t.water;
    case 'open': return t.status === 'open';
    default: return true;
  }
}

/* 渲染 marker：zoom<14 聚合，zoom≥14 直显；无 emoji，响应式 icon 尺寸 */
function renderMarkers() {
  clearMarkers();
  const useCluster = map.getZoom() < 14; // 低缩放级别启用聚合
  // 响应式 icon：移动端 28px 正圆居中锚点，桌面端 30px 水滴底部锚点
  const isMobile = window.innerWidth < 768;
  const iconSize = isMobile ? [28, 28] : [30, 30];
  const iconAnchor = isMobile ? [14, 14] : [15, 30];

  getAllToilets().filter(toiletPassesFilter).forEach(t => {
    const cls = markerClass(t);
    const icon = L.divIcon({
      className: '',
      html: '<div class="toilet-marker ' + cls + '"></div>',
      iconSize: iconSize,
      iconAnchor: iconAnchor,
      popupAnchor: [0, -iconAnchor[1]]
    });
    const m = L.marker([t.lat, t.lng], { icon });
    m._toiletId = t.id;  // 保存 toiletId 用于选中高亮查找
    m.on('click', () => {
      openPanel(t);
      collapseNearbyList(); // 移动端：点击 marker 收起列表，不遮挡地图
    });
    // 聚合模式下，选中的 marker 单独直显（不被收进 cluster），保持高亮可见
    if (useCluster && t.id !== selectedToiletId) {
      clusterGroup.addLayer(m);
    } else {
      m.addTo(map);
      markers.push(m);
    }
  });
  // marker 重建后恢复选中态（setView/zoomend 触发的重渲染不丢失高亮）
  applyHighlight();
}

/* ============ 上报拾取模式 ============ */
/* 进入拾取模式：放置可拖动图钉，点击地图移动图钉，坐标实时回调 */
function startPickMode(coords, onMove) {
  clearPickMode();
  // 复用 search-pin 样式，标签改为"上报位置"，emoji 用📍
  const pickIcon = L.divIcon({
    className: 'search-pin-marker',
    html: '<div class="search-pin"><div class="search-pin__head"><span class="emoji">📍</span></div><div class="search-pin__label">上报位置</div></div>',
    iconSize: [80, 65],
    iconAnchor: [40, 36]
  });
  pickPinMarker = L.marker(coords, { icon: pickIcon, draggable: true, zIndexOffset: 1000 }).addTo(map);
  // 拖动图钉 → 坐标实时更新
  pickPinMarker.on('drag', () => {
    const pos = pickPinMarker.getLatLng();
    onMove([pos.lat, pos.lng]);
  });
  // 点击地图 → 图钉移动到点击位置
  pickMapClickHandler = (e) => {
    pickPinMarker.setLatLng(e.latlng);
    onMove([e.latlng.lat, e.latlng.lng]);
  };
  map.on('click', pickMapClickHandler);
}

/* 退出拾取模式：移除图钉和地图点击监听 */
function clearPickMode() {
  if (pickMapClickHandler) {
    map.off('click', pickMapClickHandler);
    pickMapClickHandler = null;
  }
  if (pickPinMarker) {
    map.removeLayer(pickPinMarker);
    pickPinMarker = null;
  }
}

/* 获取当前拾取坐标 */
function getPickCoords() {
  if (!pickPinMarker) return null;
  const pos = pickPinMarker.getLatLng();
  return [pos.lat, pos.lng];
}

/* ============ 轨道交通图层 ============ */
let metroLayerGroup = null; // 图层组：仅包含站点圆点（线路由高德底图原生显示）

/* 渲染轨道交通图层（仅站点圆点，线路复用高德底图原生地铁线路） */
function renderMetroLayer() {
  if (metroLayerGroup) map.removeLayer(metroLayerGroup);
  metroLayerGroup = L.layerGroup();

  Object.keys(METRO_LINES).forEach(lineKey => {
    const line = METRO_LINES[lineKey];
    // 不绘制polyline：高德底图已原生显示地铁线路，自画线条因坐标精度问题无法与底图拟合
    // 仅绘制站点圆点，z-index 高于厕所marker但不拦截地图拖拽
    line.stations.forEach(s => {
      const color = METRO_COLORS[s.type] || '#999';
      const circle = L.circleMarker([s.lat, s.lng], {
        radius: 7,
        fillColor: color,
        color: '#ffffff',
        weight: 2.5,
        opacity: 1,
        fillOpacity: 0.95,
        zIndexOffset: 500
      });
      circle.bindTooltip(s.name + ' · ' + line.name, {
        direction: 'top',
        offset: [0, -10],
        opacity: 0.92
      });
      circle.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        openMetroPanel(s, line);
      });
      circle.addTo(metroLayerGroup);
    });
  });

  metroLayerGroup.addTo(map);
}

/* 清除轨道交通图层 */
function clearMetroLayer() {
  if (metroLayerGroup) {
    map.removeLayer(metroLayerGroup);
    metroLayerGroup = null;
  }
}

/* 打开地铁站点详情面板（轻量，复用现有 panel DOM） */
function openMetroPanel(station, line) {
  // 先清理现有面板状态
  closePanel();
  clearMarkerHighlight();
  document.getElementById('nearbyList').style.display = 'none';

  const panel = document.getElementById('panel');
  const body = document.getElementById('panelBody');

  const statusColor = METRO_COLORS[station.type] || '#999';
  const statusLabel = station.type === 'inside' ? '站内有厕所' : station.type === 'outside' ? '车站外厕所' : '无厕所';
  const statusEmoji = station.type === 'inside' ? '🟢' : station.type === 'outside' ? '🟡' : '🔴';

  body.innerHTML = `
    <div class="panel__header">
      <div class="panel__title">${station.name}</div>
      <div class="panel__subtitle">${line.name} · ${station.type === 'none' ? '暂不具备设置条件' : '环评标配厕所'}</div>
    </div>
    <div class="metro-panel__status" style="display:flex;align-items:center;gap:8px;padding:12px 0;">
      <span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${statusColor};border:2px solid #fff;box-shadow:0 0 0 1px var(--md-outline-variant);flex-shrink:0;"></span>
      <span style="font-size:15px;font-weight:500;">${statusEmoji} ${statusLabel}</span>
    </div>
    <div class="metro-panel__detail" style="padding:10px 14px;background:var(--md-surface-container-low);border-radius:12px;font-size:13px;line-height:1.6;color:var(--md-on-surface-variant);">
      ${station.detail}
    </div>
    <div class="metro-panel__line-info" style="margin-top:12px;display:flex;align-items:center;gap:6px;font-size:13px;color:var(--md-on-surface-variant);">
      <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${line.color};flex-shrink:0;"></span>
      <span>${line.name} · 共${line.stations.length}站</span>
    </div>
    <div class="panel__divider"></div>
    <div class="panel__hint" style="font-size:12px;color:var(--text-hint);text-align:center;padding:8px 0;">
      ${station.type === 'none' ? '💡 21站中仅小东庄、胡家园无厕所，其余19站均有' : '💡 数据来源：天津轨道交通运营集团 & Z4线环评文件'}
    </div>
  `;

  // 显示面板：移动端用 half snap，桌面端直接显示
  if (window.innerWidth < 768) {
    panel.classList.add('is-show', 'is-half');
    panel.style.transform = '';
    if (window._setPanelSnap) window._setPanelSnap('half', false);
  } else {
    panel.classList.add('is-show', 'is-half');
    panel.style.transform = '';
  }
}

/* 切换轨道交通图层激活/关闭 */
let _metroLayerActive = false;
function toggleMetroLayer() {
  _metroLayerActive = !_metroLayerActive;
  if (_metroLayerActive) {
    renderMetroLayer();
    showToast('🚇 轨道交通图层已开启 | 点击圆点查看厕所分布');
  } else {
    clearMetroLayer();
    showToast('轨道交通图层已关闭');
  }
  // 按钮 active 态由 app.js 的 toggle 逻辑设置
  return _metroLayerActive;
}

/* 获取当前地铁图层状态（供 app.js 恢复按钮状态） */
function isMetroLayerActive() {
  return _metroLayerActive;
}
