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
map = L.map('map', { zoomControl: false, attributionControl: false }).setView(CENTER, 15);
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
/* Bottom Sheet 拖拽交互：支持上拉展开、下拉收起，替换展开/收起按钮 */
(function initSheetDrag() {
  const list = document.getElementById('nearbyList');
  const header = document.getElementById('nearbyHeader');
  let startY = 0;             // 拖拽起点 Y 坐标
  let startHeight = 0;        // 拖拽起点时列表高度
  let startTime = 0;          // 拖拽起点时间戳（ms），用于无 move 事件的快速 flick 速度计算
  let isDragging = false;     // 是否处于拖拽中（已通过阈值确认）
  let pendingDrag = false;    // 触摸已开始但未达拖拽阈值（等待确认是拖拽还是点击）
  let moved = false;          // 是否发生过有效移动（用于抑制拖拽后合成的 click 误触）
  // 速度采样：用于快速 fling 时的 snap 判定，避免仅按位置 snap 导致快速滑动收不拢/展不开
  let lastY = 0;              // 上一次 move 采样的 Y 坐标
  let lastTime = 0;           // 上一次 move 采样的时间戳（ms）
  let velocity = 0;           // 最近一次 move 的瞬时速度（px/ms，正值=手指上移=展开方向）
  let dragFromList = false;    // 拖拽是否起源于列表内容区（非 header）
  let startScrollTop = 0;      // touchstart 时列表的 scrollTop，用于判断是否应让浏览器接管滚动
  const HEADER_H = 56;
  const COLLAPSED_H_DESKTOP = 48;
  const DRAG_THRESHOLD = 6;   // 拖拽激活阈值（px）：超过该位移才认定为拖拽，避免和点击冲突
  // 速度阈值（px/ms）：超过该值视为快速 fling，按方向 snap 而非按位置 snap
  const FLING_VELOCITY = 0.7;
  // move 采样有效性窗口（ms）：超过该时长认为速度已过期（事件丢失时避免用陈旧速度误判 snap）
  const VELOCITY_FRESH_MS = 100;
  // 顶部安全间距：列表顶部与搜索栏底部之间的最小间距（px），防止穿模
  const TOP_GAP = 8;
  // 当前 snap 状态：'collapsed' | 'half' | 'expanded'
  let _snapState = 'collapsed';

  function isDesktop() {
    return window.innerWidth >= 768;
  }
  function getSafeBottom() {
    if (isDesktop()) return 0;
    const val = getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom').trim();
    return parseFloat(val) || 0;
  }
  function getSafeTop() {
    if (isDesktop()) return 0;
    const val = getComputedStyle(document.documentElement).getPropertyValue('--safe-top').trim();
    return parseFloat(val) || 0;
  }
  /* 收起高度：只显示 header（56px + safe-bottom） */
  function getCollapsedH() {
    return (isDesktop() ? COLLAPSED_H_DESKTOP : HEADER_H) + getSafeBottom();
  }
  /* 预览高度：35vh（两条半卡片预览，保留 65% 地图可见） */
  function getHalfH() {
    if (isDesktop()) return Math.floor(window.innerHeight * 0.5);
    return Math.floor(window.innerHeight * 0.35);
  }
  /* 全展开高度：到搜索栏底部下方 TOP_GAP 处，不穿模盖住 topbar */
  function getFullH() {
    if (isDesktop()) return Math.floor(window.innerHeight * 0.5);
    // 动态计算 topbar 底部 Y 坐标：标题行 + 搜索栏 + padding
    const topbar = document.querySelector('.topbar');
    if (topbar) {
      const topbarBottom = topbar.getBoundingClientRect().bottom;
      const maxH = window.innerHeight - topbarBottom - TOP_GAP;
      return Math.max(getHalfH() + 40, Math.floor(maxH));
    }
    // 兜底：safe-top + 标题行(~50px) + 搜索栏(44px) + padding(~12px) + TOP_GAP
    const fallback = getSafeTop() + 50 + 44 + 12 + TOP_GAP;
    return window.innerHeight - fallback;
  }
  function getCurrentH() {
    return list.getBoundingClientRect().height;
  }
  function setHeight(px) {
    list.style.maxHeight = px + 'px';
  }
  /* 根据当前高度判断所处的 snap 状态 */
  function getSnapFromHeight(h) {
    const ch = getCollapsedH();
    const hh = getHalfH();
    const fh = getFullH();
    if (h <= (ch + hh) / 2) return 'collapsed';
    if (h <= (hh + fh) / 2) return 'half';
    return 'expanded';
  }
  function applySnapClass(snap) {
    list.classList.remove('is-collapsed');
    if (snap === 'collapsed') {
      list.classList.add('is-collapsed');
    }
  }
  function onStart(y) {
    // 只记录起点状态，不立即进入拖拽模式；等位移超阈值才激活（避免干扰点击）
    pendingDrag = true;
    isDragging = false;
    moved = false;
    startY = y;
    startHeight = getCurrentH();
    // 记录起始 snap 状态
    _snapState = getSnapFromHeight(startHeight);
    const now = performance.now();
    startTime = now;
    // 重置速度采样
    lastY = y;
    lastTime = now;
    velocity = 0;
  }
  /* 激活拖拽：位移超阈值后调用，添加视觉状态（禁止 transition、固定高度） */
  function activateDrag() {
    if (isDragging) return;
    isDragging = true;
    pendingDrag = false;
    moved = true;
    list.classList.add('is-dragging');
    list.classList.remove('is-collapsed');
    document.body.classList.add('is-dragging-sheet');
    setHeight(startHeight);
  }
  function onMove(y) {
    if (!pendingDrag && !isDragging) return;
    // 从列表内容区启动的触摸：如果列表已滚动（scrollTop>0），说明用户在浏览内容，
    // 取消拖拽让浏览器接管原生滚动，避免 preventDefault 阻断列表滑动
    if (pendingDrag && !isDragging && dragFromList && list.scrollTop > 0) {
      pendingDrag = false;
      return;
    }
    const dy = startY - y;
    // 计算瞬时速度
    const now = performance.now();
    const dt = now - lastTime;
    if (dt > 0) velocity = (lastY - y) / dt;
    lastY = y;
    lastTime = now;
    // 未激活拖拽时：判断是否超过拖拽阈值；快速 fling 也直接激活
    if (!isDragging) {
      if (Math.abs(dy) < DRAG_THRESHOLD && Math.abs(velocity) <= FLING_VELOCITY) return;
      activateDrag();
    }
    const minH = getCollapsedH();
    const maxH = getFullH();  // 拖拽上限：不超过 topbar 底部，防止穿模
    // 拖拽高度限制在 [minH, maxH] 之间，手指可以自由拉到任意合法高度
    const newH = Math.min(maxH, Math.max(minH, startHeight + dy));
    setHeight(newH);
    // 拖拽过程中只同步 nav-bar 位置（CSS 变量，轻量），不平移地图避免干扰 touch 事件
    if (window.updateNavBarPosition) window.updateNavBarPosition();
  }
  function onEnd(e) {
    if (!pendingDrag && !isDragging) return;
    const wasDragging = isDragging;
    const wasPending = pendingDrag && !isDragging;
    isDragging = false;
    pendingDrag = false;

    let endY = lastY;
    let endVelocity = velocity;
    if (wasPending && e) {
      const point = e.changedTouches ? e.changedTouches[0] : e;
      if (point && typeof point.clientY === 'number') {
        endY = point.clientY;
        const totalDy = startY - endY;
        const totalDt = performance.now() - startTime;
        if (totalDt > 0) endVelocity = totalDy / totalDt;
        moved = Math.abs(totalDy) > 3;
      }
    }

    const ch = getCollapsedH();
    const hh = getHalfH();
    const fh = getFullH();

    const flingFresh = (performance.now() - lastTime) < VELOCITY_FRESH_MS || wasPending;
    let targetSnap;

    if (flingFresh && endVelocity > FLING_VELOCITY) {
      // 快速上滑：升一档（collapsed→half→expanded）
      targetSnap = _snapState === 'collapsed' ? 'half' : 'expanded';
    } else if (flingFresh && endVelocity < -FLING_VELOCITY) {
      // 快速下滑：降一档（expanded→half→collapsed）
      targetSnap = _snapState === 'expanded' ? 'half' : 'collapsed';
    } else if (wasDragging) {
      // 慢速拖拽：按最终位置判定 snap
      const h = getCurrentH();
      targetSnap = getSnapFromHeight(h);
    } else {
      // 普通点击（非快速 flick 且非拖拽）：直接返回，由 click 事件处理 toggle
      moved = false;
      return;
    }

    // 执行过渡动画到目标 snap 高度
    list.classList.remove('is-dragging');
    if (wasPending) {
      moved = true; // 快速 flick 抑制后续合成 click 事件
    }

    const targetH = targetSnap === 'collapsed' ? ch : targetSnap === 'half' ? hh : fh;
    _snapState = targetSnap;

    // 用内联样式锁定当前高度作为 transition 起点，然后设目标高度触发过渡
    const startH = getCurrentH();
    list.style.overflow = 'hidden';
    list.style.maxHeight = startH + 'px';
    void list.offsetHeight; // 强制 reflow 确保浏览器记录起始高度
    applySnapClass(targetSnap);
    list.style.maxHeight = targetH + 'px';

    // 过渡结束后清理内联样式（overflow 恢复，但 maxHeight 保留给非collapsed状态防止CSS截断）
    const cleanupAndSync = () => {
      list.style.overflow = '';
      if (targetSnap === 'collapsed') {
        list.style.maxHeight = '';
      }
      // half/expanded 保留内联 maxHeight，因为 CSS 默认 max-height 是 90vh 兜底，
      // 而 getFullH() 是动态计算的（基于 topbar 位置），需要内联精确控制
    };
    const onTransEnd = (ev) => {
      if (ev.target === list && ev.propertyName === 'max-height') {
        list.removeEventListener('transitionend', onTransEnd);
        cleanupAndSync();
      }
    };
    list.addEventListener('transitionend', onTransEnd);
    setTimeout(cleanupAndSync, 380);

    // snap 过渡期间用 rAF 循环同步 nav-bar 位置，结束后平移地图
    if (window.syncNavBarDuringTransition) {
      window.syncNavBarDuringTransition(400);
    }
  }

  /* 点击 header 时的 toggle 行为：
     collapsed → half（预览两条半）；half/expanded → collapsed */
  window._toggleNearbySheet = function() {
    if (_snapState === 'collapsed') {
      _snapState = 'half';
      const hh = getHalfH();
      list.style.overflow = 'hidden';
      list.style.maxHeight = getCollapsedH() + 'px';
      void list.offsetHeight;
      list.classList.remove('is-collapsed');
      list.style.maxHeight = hh + 'px';
      setTimeout(() => { list.style.overflow = ''; }, 380);
      if (window.syncNavBarDuringTransition) window.syncNavBarDuringTransition(400);
    } else {
      _snapState = 'collapsed';
      const ch = getCollapsedH();
      const startH = getCurrentH();
      list.style.overflow = 'hidden';
      list.style.maxHeight = startH + 'px';
      void list.offsetHeight;
      list.classList.add('is-collapsed');
      list.style.maxHeight = ch + 'px';
      setTimeout(() => { list.style.maxHeight = ''; list.style.overflow = ''; }, 380);
      if (window.syncNavBarDuringTransition) window.syncNavBarDuringTransition(400);
    }
  };

  /* 触摸事件：touchstart 在 header/list 上触发（支持从内容区开始拖拽），
     但从 list 内容区启动时，若列表已滚动（scrollTop>0）则不拦截，让浏览器处理原生滚动。
     touchmove/touchend 绑定到 document 确保手指滑出区域后事件不丢失 */
  const dragTargets = [header, list];
  dragTargets.forEach(target => {
    target.addEventListener('touchstart', (e) => {
      dragFromList = (target === list);
      if (dragFromList) {
        startScrollTop = list.scrollTop;
        // 列表已滚动：用户在浏览内容，不启动拖拽，让浏览器接管滚动
        if (startScrollTop > 0) return;
      }
      onStart(e.touches[0].clientY);
    }, { passive: true });
  });
  document.addEventListener('touchmove', (e) => {
    if (!pendingDrag && !isDragging) return;
    onMove(e.touches[0].clientY);
    if (isDragging) e.preventDefault();
  }, { passive: false });
  document.addEventListener('touchend', (e) => onEnd(e));
  document.addEventListener('touchcancel', (e) => onEnd(e));

  header.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    dragFromList = false; // 鼠标拖拽只从 header 触发
    onStart(e.clientY);
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!pendingDrag && !isDragging) return;
    onMove(e.clientY);
  });
  document.addEventListener('mouseup', (e) => onEnd(e));

  header.addEventListener('click', (e) => {
    if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; return; }
    if (window._toggleNearbySheet) {
      window._toggleNearbySheet();
    } else {
      toggleNearbyList();
    }
  });
})();

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

// 上报新厕所按钮：toggle 行为——首次点击打开上报面板，再次点击（上报面板已打开）收起面板
// 判断依据：pickPinMarker 存在说明处于上报拾取模式（面板关闭时 clearPickMode 会清空它）
document.getElementById('addBtn').addEventListener('click', () => {
  if (pickPinMarker) {
    closePanel();
  } else {
    openAddToiletPanel();
  }
});

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

    panel.classList.remove('is-half', 'is-expanded', 'is-compact');

    if (snap === 'closed') {
      panel.classList.remove('is-show');
      panel.style.transform = '';
      panel.style.transition = '';
      currentToilet = null;
      clearPickMode();
      document.getElementById('nearbyList').style.display = '';
    } else {
      panel.classList.add('is-show');
      if (snap === 'compact') {
        panel.classList.add('is-compact');
      } else if (snap === 'half') {
        panel.classList.add('is-half');
      } else if (snap === 'expanded') {
        panel.classList.add('is-expanded');
      }
      panel.style.transform = 'translateY(0)';
      if (animate) {
        panel.style.transition = '';
      }
    }

    if (snap !== 'closed' && prevSnap !== snap) {
      // nav-bar 位置同步：用 rAF 循环在过渡期间持续更新，避免慢半拍
      if (animate && window.syncNavBarDuringTransition) {
        window.syncNavBarDuringTransition(400);
      }
      // 面板高度变化后平移 POI 到可见区域（panelHeightChanged 内部也会调 updateNavBarPosition，作为最终兜底）
      if (typeof window.panelHeightChanged === 'function') {
        setTimeout(() => window.panelHeightChanged(), 280);
      }
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
    document.body.classList.add('is-dragging-sheet'); // 禁用 nav-bar bottom 过渡，确保跟手
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
      if (_currentSnap === 'compact') {
        if (dy < 0) {
          offsetY = dy * 0.5;  /* compact→half 上滑阻尼 */
        }
      } else if (_currentSnap === 'half') {
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
      // 拖拽过程中只同步 nav-bar 位置，不平移地图避免干扰 touch 事件
      if (window.updateNavBarPosition) window.updateNavBarPosition();
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
    document.body.classList.remove('is-dragging-sheet'); // 恢复 nav-bar bottom 过渡
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
        if (_currentSnap === 'compact') {
          setSnap('half');
        } else if (_currentSnap === 'half') {
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

    if (_currentSnap === 'compact') {
      if (totalDist < -SNAP_THRESHOLD || fastUp) {
        targetSnap = 'half';
      } else if (totalDist > SNAP_THRESHOLD || fastDown) {
        targetSnap = 'closed';
      }
    } else if (_currentSnap === 'half') {
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
// 搜索通过 Enter 键触发，无需额外按钮
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
// 以海港公园为中心拉取周边厕所（silent=true：初始加载不自动展开列表）
setSearchCenter(CENTER, '海港公园', 15, null, true);
setTimeout(() => map.invalidateSize(), 200);

/* 首次访问提示图例含义（localStorage 标记，仅显示一次） */
setTimeout(() => {
  if (!localStorage.getItem('hasSeenLegend')) {
    showToast('🟢能用 🔴不能用 ⚪不确定，点击底部图例按钮查看');
    localStorage.setItem('hasSeenLegend', '1');
  }
}, 2000);

/* 底部胶囊条：图例按钮点击弹出/关闭图例浮层 */
const legendPopup = document.getElementById('legendPopup');
document.getElementById('navLegendBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  legendPopup.classList.toggle('is-show');
});
/* 点击外部关闭图例浮层 */
document.addEventListener('click', (e) => {
  if (!e.target.closest('.legend-popup') && !e.target.closest('#navLegendBtn')) {
    legendPopup.classList.remove('is-show');
  }
});

/* 定时检查用户点位降级（30/90 天无确认，pointTier 纯函数基于时间实时计算） */
setInterval(() => {
  renderMarkers();
  renderNearbyList();
}, 600000);
