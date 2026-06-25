/* app.js — 入口：坐标转换 + 地图初始化 + 事件绑定 + 启动
   依赖：所有模块
   复赛迁移：web/src/app.tsx（React 入口）
*/

/* ============ 坐标统一转换：WGS-84 → GCJ-02 ============ */
MOCK_TOILETS.forEach(t => {
  const [glat, glng] = wgs84ToGcj02(t.lng, t.lat);
  t.lat = glat;
  t.lng = glng;
});

let USER_LOC = wgs84ToGcj02(USER_LOC_WGS[1], USER_LOC_WGS[0]);
const CENTER = [USER_LOC[0], USER_LOC[1]];
window._hasGpsFix = false;

const PRESET_LOCATIONS = {};
Object.keys(PRESET_LOCATIONS_RAW).forEach(k => {
  const [lat, lng] = PRESET_LOCATIONS_RAW[k];
  PRESET_LOCATIONS[k] = wgs84ToGcj02(lng, lat);
});

/* ============ 地图初始化 ============ */
map = L.map('map', { zoomControl: true, attributionControl: false }).setView(CENTER, 15);
L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
  maxZoom: 18, subdomains: ['1', '2', '3', '4'],
  errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
}).addTo(map);

const userIcon = L.divIcon({
  className: '',
  html: '<div class="user-loc"><div class="user-loc__pulse"></div><div class="user-loc__dot"></div></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});
const userLocMarker = L.marker(USER_LOC, { icon: userIcon, zIndexOffset: 1000, interactive: false }).addTo(map);

searchCenter = USER_LOC;

/* 初始化聚合图层：低缩放级别 marker 聚合成 MD3 Badge 风格数字气泡 */
clusterGroup = L.markerClusterGroup({
  maxClusterRadius: 50,
  iconCreateFunction: createClusterIcon,
  spiderfyOnMaxZoom: false,
  showCoverageOnHover: false,
  zoomToBoundsOnClick: true
});
map.addLayer(clusterGroup);

/* ============ 事件绑定 ============ */
document.querySelector('.nearby-list .nearby-list__header').addEventListener('click', toggleNearbyList);

/* 防拖动误触：Leaflet 在拖动地图后有时仍会触发 click，用 dragstart/dragend 标记 */
let _mapDragged = false;
map.on('dragstart', () => { _mapDragged = true; });
map.on('dragend', () => { setTimeout(() => { _mapDragged = false; }, 10); });

/* ============ 移动端长按地图触发周边搜索（避免短按误触） ============ */
/* 移动端地图产品标准选点手势：高德/百度/Google Maps 都用长按选点
   短按只关闭浮层，长按才以坐标为中心搜索周边厕所
   桌面端保持点击触发搜索 */
const _isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
let _mapLongPressTimer = null;
let _mapLongPressTriggered = false; // 长按触发后抑制合成 click
let _mapLongPressStart = null;      // { point, latlng }

if (_isTouchDevice) {
  const container = map.getContainer();
  const MAP_LP_MS = 500;   // 长按阈值
  const MAP_LP_MOVE = 10;  // 移动容差（超过则视为拖动，取消长按）

  container.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    if (pickPinMarker) return; // 拾取模式下由 startPickMode 处理
    const t = e.touches[0];
    const rect = container.getBoundingClientRect();
    const cp = L.point(t.clientX - rect.left, t.clientY - rect.top);
    _mapLongPressStart = { point: cp, latlng: map.containerPointToLatLng(cp) };
    _mapLongPressTriggered = false;
    if (_mapLongPressTimer) clearTimeout(_mapLongPressTimer);
    _mapLongPressTimer = setTimeout(() => {
      _mapLongPressTriggered = true;
      _mapLongPressTimer = null;
      if (navigator.vibrate) navigator.vibrate(30);
      // 长按触发：关闭浮层 + 以长按坐标搜索周边厕所
      closePanel();
      collapseNearbyList();
      document.getElementById('searchSuggest').classList.remove('is-show');
      document.getElementById('filterDropdown').classList.remove('is-show');
      document.getElementById('filterBtn').classList.remove('is-active');
      setSearchCenter([_mapLongPressStart.latlng.lat, _mapLongPressStart.latlng.lng], '长按位置', Math.max(map.getZoom(), 15));
    }, MAP_LP_MS);
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (!_mapLongPressStart || e.touches.length !== 1) return;
    const t = e.touches[0];
    const rect = container.getBoundingClientRect();
    const dx = (t.clientX - rect.left) - _mapLongPressStart.point.x;
    const dy = (t.clientY - rect.top) - _mapLongPressStart.point.y;
    if (Math.sqrt(dx * dx + dy * dy) > MAP_LP_MOVE) {
      if (_mapLongPressTimer) { clearTimeout(_mapLongPressTimer); _mapLongPressTimer = null; }
      _mapLongPressStart = null;
    }
  }, { passive: true });

  const _clearMapLongPress = () => {
    if (_mapLongPressTimer) { clearTimeout(_mapLongPressTimer); _mapLongPressTimer = null; }
    _mapLongPressStart = null;
  };
  container.addEventListener('touchend', _clearMapLongPress);
  container.addEventListener('touchcancel', _clearMapLongPress);
}

map.on('click', (e) => {
  if (_mapDragged) { _mapDragged = false; return; }
  if (pickPinMarker) return;
  // 移动端：长按已触发搜索，跳过 Leaflet 合成的 click（防止重复触发）
  if (_isTouchDevice && _mapLongPressTriggered) {
    _mapLongPressTriggered = false;
    return;
  }
  /* 点击 marker / cluster 时不触发空白区域逻辑（marker 自己有 click handler） */
  const target = e.originalEvent && e.originalEvent.target;
  if (target && target.closest && (target.closest('.leaflet-marker-icon') || target.closest('.leaflet-marker-shadow') || target.closest('.marker-cluster') || target.closest('.toilet-cluster-icon') || target.closest('.leaflet-interactive'))) return;

  const panel = document.getElementById('panel');
  const list = document.getElementById('nearbyList');
  const searchSuggest = document.getElementById('searchSuggest');
  const filterDropdown = document.getElementById('filterDropdown');
  const filterBtn = document.getElementById('filterBtn');

  const hasOverlay = panel.classList.contains('is-show')
    || !list.classList.contains('is-collapsed')
    || searchSuggest.classList.contains('is-show')
    || filterDropdown.classList.contains('is-show');

  if (hasOverlay) {
    closePanel();
    collapseNearbyList();
    searchSuggest.classList.remove('is-show');
    filterDropdown.classList.remove('is-show');
    filterBtn.classList.remove('is-active');
    document.getElementById('searchInput').blur();
  } else if (!_isTouchDevice) {
    // 桌面端：无浮层时点击触发周边搜索
    // 移动端：无浮层时短按不触发搜索（需长按）
    closePanel();
    setSearchCenter([e.latlng.lat, e.latlng.lng], '点击位置', Math.max(map.getZoom(), 15));
  }
});
/* 缩放结束时重渲染（切换聚合/直显模式） */
map.on('zoomend', renderMarkers);

/* ============ 定位：写死海港公园，不请求 Geolocation ============
   Demo 范围限定滨海新区海港公园，不弹定位权限请求，定位点固定为海港公园
   relocBtn 点击直接 flyTo 海港公园 */

let _lastRefreshTime = Date.now();
let _lastRefreshCoords = USER_LOC;

document.getElementById('relocBtn').addEventListener('click', () => {
  map.flyTo(USER_LOC, 15, { duration: 0.5 });
  setSearchCenter(USER_LOC, '海港公园', 15);
  showToast('已定位到海港公园');
});

// 上报新厕所按钮
document.getElementById('addBtn').addEventListener('click', openAddToiletPanel);

/* ============ Panel Drag Handle（MD3 Bottom Sheet / Side Sheet 拖拽） ============ */
(function initPanelDrag() {
  const panel = document.getElementById('panel');
  const handle = panel.querySelector('.panel__handle');
  const panelBody = panel.querySelector('.panel__body');
  let _dragging = false;
  let _startX = 0, _startY = 0;
  let _currentX = 0, _currentY = 0;
  let _velocity = 0;
  let _lastX = 0, _lastY = 0, _lastTime = 0;
  let _isDesktop = false;
  let _currentSnap = 'closed';
  let _dragFromHandle = false;
  let _directionLocked = false;
  const TAP_THRESHOLD = 5;
  const SNAP_THRESHOLD = 100;
  const VELOCITY_THRESHOLD = 0.5;

  function isDesktop() {
    return window.innerWidth >= 768;
  }

  function setSnap(snap, animate = true) {
    const prevSnap = _currentSnap;
    _currentSnap = snap;

    panel.classList.remove('is-half', 'is-expanded');

    if (snap === 'closed') {
      panel.classList.remove('is-show');
      panel.style.transform = '';
      panel.style.transition = '';
      currentToilet = null;
      clearPickMode();
      document.getElementById('nearbyList').style.display = '';
    } else {
      panel.classList.add('is-show');
      if (snap === 'half') {
        panel.classList.add('is-half');
      } else if (snap === 'expanded') {
        panel.classList.add('is-expanded');
      }
      panel.style.transform = 'translateY(0)';
      if (animate) {
        panel.style.transition = '';
      }
    }

    if (snap !== 'closed' && prevSnap !== snap && typeof window.panelHeightChanged === 'function') {
      setTimeout(() => window.panelHeightChanged(), 280);
    }
  }

  function onStart(e) {
    _isDesktop = isDesktop();
    if (_isDesktop) {
      if (!panel.classList.contains('is-show')) return;
      if (!e.target.closest('.panel__handle')) return;
    } else {
      if (_currentSnap === 'closed') return;
    }

    _dragFromHandle = !!e.target.closest('.panel__handle');

    if (!_isDesktop && !_dragFromHandle) {
      if (_currentSnap === 'closed') return;
      if (panelBody.scrollTop > 0) return;
    }

    _dragging = true;
    _directionLocked = false;
    const point = e.touches ? e.touches[0] : e;
    _startX = point.clientX;
    _startY = point.clientY;
    _currentX = 0;
    _currentY = 0;
    _lastX = _startX;
    _lastY = _startY;
    _lastTime = Date.now();
    _velocity = 0;

    panel.style.transition = 'none';
    panel.classList.add('is-dragging');
    document.body.style.userSelect = 'none';
  }

  function onMove(e) {
    if (!_dragging) return;
    const point = e.touches ? e.touches[0] : e;
    const dx = point.clientX - _startX;
    const dy = point.clientY - _startY;
    const now = Date.now();
    const dt = now - _lastTime;

    if (!_isDesktop && !_dragFromHandle && !_directionLocked) {
      if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        _dragging = false;
        panel.classList.remove('is-dragging');
        document.body.style.userSelect = '';
        return;
      }
      _directionLocked = true;
    }

    if (_isDesktop) {
      _currentX = dx < 0 ? dx * 0.3 : dx;
      _currentY = 0;
      if (dt > 0) _velocity = (point.clientX - _lastX) / dt;
      panel.style.transform = `translateX(${_currentX}px)`;
    } else {
      if (!_dragFromHandle) {
        if (_currentSnap === 'expanded' && dy < 0) {
          _dragging = false;
          panel.classList.remove('is-dragging');
          document.body.style.userSelect = '';
          return;
        }
      }

      let offsetY = dy;
      if (_currentSnap === 'half') {
        if (dy < 0) {
          offsetY = dy * 0.5;
        }
      } else if (_currentSnap === 'expanded') {
        if (dy < 0) {
          offsetY = dy * 0.3;
        }
      }
      _currentX = 0;
      _currentY = offsetY;
      if (dt > 0) _velocity = (point.clientY - _lastY) / dt;
      panel.style.transform = `translateY(${_currentY}px)`;
    }

    _lastX = point.clientX;
    _lastY = point.clientY;
    _lastTime = now;
    e.preventDefault();
  }

  function onEnd() {
    if (!_dragging) return;
    _dragging = false;
    panel.classList.remove('is-dragging');
    document.body.style.userSelect = '';

    const totalDist = _isDesktop ? _currentX : _currentY;
    const moved = Math.abs(totalDist) > TAP_THRESHOLD;

    if (_isDesktop) {
      const panelSize = panel.offsetWidth;
      const threshold = Math.min(panelSize * 0.3, 200);
      const fastFling = _velocity > 0.5;

      if (totalDist > threshold || fastFling) {
        panel.style.transition = 'transform var(--md-dur-medium) var(--md-easing-emphasized)';
        panel.style.transform = 'translateX(120%)';
        const onTransEnd = () => {
          panel.removeEventListener('transitionend', onTransEnd);
          panel.classList.remove('is-show');
          panel.style.transform = '';
          panel.style.transition = '';
          currentToilet = null;
          clearPickMode();
          document.getElementById('nearbyList').style.display = '';
        };
        panel.addEventListener('transitionend', onTransEnd);
        setTimeout(onTransEnd, 350);
      } else {
        panel.style.transition = '';
        panel.style.transform = '';
      }
      return;
    }

    if (!moved) {
      if (_dragFromHandle) {
        if (_currentSnap === 'half') {
          setSnap('expanded');
        } else if (_currentSnap === 'expanded') {
          setSnap('half');
        }
      }
      return;
    }

    let targetSnap = _currentSnap;
    const fastUp = _velocity < -VELOCITY_THRESHOLD;
    const fastDown = _velocity > VELOCITY_THRESHOLD;

    if (_currentSnap === 'half') {
      if (totalDist < -SNAP_THRESHOLD || fastUp) {
        targetSnap = 'expanded';
      } else if (totalDist > SNAP_THRESHOLD || fastDown) {
        targetSnap = 'closed';
      }
    } else if (_currentSnap === 'expanded') {
      if (totalDist > SNAP_THRESHOLD || fastDown) {
        targetSnap = 'half';
      }
    }

    setSnap(targetSnap);
  }

  window._setPanelSnap = setSnap;
  window._closePanelMobile = function() {
    setSnap('closed');
  };

  panel.addEventListener('touchstart', onStart, { passive: false });
  document.addEventListener('touchmove', (e) => { if (_dragging) onMove(e); }, { passive: false });
  document.addEventListener('touchend', onEnd);
  document.addEventListener('touchcancel', onEnd);

  handle.addEventListener('mousedown', onStart);
  document.addEventListener('mousemove', (e) => { if (_dragging) onMove(e); });
  document.addEventListener('mouseup', onEnd);
})();

// 筛选下拉：点击漏斗按钮 toggle 显示/隐藏
document.getElementById('filterBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('filterDropdown').classList.toggle('is-show');
  document.getElementById('filterBtn').classList.toggle('is-active');
});
// 选择筛选项：单选切换，更新标签和 marker/列表
document.getElementById('filterDropdown').addEventListener('click', e => {
  const item = e.target.closest('.filter-dropdown__item');
  if (!item) return;
  document.querySelectorAll('.filter-dropdown__item').forEach(c => c.classList.remove('is-active'));
  item.classList.add('is-active');
  currentFilter = item.dataset.filter;
  document.getElementById('filterLabel').textContent = item.querySelector('.filter-dropdown__label').textContent;
  document.getElementById('filterDropdown').classList.remove('is-show');
  document.getElementById('filterBtn').classList.remove('is-active');
  renderMarkers();
  renderNearbyList();
});

document.getElementById('searchInput').addEventListener('input', onSearchInput);
document.getElementById('searchInput').addEventListener('focus', () => {
  const q = document.getElementById('searchInput').value.trim();
  if (q.length >= 2) onSearchInput();
});
document.getElementById('searchBtn').addEventListener('click', doSearch);
document.getElementById('searchInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    document.getElementById('searchSuggest').classList.remove('is-show');
    doSearch();
  }
});
// 搜索清除按钮：输入时显示，点击清空
const searchClear = document.getElementById('searchClear');
document.getElementById('searchInput').addEventListener('input', () => {
  searchClear.classList.toggle('is-show', document.getElementById('searchInput').value.length > 0);
});
searchClear.addEventListener('click', () => {
  document.getElementById('searchInput').value = '';
  searchClear.classList.remove('is-show');
  document.getElementById('searchSuggest').classList.remove('is-show');
  document.getElementById('searchInput').focus();
});
// 点击外部关闭搜索建议和筛选下拉
document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) {
    document.getElementById('searchSuggest').classList.remove('is-show');
  }
  if (!e.target.closest('.filter-dropdown') && !e.target.closest('#filterBtn')) {
    document.getElementById('filterDropdown').classList.remove('is-show');
    document.getElementById('filterBtn').classList.remove('is-active');
  }
});

/* ============ 启动 ============ */
// 加载用户历史上报点位
loadUserToilets();
// 加载用户补充设施标签
loadTagSupplements();
// 加载用户补充位置描述
loadDescSupplements();
// 位置固定为海港公园
window._hasGpsFix = true;
// 以海港公园为中心拉取周边厕所
setSearchCenter(CENTER, '海港公园', 15);
setTimeout(() => map.invalidateSize(), 200);

/* 首次访问提示图例含义（localStorage 标记，仅显示一次） */
setTimeout(() => {
  if (!localStorage.getItem('hasSeenLegend')) {
    showToast('🟢能用 🔴不能用 ⚫不确定，点击左下图例查看详情');
    localStorage.setItem('hasSeenLegend', '1');
  }
}, 2000);

/* 图例点击展开/收起（移动端可折叠，桌面端常驻无需切换） */
document.getElementById('legend').addEventListener('click', () => {
  document.getElementById('legend').classList.toggle('is-expanded');
});
document.getElementById('legend').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    document.getElementById('legend').classList.toggle('is-expanded');
  }
});

/* 定时检查用户点位降级（30/90 天无确认，pointTier 纯函数基于时间实时计算） */
setInterval(() => {
  renderMarkers();
  renderNearbyList();
}, 600000);
