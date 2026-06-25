/* ui/search.js — 搜索 + 联想 + 高德 API
   依赖：core/geo.js, data/toilets.js, data/config.js, ui/utils.js, ui/map.js, ui/nearby.js
   复赛迁移：web/src/api/amap.ts + web/src/components/SearchBar.ts
*/

let searchCenter, searchCenterName = '我的位置', searchPinMarker = null;
let jsonpCounter = 0;
let searchReqId = 0; // 搜索请求序号，防止异步竞态（旧请求覆盖新结果）

/* ============ 会话级 API 请求计数 + 限流 ============ */
// 防止 Demo 上线后被恶意刷接口导致高德账单暴涨
// 单次页面会话累计超过 SESSION_API_LIMIT 后阻止后续请求
let sessionApiCount = 0;

// 检查是否还能发请求；能则计数+1 返回 true，超限返回 false 并 toast
function checkApiQuota() {
  if (sessionApiCount >= SESSION_API_LIMIT) {
    showToast('今日体验次数已达上限，刷新页面可重置');
    return false;
  }
  sessionApiCount++;
  return true;
}

/* amapJsonp — 高德 API 统一请求入口（命名保留历史，实际按 AMAP_API_MODE 自适应）
   direct 模式：JSONP（浏览器直连高德，绕过 CORS）
   proxy  模式：fetch（同源 Pages Function 返回 JSON）
   panel.js 的逆地理 regeo 也通过此函数调用，自适应无需改动 */
function amapJsonp(url) {
  // proxy 模式：同源 fetch，Pages Function 返回 JSON
  if (AMAP_API_MODE === 'proxy') {
    if (!checkApiQuota()) return Promise.reject(new Error('会话请求已达上限'));
    return fetch(url, { method: 'GET' })
      .then(r => r.json())
      .catch(() => { throw new Error('请求失败'); });
  }
  // direct 模式：JSONP
  return new Promise((resolve, reject) => {
    // 会话级请求计数检查（所有高德 API 调用的统一入口）
    if (!checkApiQuota()) { reject(new Error('会话请求已达上限')); return; }
    const cbName = '__amapCb_' + (++jsonpCounter) + '_' + Date.now();
    const script = document.createElement('script');
    script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + cbName;
    script.onerror = () => { reject(new Error('请求失败')); cleanup(); };
    const timeout = setTimeout(() => { reject(new Error('超时')); cleanup(); }, 5000);
    function cleanup() {
      clearTimeout(timeout);
      delete window[cbName];
      script.remove();
    }
    window[cbName] = (data) => { resolve(data); cleanup(); };
    document.head.appendChild(script);
  });
}

async function amapSearchPoi(keywords) {
  if (AMAP_KEY === 'YOUR_AMAP_KEY_HERE') return null;
  const centerLng = searchCenter[1], centerLat = searchCenter[0];

  // 围栏检查：around 周边搜索围栏外跳过（省配额）；text 搜索已用 city 限定滨海，无需围栏拦截
  // searchCenter 是 GCJ-02，GEOFENCE 是 WGS-84，误差几百米对行政区判断可接受
  const inFence = isInGeofence(centerLat, centerLng);

  // 策略：text 滨海区内搜索为主（city 限定），around 周边搜索为辅（补足附近同名 POI）
  // 小而精：搜索范围与围栏对齐，结果全部在滨海新区内，无全国噪音
  const aroundPromise = (async () => {
    if (!inFence) return [];  // 围栏外跳过 around 搜索
    const url = amapApiUrl('/place/around', { location: centerLng + ',' + centerLat, keywords: keywords, radius: 10000, offset: 8, page: 1, extensions: 'base', sortrule: 'distance' });
    try {
      const data = await amapJsonp(url);
      if (data.status === '1' && data.pois && data.pois.length > 0) {
        return data.pois
          .filter(p => !p.distance || parseInt(p.distance) <= 10000)
          // around 的 keywords 是模糊匹配，只保留名称包含完整关键词的 POI，过滤噪音
          .filter(p => p.name.includes(keywords))
          .map(p => ({
            name: p.name,
            address: p.address || (p.cityname || '') + (p.adname || '') + (p.address || ''),
            location: p.location,
            typecode: p.typecode,
            _dist: p.distance ? parseInt(p.distance) : haversine(centerLat, centerLng, parseFloat(p.location.split(',')[1]), parseFloat(p.location.split(',')[0])),
            _src: 'around'
          }));
      }
    } catch (e) {}
    return [];
  })();

  const textPromise = (async () => {
    // text 搜索限定滨海新区（city 参数）：Demo 范围小而精，避免全国噪音结果
    // 高德 city 参数支持城市名/区名/adcode，传"滨海新区"限定结果到区内
    const url = amapApiUrl('/place/text', { keywords: keywords, city: '滨海新区', city_limit: true, offset: 20, page: 1, extensions: 'base' });
    try {
      const data = await amapJsonp(url);
      if (data.status === '1' && data.pois && data.pois.length > 0) {
        return data.pois.map(p => {
          const [lng, lat] = p.location.split(',').map(Number);
          return {
            name: p.name,
            address: p.address || (p.cityname || '') + (p.adname || '') + (p.address || ''),
            location: p.location,
            typecode: p.typecode,
            _dist: haversine(centerLat, centerLng, lat, lng),
            _src: 'text'
          };
        });
      }
    } catch (e) {}
    return [];
  })();

  const [aroundResults, textResults] = await Promise.all([aroundPromise, textPromise]);

  // 合并去重（按 location 坐标去重）
  const seen = new Set();
  const all = [...textResults, ...aroundResults].filter(p => {
    if (seen.has(p.location)) return false;
    seen.add(p.location);
    return true;
  });

  // 名称匹配度排序：完全匹配 > 前缀匹配 > 包含匹配 > 模糊匹配
  // 同匹配度内 text 在前（高德相关性），around 在后补充
  // 避免搜"南京市人民政府"时区政府因 POI 权重或距离被排到前面
  function nameMatchRank(name, kw) {
    if (name === kw) return 0;
    if (name.startsWith(kw)) return 1;
    if (name.includes(kw)) return 2;
    return 3;
  }
  all.sort((a, b) => {
    const ra = nameMatchRank(a.name, keywords);
    const rb = nameMatchRank(b.name, keywords);
    if (ra !== rb) return ra - rb;
    // 同匹配度：text 结果在前（高德已按相关性排好），around 在后
    if (a._src !== b._src) return a._src === 'text' ? -1 : 1;
    return a._dist - b._dist;
  });
  return all.length > 0 ? all : null;
}

async function fetchNearbyToilets(coords) {
  if (AMAP_KEY === 'YOUR_AMAP_KEY_HERE') return [];
  const [lat, lng] = coords;
  // 围栏外降级：不调 around API，仅用 Mock 数据（节省 5000次/月配额）
  if (!isInGeofence(lat, lng)) {
    showToast('当前区域超出 Demo 服务区（滨海新区），仅显示预设数据');
    return [];
  }
  const keywords = '公共厕所|厕所|公厕|卫生间|洗手间';
  const url = amapApiUrl('/place/around', { location: lng + ',' + lat, keywords: keywords, radius: 2000, offset: 20, page: 1, extensions: 'base', sortrule: 'distance' });
  try {
    const data = await amapJsonp(url);
    if (data.status === '1' && data.pois && data.pois.length > 0) {
      return data.pois.map(p => {
        const [pLng, pLat] = p.location.split(',').map(Number);
        const dist = p.distance ? parseInt(p.distance) : haversine(lat, lng, pLat, pLng);
        return {
          id: 'live_' + (++liveToiletIdCounter),
          name: p.name,
          lat: pLat,
          lng: pLng,
          source: 'amap-live',
          status: 'open',
          accessible: /无障碍|第三卫生|残疾/.test(p.name + (p.address || '')),
          family: /母婴|婴儿|第三卫生|家庭/.test(p.name + (p.address || '')),
          water: /水源|加水|房车|营地/.test(p.name + (p.address || '')),
          rating: 3.0,
          confidence: 0.5,
          last_update: Date.now(),
          created_by: 'amap',
          address: p.address || '',
          _dist: dist,
          comments: []
        };
      });
    }
  } catch (e) {}
  return [];
}

/* 判断搜索结果 POI 是否为厕所类（typecode 2003xx 或名称含厕所关键词） */
function isToiletPoi(item) {
  if (item.typecode && /^2003/.test(item.typecode)) return true;
  return /厕所|公厕|卫生间|洗手间/.test(item.name || '');
}

/* 把搜索结果 POI 转成 toilet 对象（复用 fetchNearbyToilets 的字段映射） */
function poiToToilet(item) {
  const [lng, lat] = item.location.split(',').map(Number);
  const name = item.name;
  const addr = item.address || '';
  return {
    id: 'live_' + (++liveToiletIdCounter),
    name: name,
    lat: lat,
    lng: lng,
    source: 'amap-live',
    status: 'open',
    accessible: /无障碍|第三卫生|残疾/.test(name + addr),
    family: /母婴|婴儿|第三卫生|家庭/.test(name + addr),
    water: /水源|加水|房车|营地/.test(name + addr),
    rating: 3.0,
    confidence: 0.5,
    last_update: Date.now(),
    created_by: 'amap',
    address: addr,
    _dist: 0,
    comments: []
  };
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
  const [lng, lat] = item.location.split(',').map(Number);
  // 搜索结果是厕所类 POI 时，确保它显示在地图上和周边列表里（fetchNearbyToilets 可能不返回它）
  const ensureToilet = isToiletPoi(item) ? poiToToilet(item) : null;
  setSearchCenter([lat, lng], item.name, 15, ensureToilet);
  showToast('已定位到：' + item.name + '，周边厕所已更新');
}

function setSearchCenter(coords, name, zoom, ensureToilet) {
  searchCenter = coords;
  searchCenterName = name;
  if (searchPinMarker) map.removeLayer(searchPinMarker);
  // 只有真正获取过GPS定位后，"我的位置"才视为用户位置（隐藏按钮）
  // 初始fallback位置（张北）：不显示搜索图钉（脉冲蓝点已标记），但按钮保持可见引导用户点击定位
  const hasGpsFix = window._hasGpsFix === true;
  const isUserLoc = hasGpsFix && ((coords === USER_LOC) || (name === '我的位置'));
  const isInitialFallback = !hasGpsFix && name === '我的位置';
  if (!isUserLoc && !isInitialFallback) {
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

  // 合并 ensureToilet 到 liveToilets（按坐标去重，若不存在则置顶）
  const mergeEnsure = (toilets) => {
    if (!ensureToilet) return toilets;
    const exists = toilets.some(t => Math.abs(t.lat - ensureToilet.lat) < 1e-6 && Math.abs(t.lng - ensureToilet.lng) < 1e-6);
    return exists ? toilets : [ensureToilet, ...toilets];
  };

  if (isUserLoc) {
    liveToilets = ensureToilet ? [ensureToilet] : [];
    renderMarkers();
    renderNearbyList();
    // 用户位置（GPS 或默认 fallback）也拉取周边厕所 POI
    fetchNearbyToilets(coords).then(toilets => {
      liveToilets = mergeEnsure(toilets);
      renderMarkers();
      renderNearbyList();
    });
  } else {
    liveToilets = ensureToilet ? [ensureToilet] : [];
    renderMarkers();
    renderNearbyList();
    fetchNearbyToilets(coords).then(toilets => {
      liveToilets = mergeEnsure(toilets);
      renderMarkers();
      renderNearbyList();
      if (toilets.length > 0) {
        showToast(`已加载${name}周边${toilets.length}个厕所`);
      }
    });
  }
  const list = document.getElementById('nearbyList');
  list.classList.remove('is-collapsed');
  document.getElementById('nearbyToggle').textContent = '收起 ▲';
}

const onSearchInput = debounce(async () => {
  const myReqId = ++searchReqId; // 请求序号，防止异步竞态
  const q = document.getElementById('searchInput').value.trim();
  const box = document.getElementById('searchSuggest');
  if (q.length < 2) { box.classList.remove('is-show'); return; }

  const localItems = [];
  MOCK_TOILETS.forEach(t => {
    if (t.name.includes(q)) {
      const dist = haversine(searchCenter[0], searchCenter[1], t.lat, t.lng);
      localItems.push({ name: t.name, addr: '公共厕所', location: t.lng + ',' + t.lat, icon: '🚾', dist });
    }
  });
  Object.entries(PRESET_LOCATIONS).forEach(([key, coords]) => {
    if (q.includes(key) || key.includes(q)) {
      const dist = haversine(searchCenter[0], searchCenter[1], coords[0], coords[1]);
      localItems.push({ name: key, addr: '地点', location: coords[1] + ',' + coords[0], icon: '📍', dist });
    }
  });
  if (localItems.length > 0) {
    localItems.sort((a, b) => a.dist - b.dist);
    if (myReqId === searchReqId) renderSuggest(localItems.slice(0, 8));
  }

  const amapItems = await amapSearchPoi(q);
  if (myReqId !== searchReqId) return; // 已有更新请求，丢弃旧结果
  if (amapItems) {
    amapItems.forEach(it => {
      const [lng, lat] = it.location.split(',').map(Number);
      it.dist = it._dist != null ? it._dist : haversine(searchCenter[0], searchCenter[1], lat, lng);
      it.icon = '📍'; it.addr = it.address;
    });
    // amapItems 已按名称匹配度+高德相关性排序，localItems 追加在末尾
    const merged = [...amapItems];
    localItems.forEach(l => {
      if (!merged.some(a => a.name === l.name || Math.abs(a.dist - l.dist) < 50)) {
        merged.push(l);
      }
    });
    renderSuggest(merged.slice(0, 8));
  }
}, 300);

function doSearch() {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) return;
  const hit = MOCK_TOILETS.find(t => t.name.includes(q) || t.name.toLowerCase().includes(q.toLowerCase()));
  if (hit) {
    setSearchCenter([hit.lat, hit.lng], hit.name, 16);
    openPanel(hit);
    showToast('已定位到：' + hit.name);
    return;
  }
  for (const [key, coords] of Object.entries(PRESET_LOCATIONS)) {
    if (q.includes(key)) {
      setSearchCenter(coords, key, 15);
      showToast('已定位到：' + key + '，周边厕所已更新');
      return;
    }
  }
  amapSearchPoi(q).then(amapItems => {
    if (amapItems && amapItems.length > 0) {
      // 多个结果时显示搜索建议列表让用户选择，避免按距离排序后取到不相关的近处结果
      if (amapItems.length === 1) {
        selectSuggest(amapItems[0]);
      } else {
        amapItems.forEach(it => {
          it.icon = '📍'; it.addr = it.address;
        });
        renderSuggest(amapItems.slice(0, 8));
      }
    } else {
      showToast(AMAP_KEY === 'YOUR_AMAP_KEY_HERE' ? '未配置高德 Key，仅支持预设地点' : '未找到地点，换个关键词试试');
    }
  });
}
