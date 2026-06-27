/* data/metro.js — 轨道交通厕所数据（9号线全线21站 + Z4线北段10站）
   依赖：无（坐标为 GCJ-02 高德坐标系，来自高德 maps_search_detail 实查）
   复赛迁移：infra/db/seed_metro.js

   数据来源：
   - 9号线厕所状态：天津轨道交通运营集团官网 & 实地核实（2026-06）
   - Z4线北段：环评文件标配厕所
   - 坐标：高德地图 POI detail 接口精确查询（location 字段，GCJ-02）

   颜色编码（圆点统一风格）：
   - type:'inside'  → 绿色（站内有厕所，付费区/非付费区均可）
   - type:'outside' → 黄色（车站外厕所，出站可达但不在站内）
   - type:'none'    → 红色（无厕所，暂不具备设置条件）
*/

const METRO_LINES = {
  /* 9号线（津滨轻轨）：天津站—东海路，全长52.25km，21站 */
  line9: {
    name: '9号线（津滨轻轨）',
    color: '#005BAC',  /* 9号线官方蓝 */
    stations: [
      { name: '天津站',     lng: 117.209923, lat: 39.138123, type: 'inside',  detail: '付费区 | 9号线站台往天津站方向车头' },
      { name: '大王庄',     lng: 117.218471, lat: 39.127225, type: 'inside',  detail: '付费区 | 往东海路方向站台车头' },
      { name: '十一经路',   lng: 117.2258,   lat: 39.1205,   type: 'inside',  detail: '付费区 | 往天津站方向站台车头' },
      { name: '直沽',       lng: 117.2355,   lat: 39.1118,   type: 'inside',  detail: '付费区 | 往天津站方向站台车头' },
      { name: '东兴路',     lng: 117.2488,   lat: 39.1062,   type: 'inside',  detail: '付费区 | 往天津站方向站台车头' },
      { name: '中山门',     lng: 117.264325, lat: 39.100884, type: 'inside',  detail: '付费区 | 通B/C出入口站厅客服中心附近' },
      { name: '一号桥',     lng: 117.2820,   lat: 39.0955,   type: 'inside',  detail: '付费区 | 通B/C出入口站厅客服中心附近' },
      { name: '二号桥',     lng: 117.2995,   lat: 39.0910,   type: 'inside',  detail: '付费区 | 通B/C出入口站厅客服中心附近' },
      { name: '张贵庄',     lng: 117.3260,   lat: 39.0868,   type: 'inside',  detail: '非付费区 | 站厅C/D出入口中间连廊' },
      { name: '新立',       lng: 117.3490,   lat: 39.0832,   type: 'inside',  detail: '非付费区 | 站厅A出入口自动售票机附近' },
      { name: '东丽开发区', lng: 117.3700,   lat: 39.0795,   type: 'inside',  detail: '非付费区 | 站厅A出入口安检点附近' },
      { name: '小东庄',     lng: 117.4080,   lat: 39.0660,   type: 'none',    detail: '暂不具备设置条件 | 21站中仅2站无厕所' },
      { name: '军粮城',     lng: 117.456102, lat: 39.048049, type: 'outside', detail: '车站外 | A出入口出站对面' },
      { name: '钢管公司',   lng: 117.503891, lat: 39.039772, type: 'outside', detail: '车站外 | B出入口出站100米公共卫生间' },
      { name: '胡家园',     lng: 117.607373, lat: 39.040524, type: 'none',    detail: '暂不具备设置条件 | 近天津大道快速路段' },
      { name: '塘沽',       lng: 117.661050, lat: 39.029556, type: 'inside',  detail: '非付费区 | 站厅B出入口进站闸机对面' },
      { name: '泰达',       lng: 117.679373, lat: 39.025523, type: 'inside',  detail: '非付费区 | 站厅A出入口进站闸机对面' },
      { name: '市民广场',   lng: 117.703060, lat: 39.018183, type: 'inside',  detail: '非付费区 | 站厅A3/B4出入口旁' },
      { name: '太湖路',     lng: 117.723405, lat: 39.019896, type: 'inside',  detail: '非付费区 | 站厅A/D出入口旁' },
      { name: '会展中心',   lng: 117.731698, lat: 39.029989, type: 'inside',  detail: '非付费区 | 站厅B出入口旁' },
      { name: '东海路',     lng: 117.737288, lat: 39.040571, type: 'inside',  detail: '非付费区 | 站厅B出入口旁（终点站）' }
    ]
  },
  /* Z4线一期北段：寨上—北塘，全长23.7km，10站（2026-01-18开通）
     注意：Z4线为新开通线路，环评文件确认标配厕所，但站内厕所具体位置（付费区/非付费区/方位）
     暂无官方公开数据，detail 不做位置臆测，标注"具体位置待核实" */
  z4north: {
    name: 'Z4线北段',
    color: '#C864B8',  /* Z4线官方藕荷色/粉紫色（高德地图实际显示色） */
    stations: [
      { name: '寨上',       lng: 117.817838, lat: 39.227289, type: 'inside', detail: 'Z4线环评标配 | 具体位置待核实（终点站）' },
      { name: '汉沽医院',   lng: 117.830121, lat: 39.221343, type: 'inside', detail: 'Z4线环评标配 | 具体位置待核实' },
      { name: '中心渔港',   lng: 117.850375, lat: 39.208928, type: 'inside', detail: 'Z4线环评标配 | 具体位置待核实' },
      { name: '玉砂道',     lng: 117.818402, lat: 39.182932, type: 'inside', detail: 'Z4线环评标配 | 具体位置待核实' },
      { name: '航母公园',   lng: 117.802015, lat: 39.166619, type: 'inside', detail: 'Z4线环评标配 | 具体位置待核实' },
      { name: '软件园',     lng: 117.792060, lat: 39.150538, type: 'inside', detail: 'Z4线环评标配 | 具体位置待核实' },
      { name: '绿创园',     lng: 117.778870, lat: 39.135219, type: 'inside', detail: 'Z4线环评标配 | 具体位置待核实' },
      { name: '和顺路',     lng: 117.762927, lat: 39.118959, type: 'inside', detail: 'Z4线环评标配 | 具体位置待核实' },
      { name: '中新生态城', lng: 117.752486, lat: 39.108335, type: 'inside', detail: 'Z4线环评标配 | 具体位置待核实' },
      { name: '北塘',       lng: 117.724432, lat: 39.093467, type: 'inside', detail: 'Z4线环评标配 | 具体位置待核实（换乘Z2线）' }
    ]
  }
};

/* 站点厕所状态 → 圆点颜色映射 */
const METRO_COLORS = {
  inside:  '#4CAF50',  /* 绿色：站内有厕所 */
  outside: '#FFC107',  /* 黄色：车站外厕所 */
  none:    '#F44336'   /* 红色：无厕所 */
};

/* 展平所有站点为数组（含所属线路信息） */
let _flatStations = null;
function getAllMetroStations() {
  if (_flatStations) return _flatStations;
  _flatStations = [];
  Object.keys(METRO_LINES).forEach(lineKey => {
    const line = METRO_LINES[lineKey];
    line.stations.forEach(s => {
      _flatStations.push({
        ...s,
        lineKey: lineKey,
        lineName: line.name,
        lineColor: line.color
      });
    });
  });
  return _flatStations;
}
