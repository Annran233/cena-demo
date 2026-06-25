#!/usr/bin/env node
/**
 * 滨海新区公厕全量拉取脚本
 *
 * 用 text API（配额 150000/月）替代 around API（配额 5000/月）
 * 分页拉取滨海新区内所有公厕类 POI，输出为 toilets.js 格式
 *
 * 用法：
 *   AMAP_KEY=你的key node scripts/fetch-toilets.js
 *
 * 输出：scripts/toilets-output.json（供手动合并到 src/data/toilets.js）
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// 从环境变量获取 Key
const AMAP_KEY = process.env.AMAP_KEY;
if (!AMAP_KEY) {
  console.error('错误：请设置 AMAP_KEY 环境变量');
  console.error('  Windows PowerShell:  $env:AMAP_KEY="你的key"; node scripts/fetch-toilets.js');
  console.error('  Linux/Mac:          AMAP_KEY=你的key node scripts/fetch-toilets.js');
  process.exit(1);
}

const CITY = '滨海新区';
const CITY_LIMIT = true;
const KEYWORDS = '公共厕所|厕所|公厕|卫生间|洗手间';
const PAGE_SIZE = 25;  // 高德 text API 每页最多 25 条
const MAX_PAGES = 40;  // 安全上限

function fetchPage(page) {
  const params = new URLSearchParams({
    key: AMAP_KEY,
    keywords: KEYWORDS,
    city: CITY,
    city_limit: CITY_LIMIT.toString(),
    offset: PAGE_SIZE.toString(),
    page: page.toString(),
    extensions: 'base',
    output: 'json'
  });
  const url = `https://restapi.amap.com/v3/place/text?${params}`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON 解析失败（第${page}页）: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== 滨海新区公厕全量拉取 ===');
  console.log(`关键词: ${KEYWORDS}`);
  console.log(`城市: ${CITY} (city_limit=${CITY_LIMIT})`);
  console.log('');

  const allPois = [];
  const seenLocations = new Set();
  let total = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    process.stdout.write(`正在拉取第 ${page} 页...`);
    const data = await fetchPage(page);

    if (data.status !== '1') {
      console.log(` API 返回错误: ${data.info || JSON.stringify(data)}`);
      break;
    }

    const pois = data.pois || [];
    if (pois.length === 0) {
      console.log(' 无更多数据');
      break;
    }

    if (page === 1) {
      total = parseInt(data.count) || 0;
      console.log(` 共 ${total} 条记录`);
    }

    let newCount = 0;
    for (const p of pois) {
      if (!p.location) continue;
      if (seenLocations.has(p.location)) continue;
      seenLocations.add(p.location);

      const [lng, lat] = p.location.split(',').map(Number);
      const name = p.name;
      const addr = p.address || '';

      allPois.push({
        id: `s${String(allPois.length + 1).padStart(3, '0')}`,
        name: name,
        lat: lat,    // 高德返回的是 GCJ-02 坐标，toilets.js 需要 WGS-84
        lng: lng,    // 注意：app.js 会做 wgs84ToGcj02 转换，所以这里需要先反向转换
        source: 'amap',
        status: 'open',
        accessible: /无障碍|第三卫生|残疾/.test(name + addr),
        family: /母婴|婴儿|第三卫生|家庭/.test(name + addr),
        water: /水源|加水|房车|营地/.test(name + addr),
        rating: 3.0,
        confidence: 0.5,
        last_update: Date.now(),
        created_by: 'amap',
        address: addr,
        comments: []
      });
      newCount++;
    }
    console.log(` ${pois.length} 条（新增 ${newCount}，去重 ${pois.length - newCount}）`);

    if (pois.length < PAGE_SIZE) {
      console.log('已拉取最后一页');
      break;
    }

    // 避免请求过快
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('');
  console.log(`=== 拉取完成 ===`);
  console.log(`总计: ${allPois.length} 条（去重后）`);

  // 高德返回 GCJ-02 坐标，但 toilets.js 期望 WGS-84（app.js 会做 wgs84ToGcj02）
  // 这里需要 GCJ-02 → WGS-84 反向转换
  // 简化：直接在脚本里内联逆向转换算法
  function gcj02ToWgs84(lng, lat) {
    // GCJ-02 → WGS-84（逆向偏移近似）
    const PI = 3.1415926535897932384626;
    const a = 6378245.0;
    const ee = 0.00669342162296594323;
    function transformLat(x, y) {
      let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
      ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
      ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
      ret += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0;
      return ret;
    }
    function transformLng(x, y) {
      let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
      ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
      ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0;
      ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0;
      return ret;
    }
    let dLat = transformLat(lng - 105.0, lat - 35.0);
    let dLng = transformLng(lng - 105.0, lat - 35.0);
    const radLat = lat / 180.0 * PI;
    let magic = Math.sin(radLat);
    magic = 1 - ee * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * PI);
    dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * PI);
    return [lng - dLng, lat - dLat];  // [lng, lat]
  }

  // 转换坐标 GCJ-02 → WGS-84
  const wgs84Pois = allPois.map(p => {
    const [wgsLng, wgsLat] = gcj02ToWgs84(p.lng, p.lat);
    return { ...p, lat: wgsLat, lng: wgsLng };
  });

  // 输出 JSON
  const outputPath = path.join(__dirname, 'toilets-output.json');
  fs.writeFileSync(outputPath, JSON.stringify(wgs84Pois, null, 2));
  console.log(`\n已输出到: ${outputPath}`);
  console.log('\n下一步：将 JSON 内容合并到 src/data/toilets.js 的 MOCK_TOILETS 数组中');
  console.log('注意：保留 t001-t008 经典点位，替换 s 系列实查数据');
}

main().catch(err => {
  console.error('拉取失败:', err);
  process.exit(1);
});
