/* data/metro.js — 轨道交通厕所数据（9号线全线21站 + Z4线北段10站）
   依赖：无（坐标为 GCJ-02 高德坐标系）
   复赛迁移：infra/db/seed_metro.js

   数据来源：
   - 9号线厕所状态：天津轨道交通运营集团官网 & 实地核实（2026-06）
   - Z4线北段：环评文件标配厕所
   - 坐标：高德 maps_geo 实查（天津站/大王庄/十一经路/直沽）+ 沿线路走向插值估算

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
      { name: '天津站',     lng: 117.2099, lat: 39.1381, type: 'inside',  detail: '付费区 | 9号线站台往天津站方向车头' },
      { name: '大王庄',     lng: 117.2185, lat: 39.1272, type: 'inside',  detail: '付费区 | 往东海路方向站台车头' },
      { name: '十一经路',   lng: 117.2240, lat: 39.1214, type: 'inside',  detail: '付费区 | 往天津站方向站台车头' },
      { name: '直沽',       lng: 117.2339, lat: 39.1110, type: 'inside',  detail: '付费区 | 往天津站方向站台车头' },
      { name: '东兴路',     lng: 117.2450, lat: 39.1080, type: 'inside',  detail: '付费区 | 往天津站方向站台车头' },
      { name: '中山门',     lng: 117.2600, lat: 39.1030, type: 'inside',  detail: '付费区 | 通B/C出入口站厅客服中心附近' },
      { name: '一号桥',     lng: 117.2740, lat: 39.0980, type: 'inside',  detail: '付费区 | 通B/C出入口站厅客服中心附近' },
      { name: '二号桥',     lng: 117.2880, lat: 39.0930, type: 'inside',  detail: '付费区 | 通B/C出入口站厅客服中心附近' },
      { name: '张贵庄',     lng: 117.3150, lat: 39.0880, type: 'inside',  detail: '非付费区 | 站厅C/D出入口中间连廊' },
      { name: '新立',       lng: 117.3350, lat: 39.0850, type: 'inside',  detail: '非付费区 | 站厅A出入口自动售票机附近' },
      { name: '东丽开发区', lng: 117.3500, lat: 39.0830, type: 'inside',  detail: '非付费区 | 站厅A出入口安检点附近' },
      { name: '小东庄',     lng: 117.3850, lat: 39.0780, type: 'none',    detail: '暂不具备设置条件 | 21站中仅2站无厕所' },
      { name: '军粮城',     lng: 117.4350, lat: 39.0650, type: 'outside', detail: '车站外 | A出入口出站对面' },
      { name: '钢管公司',   lng: 117.4800, lat: 39.0550, type: 'outside', detail: '车站外 | B出入口出站100米公共卫生间' },
      { name: '胡家园',     lng: 117.6250, lat: 39.0450, type: 'none',    detail: '暂不具备设置条件 | 近天津大道快速路段' },
      { name: '塘沽',       lng: 117.6550, lat: 39.0350, type: 'inside',  detail: '非付费区 | 站厅B出入口进站闸机对面' },
      { name: '泰达',       lng: 117.6900, lat: 39.0250, type: 'inside',  detail: '非付费区 | 站厅A出入口进站闸机对面' },
      { name: '市民广场',   lng: 117.7100, lat: 39.0200, type: 'inside',  detail: '非付费区 | 站厅A3/B4出入口旁' },
      { name: '太湖路',     lng: 117.7280, lat: 39.0160, type: 'inside',  detail: '非付费区 | 站厅A/D出入口旁' },
      { name: '会展中心',   lng: 117.7450, lat: 39.0120, type: 'inside',  detail: '非付费区 | 站厅B出入口旁' },
      { name: '东海路',     lng: 117.7600, lat: 39.0080, type: 'inside',  detail: '非付费区 | 站厅B出入口旁（终点站）' }
    ]
  },
  /* Z4线一期北段：寨上—北塘，全长23.7km，10站（2026-01-18开通） */
  z4north: {
    name: 'Z4线北段',
    color: '#C4A36A',  /* Z4线官方香槟金 */
    stations: [
      { name: '寨上',       lng: 117.810, lat: 39.220, type: 'inside', detail: '滨城首条地铁 | 终点站·紧邻车辆段' },
      { name: '汉沽医院',   lng: 117.795, lat: 39.205, type: 'inside', detail: '出站直达总医院滨海医院新院区' },
      { name: '中心渔港',   lng: 117.785, lat: 39.188, type: 'inside', detail: '高架站·鱼塘虾塘特色景观' },
      { name: '玉砂道',     lng: 117.772, lat: 39.172, type: 'inside', detail: '岛式站台·辐射科研院所' },
      { name: '航母公园',   lng: 117.758, lat: 39.156, type: 'inside', detail: '军舰舷窗设计·蓝天白云吊顶' },
      { name: '软件园',     lng: 117.742, lat: 39.140, type: 'inside', detail: '信创产业聚集区·标识设施完善' },
      { name: '绿创园',     lng: 117.725, lat: 39.125, type: 'inside', detail: '海洋元素·串联湿地公园' },
      { name: '和顺路',     lng: 117.710, lat: 39.110, type: 'inside', detail: '生态城片区·绿色低碳主题' },
      { name: '中新生态城', lng: 117.695, lat: 39.098, type: 'inside', detail: '国际生态城·绿色波点装饰' },
      { name: '北塘',       lng: 117.680, lat: 39.085, type: 'inside', detail: '渔家风情·明清仿古设计 | 换乘Z2线' }
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
