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

  // 5. 地铁站点厕所：作为附近POI参与距离排序和列表渲染
  //    坐标为GCJ-02（与地图一致），3km距离过滤，id以metro_前缀避免冲突
  const metroStations = (typeof getAllMetroStations === 'function' ? getAllMetroStations() : [])
    .filter(s => {
      const d = haversine(searchCenter[0], searchCenter[1], s.lat, s.lng);
      return d <= 3000;
    })
    .map(s => ({
      id: 'metro_' + s.lineKey + '_' + s.name,
      name: s.name + '站·' + s.lineName,
      lat: s.lat,
      lng: s.lng,
      source: 'metro',
      status: s.type === 'none' ? 'unknown' : 'open',
      accessible: false,
      family: false,
      water: false,
      rating: 0,
      confidence: 0.5,
      last_update: Date.now(),
      created_by: 'metro',
      address: s.detail || '',
      _isMetro: true,
      _metroType: s.type,
      _metroLine: s.lineName,
      _metroLineKey: s.lineKey,
      _metroLineColor: s.lineColor
    }));

  return [...visibleUser, ...liveWithSupplements, ...nearbyMock, ...metroStations];
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

  // 排除地铁站点POI：它们由地铁图层独立渲染circleMarker，不参与普通marker聚合
  getAllToilets().filter(t => !t._isMetro).filter(toiletPassesFilter).forEach(t => {
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
let metroLayerGroup = null; // 图层组：线路 polyline（底）+ 站点圆点（顶）

/* Cardinal/Catmull-Rom 样条插值：三次Hermite曲线，严格经过所有控制点
   - points: [[lat,lng], ...]  必须经过的锚点（站点坐标）
   - tension: 0=标准Catmull-Rom（最自然），越大越紧绷，1退化为折线
   - segments: 每段之间细分数（值越大越平滑，20段足够肉眼光滑）
   端点处理：首尾切线用相邻段方向延伸（phantom point），保证首末锚点也在曲线上 */
function cardinalSpline(points, tension, segments) {
  if (!points || points.length < 2) return points ? points.slice() : [];
  if (points.length === 2) return points.slice();
  const t = tension == null ? 0 : tension;
  const n = points.length;
  const result = [];
  /* 每三个相邻点（含phantom端点）算一段贝塞尔 */
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < n ? i + 2 : i + 1];
    /* 起点p1只在第一段加入（避免重复） */
    if (i === 0) result.push([p1[0], p1[1]]);
    /* 在p1→p2之间均匀采样segments段 */
    for (let s = 1; s <= segments; s++) {
      const tt = s / segments;
      const tt2 = tt * tt;
      const tt3 = tt2 * tt;
      /* Cardinal 基函数矩阵（tension参数化） */
      const s0 = -t * tt3 + 2 * t * tt2 - t * tt;
      const s1 = (2 - t) * tt3 + (t - 3) * tt2 + 1;
      const s2 = (t - 2) * tt3 + (3 - 2 * t) * tt2 + t * tt;
      const s3 = t * tt3 - t * tt2;
      result.push([
        s0 * p0[0] + s1 * p1[0] + s2 * p2[0] + s3 * p3[0],
        s0 * p0[1] + s1 * p1[1] + s2 * p2[1] + s3 * p3[1]
      ]);
    }
  }
  return result;
}

/* 渲染轨道交通图层（线路 polyline + 站点圆点，polyline 不拦截交互） */
/* 地铁站点 circleMarker 引用表（用于选中高亮/取消高亮） */
let _metroCircleMarkers = [];
let _selectedMetroCircle = null;

function renderMetroLayer() {
  if (metroLayerGroup) map.removeLayer(metroLayerGroup);
  metroLayerGroup = L.layerGroup();
  _metroCircleMarkers = [];
  _selectedMetroCircle = null;

  Object.keys(METRO_LINES).forEach(lineKey => {
    const line = METRO_LINES[lineKey];
    /* 站点锚点：必须严格经过 */
    const anchors = line.stations.map(s => [s.lat, s.lng]);
    /* Cardinal样条平滑：tension=0.3（微紧，偏离小），每段20细分 */
    const smoothPath = cardinalSpline(anchors, 0.3, 20);
    // 绘制线路 polyline：interactive:false 不拦截点击，不影响地图拖拽和站点点击
    if (smoothPath.length >= 2) {
      L.polyline(smoothPath, {
        color: line.color,
        weight: 5,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false
      }).addTo(metroLayerGroup);
    }
    // 站点圆点在 polyline 上方绘制（zIndexOffset 高于 polyline，直接覆盖在线上）
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
        highlightMetroCircle(circle);
        openMetroPanel(s, line);
      });
      circle.addTo(metroLayerGroup);
      // 存储引用：用于从附近列表点击时高亮
      _metroCircleMarkers.push({ circle, station: s, line, lineKey });
    });
  });

  metroLayerGroup.addTo(map);
}

/* 高亮地铁站点 circleMarker：放大半径+加粗白边，与普通 marker is-selected 视觉一致 */
function highlightMetroCircle(circle) {
  // 先恢复上一个选中的圆点
  if (_selectedMetroCircle && _selectedMetroCircle !== circle) {
    _selectedMetroCircle.setStyle({ radius: 7, weight: 2.5 });
  }
  // 高亮当前圆点：半径 9 + 白边 4px（模拟 marker is-selected 的白色光环）
  circle.setStyle({ radius: 9, weight: 4 });
  _selectedMetroCircle = circle;
}

/* 清除轨道交通图层 */
function clearMetroLayer() {
  if (metroLayerGroup) {
    map.removeLayer(metroLayerGroup);
    metroLayerGroup = null;
  }
}

/* 从附近列表点击地铁站点时触发：找到原始站点数据+circleMarker，高亮并打开面板 */
function triggerMetroStationClick(lineKey, stationName) {
  if (!METRO_LINES[lineKey]) return;
  const line = METRO_LINES[lineKey];
  const station = line.stations.find(s => s.name === stationName);
  if (!station) return;
  // 找到对应的 circleMarker 并高亮
  const found = _metroCircleMarkers.find(m => m.lineKey === lineKey && m.station.name === stationName);
  if (found) highlightMetroCircle(found.circle);
  openMetroPanel(station, line);
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

  // 根据线路区分 subtitle 和 hint 文案
  const isLine9 = line.name.includes('9号线');
  const subtitle = station.type === 'none'
    ? '暂不具备设置条件'
    : (isLine9 ? '站内标配厕所' : '环评标配厕所（新线）');
  const hintText = station.type === 'none'
    ? (isLine9 ? '💡 9号线21站中仅小东庄、胡家园无厕所，其余19站均有' : '')
    : (isLine9 ? '💡 数据来源：天津轨道交通运营集团（厕所位置以站内指引为准）' : '💡 Z4线2026年新开通，环评标配厕所，具体位置以站内指引为准');

  body.innerHTML = `
    <div class="panel__title-row">
      <h2 class="panel__title">${station.name}站</h2>
      <button id="navBtn" class="nav-btn" type="button" aria-label="导航前往" title="导航前往"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M21.71 11.29l-9-9a1 1 0 00-1.42 0l-9 9a1 1 0 000 1.42l9 9a1 1 0 001.42 0l9-9a1 1 0 000-1.42zM14 14.5V12h-4v3H8v-4a1 1 0 011-1h5V7.5l3.5 3.5z"/></svg></button>
    </div>
    <div class="panel__addr">${line.name} · ${subtitle}</div>
    <div class="meta">
      <span class="tag" style="background:${statusColor}22;color:${statusColor};">${statusEmoji} ${statusLabel}</span>
      <span class="tag" style="background:${line.color}22;color:${line.color};">🚇 ${line.name}</span>
    </div>
    <div class="info-row"><span class="k">位置描述</span><span class="v" style="font-size:var(--fs-sm);line-height:1.5;">${station.detail}</span></div>
    <div class="info-row"><span class="k">线路信息</span><span class="v">共${line.stations.length}站</span></div>
    <div class="panel__divider"></div>
    <div class="panel__hint" style="font-size:12px;color:var(--text-hint);text-align:center;padding:8px 0;">
      ${hintText}
    </div>
  `;

  // 导航按钮：复用 showNavActionSheet，传入站点坐标和名称
  const navBtn = body.querySelector('#navBtn');
  if (navBtn) {
    navBtn.addEventListener('click', () => showNavActionSheet({
      lat: station.lat,
      lng: station.lng,
      name: station.name + '站'
    }));
  }

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
