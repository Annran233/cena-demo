/* data/config.js — 配置常量
   依赖：core/geo.js (wgs84ToGcj02，在 app.js 中转换)
   复赛迁移：infra/config.ts（环境变量注入）

   === API 调用模式（初赛→复赛迁移路径）===
   AMAP_API_MODE = 'direct'  初赛：浏览器直连高德 REST API，Key 由 build.js 构建时注入
   AMAP_API_MODE = 'proxy'   复赛：通过 Cloudflare Pages Function 代理，Key 在服务端，前端零暴露
   切换步骤：部署 Pages Function → 改 AMAP_API_MODE 为 'proxy' → 重新构建
   当前部署：Cloudflare Pages（cena-demo.pages.dev / cenad.meowoflow.top）
*/

// API 调用模式（初赛 direct → 复赛 proxy）
const AMAP_API_MODE = 'proxy';

// 高德 API Key
// direct 模式：构建时由 build.js 从环境变量注入到 '__AMAP_KEY__' 占位符
// proxy  模式：前端零 Key 暴露，Key 在 Pages Function 服务端 env.AMAP_KEY 注入
// 切回 direct 时改为 '__AMAP_KEY__' 由 build.js 注入
const AMAP_KEY = '';

// API 基地址
// direct 模式：高德 REST API 直连
// proxy 模式：同源 Pages Function 代理（/api/amap/* → 服务端注入 Key）
const AMAP_API_BASE = AMAP_API_MODE === 'direct'
  ? 'https://restapi.amap.com/v3'
  : '/api/amap';

/* 统一 API URL 构造器（所有高德 API 调用的唯一入口）
   direct 模式：拼接 key 参数到 URL（浏览器直连高德，JSONP）
   proxy  模式：不带 key（Pages Function 服务端注入），前端零 Key 暴露
   amapJsonp() 内部根据 AMAP_API_MODE 自适应：
     - direct → JSONP（高德 callback 参数）
     - proxy  → fetch（Pages Function 返回 JSON） */
function amapApiUrl(path, params) {
  const sp = new URLSearchParams(params);
  if (AMAP_API_MODE === 'direct') {
    sp.set('key', AMAP_KEY);
  }
  return AMAP_API_BASE + path + '?' + sp.toString();
}

const AMAP_CITY = '滨海新区';

// === Demo 地理围栏：天津市滨海新区行政区 ===
// 顶点为 WGS-84 [lat, lng]，按顺时针方向
// 数据来源：高德行政区查询 + 民政部公开数据简化（保留主要边界点，海岸线侧外扩到 118.10E）
// 围栏内调高德 API，围栏外降级 Mock 模式（节省 5000次/月周边搜索配额）
const GEOFENCE_BINHAI = [
  [39.355, 117.410],  // 西北（汉沽西-宁河交界）
  [39.365, 117.760],  // 北（汉沽-杨家泊）
  [39.355, 117.870],  // 东北（汉沽东-渤海湾）
  [39.180, 118.100],  // 东（东疆港-天津港）
  [38.980, 118.080],  // 东（天津港南）
  [38.780, 117.970],  // 东南（大港东海岸）
  [38.620, 117.780],  // 南（南排河）
  [38.540, 117.520],  // 南（岐口）
  [38.580, 117.330],  // 西南（大港南-黄骅交界）
  [38.780, 117.290],  // 西（大港西-津南交界）
  [39.000, 117.300],  // 西（津南-东丽交界）
  [39.180, 117.350],  // 西北（东丽-宁河交界）
  [39.355, 117.410]   // 回到起点
];

// 默认 fallback 中心：吉运一道旁海港公园（WGS-84）
// 纪念意义地点：非滨海用户定位到此，围栏外用户也强制定位到此
// GPS 定位成功且在围栏内时覆盖此值
const USER_LOC_WGS = [39.040117, 117.736383];

// 判断 WGS-84 坐标是否在 Demo 围栏内（用于 API 调用前拦截、上报坐标校验）
function isInGeofence(lat, lng) {
  return pointInPolygon(lat, lng, GEOFENCE_BINHAI);
}

const PRESET_LOCATIONS_RAW = {
  '海港公园': [39.040117, 117.736383],
  '吉运一道': [39.037712, 117.746315],
  '塘沽': [39.0242, 117.7058],
  '塘沽外滩': [39.0242, 117.7058],
  '外滩公园': [39.0242, 117.7058],
  '滨海文化中心': [39.0178, 117.7112],
  '滨海图书馆': [39.0178, 117.7112],
  '泰达': [39.0720, 117.7150],
  '开发区': [39.0720, 117.7150],
  '塘沽火车站': [39.0338, 117.7060],
  '滨海站': [39.0080, 117.7250],
  '于家堡': [39.0080, 117.7250],
  '北塘': [39.1030, 117.7500],
  '北塘古镇': [39.1030, 117.7500],
  '海洋博物馆': [39.1000, 117.7700],
  '国家海洋博物馆': [39.1000, 117.7700],
  '大港': [38.8400, 117.5450],
  '大港公园': [38.8400, 117.5450],
  '汉沽': [39.2500, 117.7900],
  '汉沽中心': [39.2500, 117.7900],
  '滨海新区': [39.0242, 117.7058],
  '天津': [39.0242, 117.7058],
};

// 定位失败时的 fallback 中心（塘沽外滩公园，WGS-84，在围栏内）
const FALLBACK_CENTER_WGS = USER_LOC_WGS;

// 用户上报厕所的 localStorage 存储 key
const USER_TOILETS_STORAGE_KEY = 'cena_user_toilets';
// 本设备上报计数 key（频率限制，24h 内 ≤5 个）
const USER_REPORT_COUNT_KEY = 'cena_report_count';
// 用户补充设施标签 key（针对高德/amap-live 点位补标签，坐标匹配）
const TAG_SUPPLEMENTS_KEY = 'cena_tag_supplements';
// 位置描述补充 key（针对高德/amap-live 点位补描述，坐标匹配）
const DESC_SUPPLEMENTS_KEY = 'cena_desc_supplements';
// 逆地理 API（校验坐标合理性，拦截海上/荒野）— 走统一 URL 构造器
const AMAP_REGEO_URL = (lat, lng) => amapApiUrl('/geocode/regeo', { location: lng + ',' + lat, extensions: 'base' });

// 会话级高德 API 请求上限（防 Demo 上线后被刷导致账单暴涨）
// 单次页面会话累计超过此值后阻止后续 API 请求，仅本地 Mock/Preset 可用
// 正常 Demo 一次评审约 50-100 次请求，200 留 2x 安全 余量
const SESSION_API_LIMIT = 200;

// ======== 用户身份 mock（纯 localStorage，无后端） ========
// 存储 key：昵称 + 头像emoji + 贡献统计
const USER_PROFILE_KEY = 'cena_user_profile';
// 头像候选池：厕所主题emoji
const USER_AVATAR_POOL = ['🚻', '🧻', '🚽', '🚿', '🧼', '🪣', '🧴'];
// 昵称前缀候选池：调查兵团风格
const USER_NICK_PREFIXES = ['调查兵团', '侦察队', '突击队', '先遣组', '情报员'];
// 昵称编号范围：1024 ~ 9999
const USER_NICK_MIN = 1024;
const USER_NICK_MAX = 9999;
