/* ui/search.js — 搜索 + 联想（纯本地，0 API 调用）
   依赖：core/geo.js, data/toilets.js, data/config.js, ui/utils.js, ui/map.js, ui/nearby.js
   全量公厕数据已预拉取到 MOCK_TOILETS（175条），搜索/周边筛选全部本地完成
*/

let searchCenter, searchCenterName = '海港公园', searchPinMarker = null;

/* 本地全量数据筛选：从 MOCK_TOILETS 中按距离排序，0 API 调用
   数据已全量拉取滨海新区公厕（175条），无需实时调 around API */
const LOCAL_SEARCH_RADIUS = 3000;  // 3km 半径

function fetchNearbyToilets(coords) {
  const [lat, lng] = coords;
  const nearby = MOCK_TOILETS
    .map(t => ({
      ...t,
      _dist: haversine(lat, lng, t.lat, t.lng)
    }))
    .filter(t => t._dist <= LOCAL_SEARCH_RADIUS)
    .sort((a, b) => a._dist - b._dist);
  return Promise.resolve(nearby);
}

function renderSuggest(items) {
  const box = document.getElementById('searchSuggest');
  if (!items || items.length === 0) {
    box.innerHTML = '<div class="suggest-empty">无匹配地点</div>';
    box.classList.add('is-show');
    return;
  }
  box.innerHTML = items.map((it, idx) => {
    const dist = it.dist !== undefined ? formatDist(it.dist).text : '';
    return `
      <div class="suggest-item" data-idx="${idx}">
        <span class="suggest-item__icon">${it.icon || '📍'}</span>
        <div class="suggest-item__body">
          <div class="suggest-item__name">${it.name}</div>
          <div class="suggest-item__addr">${it.addr || ''}</div>
        </div>
        ${dist ? `<span class="suggest-item__dist">${dist}</span>` : ''}
      </div>
    `;
  }).join('');
  box.classList.add('is-show');
  box.querySelectorAll('.suggest-item').forEach(el => {
    el.addEventListener('click', () => {
      const item = items[parseInt(el.dataset.idx)];
      selectSuggest(item);
    });
  });
}

function selectSuggest(item) {
  document.getElementById('searchSuggest').classList.remove('is-show');
  document.getElementById('searchInput').value = item.name;
  addSearchHistory(item.name);  // 记录搜索历史
  hideSearchHistory();          // 选择后隐藏历史下拉
  const [lng, lat] = item.location.split(',').map(Number);
  setSearchCenter([lat, lng], item.name, 15);
  showToast('已定位到：' + item.name + '，周边厕所已更新');
}

function setSearchCenter(coords, name, zoom, ensureToilet, silent) {
  searchCenter = coords;
  searchCenterName = name;
  if (searchPinMarker) map.removeLayer(searchPinMarker);
  // 定位已写死海港公园：USER_LOC 就是海港公园，显示脉冲蓝点不额外加图钉
  const isUserLoc = (coords === USER_LOC) || (name === '海港公园');
  if (!isUserLoc) {
    const pinIcon = L.divIcon({
      className: 'search-pin-marker',
      html: `<div class="search-pin"><div class="search-pin__head"><span class="emoji">🔍</span></div><div class="search-pin__label">${name}</div></div>`,
      iconSize: [80, 65],
      iconAnchor: [40, 36]
    });
    searchPinMarker = L.marker(coords, { icon: pinIcon, zIndexOffset: 1000, interactive: false }).addTo(map);
  } else {
    searchPinMarker = null;
  }
  map.setView(coords, zoom || 15);

  // 本地全量数据筛选：0 API 调用
  const nearby = MOCK_TOILETS
    .map(t => ({ ...t, _dist: haversine(coords[0], coords[1], t.lat, t.lng) }))
    .filter(t => t._dist <= LOCAL_SEARCH_RADIUS)
    .sort((a, b) => a._dist - b._dist);

  // 合并 ensureToilet（搜索选中的厕所 POI 确保显示）
  if (ensureToilet) {
    const exists = nearby.some(t => Math.abs(t.lat - ensureToilet.lat) < 1e-6 && Math.abs(t.lng - ensureToilet.lng) < 1e-6);
    if (!exists) nearby.unshift(ensureToilet);
  }

  liveToilets = nearby;
  renderMarkers();
  renderNearbyList();
  if (nearby.length > 0 && !isUserLoc) {
    showToast(`已加载${name}周边${nearby.length}个厕所`);
  }

  /* silent=true（初始加载/刷新）：不自动展开列表，保持收起状态
     silent=false（用户主动搜索/长按/点击地图）：展开到预览档（half），snap 后平移地图让搜索中心可见 */
  if (!silent) {
    expandNearbyList();
    // 列表展开 snap 动画结束后，平移地图让搜索中心出现在卡片上方
    if (window.syncNavBarDuringTransition) {
      window.syncNavBarDuringTransition(400);
    }
  }
}

const onSearchInput = debounce(() => {
  const q = document.getElementById('searchInput').value.trim();
  const box = document.getElementById('searchSuggest');
  if (q.length < 2) { box.classList.remove('is-show'); return; }

  // 纯本地搜索：全量数据已在本地，0 API 调用
  const items = [];
  MOCK_TOILETS.forEach(t => {
    if (t.name.includes(q) || (t.address && t.address.includes(q))) {
      const dist = haversine(searchCenter[0], searchCenter[1], t.lat, t.lng);
      items.push({ name: t.name, addr: t.address || '公共厕所', location: t.lng + ',' + t.lat, icon: '🚾', dist });
    }
  });
  Object.entries(PRESET_LOCATIONS).forEach(([key, coords]) => {
    if (q.includes(key) || key.includes(q)) {
      const dist = haversine(searchCenter[0], searchCenter[1], coords[0], coords[1]);
      items.push({ name: key, addr: '地点', location: coords[1] + ',' + coords[0], icon: '📍', dist });
    }
  });
  items.sort((a, b) => a.dist - b.dist);
  renderSuggest(items.slice(0, 8));
}, 300);

function doSearch() {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) return;
  // 精确匹配厕所名称
  const hit = MOCK_TOILETS.find(t => t.name.includes(q) || t.name.toLowerCase().includes(q.toLowerCase()));
  if (hit) {
    addSearchHistory(hit.name);  // 记录搜索历史
    hideSearchHistory();
    setSearchCenter([hit.lat, hit.lng], hit.name, 16);
    openPanel(hit);
    showToast('已定位到：' + hit.name);
    return;
  }
  // 匹配预设地点
  for (const [key, coords] of Object.entries(PRESET_LOCATIONS)) {
    if (q.includes(key)) {
      addSearchHistory(key);  // 记录搜索历史
      hideSearchHistory();
      setSearchCenter(coords, key, 15);
      showToast('已定位到：' + key + '，周边厕所已更新');
      return;
    }
  }
  // 本地模糊搜索：显示建议列表
  const items = [];
  MOCK_TOILETS.forEach(t => {
    if (t.name.includes(q) || (t.address && t.address.includes(q))) {
      items.push({ name: t.name, addr: t.address || '公共厕所', location: t.lng + ',' + t.lat, icon: '🚾', address: t.address || '' });
    }
  });
  Object.entries(PRESET_LOCATIONS).forEach(([key, coords]) => {
    if (q.includes(key) || key.includes(q)) {
      items.push({ name: key, addr: '地点', location: coords[1] + ',' + coords[0], icon: '📍', address: '' });
    }
  });
  if (items.length > 0) {
    items.sort((a, b) => {
      const [aLng, aLat] = a.location.split(',').map(Number);
      const [bLng, bLat] = b.location.split(',').map(Number);
      return haversine(searchCenter[0], searchCenter[1], aLat, aLng) - haversine(searchCenter[0], searchCenter[1], bLat, bLng);
    });
    if (items.length === 1) {
      selectSuggest(items[0]);
    } else {
      renderSuggest(items.slice(0, 8));
    }
  } else {
    showToast('未找到地点，换个关键词试试');
  }
}

/* ============ 搜索历史（localStorage，最近 8 条） ============ */
/* 小程序迁移映射：
   - localStorage → wx.getStorageSync / wx.setStorageSync
   - DOM 渲染 → wxml wx:for + bindtap
   - 点击历史 → 复用 doSearch 逻辑（填入 input + 触发搜索） */

/* 读取搜索历史数组（最近 SEARCH_HISTORY_MAX 条，新→旧） */
function getSearchHistory() {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, SEARCH_HISTORY_MAX) : [];
  } catch (e) {
    return [];  // 解析失败返回空，避免污染主流程
  }
}

/* 写入一条搜索历史：去重（移除同名旧记录）+ 置顶 + 截断到上限 */
function addSearchHistory(name) {
  if (!name || typeof name !== 'string') return;
  const trimmed = name.trim();
  if (!trimmed) return;
  try {
    const list = getSearchHistory();
    // 去重：过滤掉同名记录后置于首位
    const filtered = list.filter(item => item !== trimmed);
    filtered.unshift(trimmed);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(filtered.slice(0, SEARCH_HISTORY_MAX)));
  } catch (e) {
    /* localStorage 满或禁用时静默失败，不影响搜索主流程 */
  }
}

/* 清空全部搜索历史 */
function clearSearchHistory() {
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch (e) { /* 静默失败 */ }
  hideSearchHistory();
}

/* 渲染搜索历史下拉（聚焦且输入为空时调用） */
function renderSearchHistory() {
  const box = document.getElementById('searchHistory');
  if (!box) return;
  const list = getSearchHistory();
  if (list.length === 0) {
    box.innerHTML = '<div class="search-history__empty">暂无搜索历史</div>';
  } else {
    box.innerHTML = `
      <div class="search-history__header">
        <span>搜索历史</span>
        <button class="search-history__clear" id="searchHistoryClear" type="button">清空</button>
      </div>
      ${list.map((name, idx) => `
        <div class="search-history-item" data-idx="${idx}">
          <span class="search-history-item__icon">🕐</span>
          <span class="search-history-item__name">${name}</span>
        </div>
      `).join('')}
    `;
    // 绑定历史项点击：填入搜索框并触发搜索
    box.querySelectorAll('.search-history-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx, 10);
        const name = list[idx];
        if (!name) return;
        document.getElementById('searchInput').value = name;
        hideSearchHistory();
        doSearch();  // 复用搜索逻辑（doSearch 内部会记录历史，去重后等价于置顶）
      });
    });
    // 绑定清空按钮
    const clearBtn = document.getElementById('searchHistoryClear');
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearSearchHistory();
        showToast('已清空搜索历史');
      });
    }
  }
  box.classList.add('is-show');
}

/* 隐藏搜索历史下拉 */
function hideSearchHistory() {
  const box = document.getElementById('searchHistory');
  if (box) box.classList.remove('is-show');
}
