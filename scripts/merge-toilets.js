#!/usr/bin/env node
/**
 * 合并全量公厕数据到 toilets.js
 * 保留 t001-t008 经典点位，替换 s 系列为全量拉取数据
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync('src/data/toilets.js', 'utf8');
const newData = JSON.parse(fs.readFileSync('scripts/toilets-output.json', 'utf8'));

// 找到 s001 的位置和 ]; 的位置
const s001Idx = src.indexOf("    id: 's001'");
const arrStart = src.lastIndexOf('\n', s001Idx);
const arrClose = src.indexOf('\n];', s001Idx);

const before = src.substring(0, arrStart);
const after = src.substring(arrClose + 3);

// 生成名称：名字为"公共厕所"的用地址+公厕
function makeName(p) {
  if (p.name && p.name !== '公共厕所' && p.name !== '公共卫生间') return p.name;
  if (p.address) return p.address + '公厕';
  return p.name || '公共厕所';
}

const lines = newData.map((p, i) => {
  const id = 's' + String(i + 1).padStart(3, '0');
  const name = makeName(p).replace(/'/g, "\\'");
  const addr = (p.address || '').replace(/'/g, "\\'");
  const status = p.name && p.name.includes('暂停营业') ? 'closed'
    : (p.name && p.name.includes('装修中') ? 'unknown' : 'open');
  return '  {\n' +
    "    id: '" + id + "',\n" +
    "    name: '" + name + "',\n" +
    '    lat: ' + p.lat + ',\n' +
    '    lng: ' + p.lng + ',\n' +
    "    source: 'amap',\n" +
    "    status: '" + status + "',\n" +
    '    accessible: ' + p.accessible + ',\n' +
    '    family: ' + p.family + ',\n' +
    '    water: ' + p.water + ',\n' +
    '    rating: 3,\n' +
    '    confidence: 0.5,\n' +
    '    last_update: Date.now() - 30 * 86400000,\n' +
    "    created_by: 'amap',\n" +
    "    address: '" + addr + "',\n" +
    '    comments: [],\n' +
    '  }';
});

const newContent = before + lines.join(',\n') + '\n];' + after;
fs.writeFileSync('src/data/toilets.js', newContent);
console.log('Done: ' + newData.length + ' entries written');
console.log('File size:', newContent.length, 'chars');
