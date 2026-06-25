/* scripts/gen-mock.js — 从 toilets-seed.json 生成 MOCK_TOILETS 代码片段
   保留原 toilets.js 中有评论/特殊状态的经典点位（t001-t009）
   实查数据作为 amap 基础点位（status='open'，无评论，confidence=0.5）
   输出：src/data/toilets-generated.js（手动合并到 toilets.js）*/
const fs = require('fs');
const path = require('path');

const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'toilets-seed.json'), 'utf8'));

// 原有经典点位（有评论/特殊状态，保留人工编写的丰富度）
const classic = [
  {
    id: 't001', name: '塘沽外滩公园公共厕所', lat: 39.0242, lng: 117.7058,
    source: 'amap', status: 'open', accessible: true, family: false, water: false,
    rating: 4.0, confidence: 0.8, last_update: 'Date.now() - 5 * 86400000', created_by: 'amap',
    address: '上海市道与永太路交口',
    comments: [
      { user: '滨海小张', rating: 4, text: '外滩公园入口左侧，标识清楚，海河风景好', time: '2026-06-20' },
      { user: '海鸥哥', rating: 4, text: '周末人多要排队，平时还算干净', time: '2026-06-22' }
    ]
  },
  {
    id: 't002', name: '滨海文化中心公共厕所（用户上报）', lat: 39.0178, lng: 117.7112,
    source: 'user', status: 'open', accessible: true, family: true, water: false,
    rating: 4.8, confidence: 0.9, last_update: 'Date.now() - 2 * 86400000', created_by: 'ou_user_001',
    address: '旭升路 267 号',
    comments: [
      { user: '读书人', rating: 5, text: '滨海图书馆旁边，第三卫生间有婴儿台，带娃友好', time: '2026-06-23' }
    ]
  },
  {
    id: 't003', name: '塘沽火车站公共厕所', lat: 39.0338, lng: 117.7060,
    source: 'amap+user', status: 'open', accessible: true, family: true, water: true,
    rating: 4.5, confidence: 0.95, last_update: 'Date.now() - 3 * 86400000', created_by: 'ou_user_003',
    address: '大连道 254 号',
    comments: [
      { user: '出差党', rating: 5, text: '出站口右转，有水源有排污口，无障碍间宽敞，自驾通勤必停', time: '2026-06-22' }
    ]
  },
  {
    id: 't004', name: '海河公园（塘沽段）公共厕所', lat: 39.0350, lng: 117.6950,
    source: 'amap+user', status: 'locked', accessible: false, family: false, water: false,
    rating: 2.0, confidence: 0.8, last_update: 'Date.now() - 1 * 86400000', created_by: 'amap',
    address: '海河岸边步道',
    comments: [
      { user: '晨练大爷', rating: 1, text: '今早路过发现锁门了，应该是水管问题在修', time: '2026-06-25' }
    ]
  },
  {
    id: 't006', name: '北塘古镇旅游公厕', lat: 39.1030, lng: 117.7500,
    source: 'amap', status: 'repair', accessible: false, family: false, water: false,
    rating: 2.5, confidence: 0.65, last_update: 'Date.now() - 10 * 86400000', created_by: 'amap',
    address: '北塘大街古镇北门',
    comments: [
      { user: '游客甲', rating: 2, text: '节假日维修中，不知道什么时候好', time: '2026-06-15' }
    ]
  },
  {
    id: 't007', name: '国家海洋博物馆公共厕所', lat: 39.1000, lng: 117.7700,
    source: 'amap', status: 'open', accessible: true, family: true, water: false,
    rating: 4.6, confidence: 0.75, last_update: 'Date.now() - 7 * 86400000', created_by: 'amap',
    address: '海轩道 377 号',
    comments: [
      { user: '亲子游妈妈', rating: 5, text: '馆内每层都有，第三卫生间超大，环境好', time: '2026-06-18' }
    ]
  },
  {
    id: 't008', name: '于家堡金融区公共厕所', lat: 39.0080, lng: 117.7250,
    source: 'amap', status: 'removed', accessible: false, family: false, water: false,
    rating: 1.0, confidence: 0.9, last_update: 'Date.now() - 60 * 86400000', created_by: 'amap',
    confirm_count: 3, last_removed_report_time: 'Date.now() - 60 * 86400000',
    address: '融义路与金河道交口',
    comments: [
      { user: '金融街上班族', rating: 1, text: '此处曾有临时公厕，金融区改造时拆了', time: '2025-10-15' },
      { user: '路过群众', rating: 1, text: '导航到了发现没厕所了，建议附近商铺解决', time: '2025-11-02' },
      { user: '北川', rating: 1, text: '确认拆了，现在是绿地广场', time: '2026-05-20' }
    ]
  }
];

// 实查数据：去重经典点位后，生成 amap 基础点位
const classicCoords = classic.map(t => `${t.lat.toFixed(4)},${t.lng.toFixed(4)}`);
const seedPois = seed.pois.filter(p => {
  // 距经典点位 >100m 才纳入（避免重复）
  return !classicCoords.some(c => {
    const [clat, clng] = c.split(',').map(Number);
    return Math.abs(p.lat - clat) < 0.001 && Math.abs(p.lng - clng) < 0.001;
  });
});

// 从 seed 生成 MOCK 对象（status='open'，无评论，confidence=0.5）
const seedMocks = seedPois.map((p, i) => {
  // 名称优化：纯"公共厕所"加地址后缀
  let name = p.name;
  if (name === '公共厕所' || name === '卫生间') {
    name = p.address ? p.address.replace(/交叉口.*$/, '') + '公厕' : '公共厕所';
  }
  return {
    id: 's' + String(i + 1).padStart(3, '0'),
    name: name,
    lat: p.lat,
    lng: p.lng,
    source: 'amap',
    status: 'open',
    accessible: /无障碍|第三卫生|残疾/.test(p.name + p.address),
    family: /母婴|婴儿|第三卫生|家庭/.test(p.name + p.address),
    water: false,
    rating: 3.0,
    confidence: 0.5,
    last_update: 'Date.now() - 30 * 86400000',  // 标记为较旧（待用户确认）
    created_by: 'amap',
    address: p.address,
    comments: []
  };
});

const all = [...classic, ...seedMocks];

// 生成代码
function objToCode(obj, indent) {
  const lines = [];
  for (const [k, v] of Object.entries(obj)) {
    let val;
    if (k === 'last_update' || k === 'last_removed_report_time') {
      val = v;  // 已是代码字符串
    } else if (k === 'comments') {
      val = JSON.stringify(v);
    } else if (typeof v === 'string') {
      val = `'${v.replace(/'/g, "\\'")}'`;
    } else if (typeof v === 'boolean' || typeof v === 'number') {
      val = String(v);
    } else {
      val = JSON.stringify(v);
    }
    lines.push(`${indent}${k}: ${val},`);
  }
  return lines.join('\n');
}

let code = `/* data/toilets.js — Mock 厕所数据（实查种子 + 经典点位）
   依赖：无（坐标为 WGS-84，app.js 统一转 GCJ-02）
   复赛迁移：infra/db/seed.js（替换为云数据库种子数据）

   === Demo 地理围栏：天津市滨海新区 ===
   种子数据来源：高德 around API 实查（5 热点区域，81 条去重）
   拉取时间：${seed.fetched_at}
   覆盖热点：${seed.hotspots.join(' / ')}
   围栏外降级为 Mock 模式时仍可正常使用这些点位

   数据分层：
   - t001-t008：经典点位（有评论/特殊状态，展示状态机/确认机制）
   - s001-s074：实查基础点位（status='open'，confidence=0.5，待用户确认）
*/

const MOCK_TOILETS = [
`;

all.forEach((t, i) => {
  code += `  {\n${objToCode(t, '    ')}\n  }`;
  if (i < all.length - 1) code += ',';
  code += '\n';
});

code += '];\n';

const outPath = path.join(__dirname, '..', 'src', 'data', 'toilets-generated.js');
fs.writeFileSync(outPath, code, 'utf8');
console.log(`[done] ${all.length} 条 MOCK_TOILETS（经典 ${classic.length} + 实查 ${seedMocks.length}）→ ${outPath}`);
