/* build.js — 初赛构建脚本
   将 src/ 下模块化代码合并为单文件 index.html（初赛交付物）
   用法：node build.js
   无 npm 依赖，纯 Node.js fs

   === API Key 注入策略（按 AMAP_API_MODE 自适应）===
   direct 模式（前端直连高德）：
     - 构建时从环境变量 AMAP_KEY 读取，替换源码占位符 __AMAP_KEY__
     - 未设置时降级为 'YOUR_AMAP_KEY_HERE'（Demo 模式，仅预设地点）
     - 本地：set AMAP_KEY=xxx（Win）/ export AMAP_KEY=xxx（Mac/Linux）
     - CI/CD：GitHub Secrets 中配置 AMAP_KEY

   proxy 模式（Pages Function 代理，当前启用）：
     - 源码中无 __AMAP_KEY__ 占位符（config.js 中 AMAP_KEY = ''）
     - 构建时不需要 AMAP_KEY 环境变量，前端零 Key 暴露
     - Key 在 Cloudflare Pages 后台配置（环境变量 AMAP_KEY）
*/
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');

// JS 模块加载顺序（按依赖关系，全局作用域拼接）
const JS_ORDER = [
  'core/geo.js',        // 无依赖
  'core/confidence.js', // 依赖 geo.daysSince
  'core/status.js',     // 依赖 geo.daysSince
  'data/toilets.js',    // 无依赖（纯数据）
  'data/config.js',     // 无依赖（纯配置）
  'ui/utils.js',        // 无依赖
  'ui/map.js',          // 依赖 geo, status, data, panel.openPanel
  'ui/panel.js',        // 依赖 confidence, status, utils, map.renderMarkers, nearby.renderNearbyList
  'ui/nearby.js',       // 依赖 geo, status, map, panel
  'ui/search.js',       // 依赖 geo, data, utils, map, nearby
  'app.js',             // 依赖所有，入口
];

const css = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8');
let js = JS_ORDER.map(f => {
  const content = fs.readFileSync(path.join(SRC, f), 'utf8');
  return '/* === ' + f + ' === */\n' + content;
}).join('\n\n');

// API Key 注入：仅当代码中存在 AMAP_KEY 赋值占位符（direct 模式）时才需要环境变量
// 注意：检测赋值表达式 `= '__AMAP_KEY__'` 而非裸字符串，避免误匹配 config.js 中的注释
const amapKeyPlaceholder = /AMAP_KEY\s*=\s*['"]__AMAP_KEY__['"]/;
if (amapKeyPlaceholder.test(js)) {
  const AMAP_KEY = process.env.AMAP_KEY || 'YOUR_AMAP_KEY_HERE';
  if (AMAP_KEY === 'YOUR_AMAP_KEY_HERE') {
    console.warn('[build] ⚠️ direct 模式未设置 AMAP_KEY 环境变量，构建产物将以 Demo 模式运行（仅预设地点，不调高德 API）');
    console.warn('[build] 本地开发：set AMAP_KEY=你的key（Windows）/ export AMAP_KEY=你的key（Mac/Linux）');
    console.warn('[build] CI/CD：在 GitHub Secrets 中配置 AMAP_KEY');
  }
  js = js.replace(/__AMAP_KEY__/g, AMAP_KEY);
} else {
  // proxy 模式：源码无占位符，Key 在 Pages Function 服务端注入，前端零暴露
  console.log('[build] proxy 模式：前端不注入 AMAP_KEY，Key 由 Pages Function 服务端注入');
}

let template = fs.readFileSync(path.join(ROOT, 'index.template.html'), 'utf8');
template = template.replace('/* {{STYLES}} */', css);
template = template.replace('/* {{SCRIPTS}} */', js);

fs.writeFileSync(path.join(ROOT, 'index.html'), template, 'utf8');
console.log('Build complete: index.html (' + template.length + ' chars, ' + JS_ORDER.length + ' modules)');
