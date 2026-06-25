/* data/toilets.js — Mock 厕所数据（实查种子 + 经典点位）
   依赖：无（坐标为 WGS-84，app.js 统一转 GCJ-02）
   复赛迁移：infra/db/seed.js（替换为云数据库种子数据）

   === Demo 地理围栏：天津市滨海新区 ===
   种子数据来源：高德 around API 实查（5 热点区域，81 条去重）
   拉取时间：2026-06-25T18:02:40.862Z
   覆盖热点：塘沽外滩 / 泰达开发区 / 北塘 / 大港 / 汉沽
   围栏外降级为 Mock 模式时仍可正常使用这些点位

   数据分层：
   - t001-t008：经典点位（有评论/特殊状态，展示状态机/确认机制）
   - s001-s074：实查基础点位（status='open'，confidence=0.5，待用户确认）
*/

const MOCK_TOILETS = [
  {
    id: 't001',
    name: '塘沽外滩公园公共厕所',
    lat: 39.0242,
    lng: 117.7058,
    source: 'amap',
    status: 'open',
    accessible: true,
    family: false,
    water: false,
    rating: 4,
    confidence: 0.8,
    last_update: Date.now() - 5 * 86400000,
    created_by: 'amap',
    address: '上海市道与永太路交口',
    comments: [{"user":"滨海小张","rating":4,"text":"外滩公园入口左侧，标识清楚，海河风景好","time":"2026-06-20"},{"user":"海鸥哥","rating":4,"text":"周末人多要排队，平时还算干净","time":"2026-06-22"}],
  },
  {
    id: 't002',
    name: '滨海文化中心公共厕所（用户上报）',
    lat: 39.0178,
    lng: 117.7112,
    source: 'user',
    status: 'open',
    accessible: true,
    family: true,
    water: false,
    rating: 4.8,
    confidence: 0.9,
    last_update: Date.now() - 2 * 86400000,
    created_by: 'ou_user_001',
    address: '旭升路 267 号',
    comments: [{"user":"读书人","rating":5,"text":"滨海图书馆旁边，第三卫生间有婴儿台，带娃友好","time":"2026-06-23"}],
  },
  {
    id: 't003',
    name: '塘沽火车站公共厕所',
    lat: 39.0338,
    lng: 117.706,
    source: 'amap+user',
    status: 'open',
    accessible: true,
    family: true,
    water: true,
    rating: 4.5,
    confidence: 0.95,
    last_update: Date.now() - 3 * 86400000,
    created_by: 'ou_user_003',
    address: '大连道 254 号',
    comments: [{"user":"出差党","rating":5,"text":"出站口右转，有水源有排污口，无障碍间宽敞，自驾通勤必停","time":"2026-06-22"}],
  },
  {
    id: 't004',
    name: '海河公园（塘沽段）公共厕所',
    lat: 39.035,
    lng: 117.695,
    source: 'amap+user',
    status: 'locked',
    accessible: false,
    family: false,
    water: false,
    rating: 2,
    confidence: 0.8,
    last_update: Date.now() - 1 * 86400000,
    created_by: 'amap',
    address: '海河岸边步道',
    comments: [{"user":"晨练大爷","rating":1,"text":"今早路过发现锁门了，应该是水管问题在修","time":"2026-06-25"}],
  },
  {
    id: 't006',
    name: '北塘古镇旅游公厕',
    lat: 39.103,
    lng: 117.75,
    source: 'amap',
    status: 'repair',
    accessible: false,
    family: false,
    water: false,
    rating: 2.5,
    confidence: 0.65,
    last_update: Date.now() - 10 * 86400000,
    created_by: 'amap',
    address: '北塘大街古镇北门',
    comments: [{"user":"游客甲","rating":2,"text":"节假日维修中，不知道什么时候好","time":"2026-06-15"}],
  },
  {
    id: 't007',
    name: '国家海洋博物馆公共厕所',
    lat: 39.1,
    lng: 117.77,
    source: 'amap',
    status: 'open',
    accessible: true,
    family: true,
    water: false,
    rating: 4.6,
    confidence: 0.75,
    last_update: Date.now() - 7 * 86400000,
    created_by: 'amap',
    address: '海轩道 377 号',
    comments: [{"user":"亲子游妈妈","rating":5,"text":"馆内每层都有，第三卫生间超大，环境好","time":"2026-06-18"}],
  },
  {
    id: 't008',
    name: '于家堡金融区公共厕所',
    lat: 39.008,
    lng: 117.725,
    source: 'amap',
    status: 'removed',
    accessible: false,
    family: false,
    water: false,
    rating: 1,
    confidence: 0.9,
    last_update: Date.now() - 60 * 86400000,
    created_by: 'amap',
    confirm_count: 3,
    last_removed_report_time: Date.now() - 60 * 86400000,
    address: '融义路与金河道交口',
    comments: [{"user":"金融街上班族","rating":1,"text":"此处曾有临时公厕，金融区改造时拆了","time":"2025-10-15"},{"user":"路过群众","rating":1,"text":"导航到了发现没厕所了，建议附近商铺解决","time":"2025-11-02"},{"user":"北川","rating":1,"text":"确认拆了，现在是绿地广场","time":"2026-05-20"}],
  },
  {
    id: 's001',
    name: '二纬路与三经路公厕',
    lat: 39.248351,
    lng: 117.784067,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '二纬路与三经路交叉口东北120米',
    comments: [],
  },
  {
    id: 's002',
    name: '三经路与八仙路公厕',
    lat: 39.249522,
    lng: 117.781641,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '三经路与八仙路交叉口西120米',
    comments: [],
  },
  {
    id: 's003',
    name: '安正路240号公厕',
    lat: 39.103101,
    lng: 117.745958,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '安正路240号',
    comments: [],
  },
  {
    id: 's004',
    name: '泰达风尚馆-女洗手间',
    lat: 39.022894,
    lng: 117.701997,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '第二大街62号泰达风尚馆4层',
    comments: [],
  },
  {
    id: 's005',
    name: '北海西路与第二大街公厕',
    lat: 39.021065,
    lng: 117.705849,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '北海西路与第二大街交叉口南120米',
    comments: [],
  },
  {
    id: 's006',
    name: '三纬路与润茗路公厕',
    lat: 39.244716,
    lng: 117.784476,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '三纬路与润茗路交叉口北100米',
    comments: [],
  },
  {
    id: 's007',
    name: '二经路与留庄路公厕',
    lat: 39.252766,
    lng: 117.787043,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '二经路与留庄路交叉口西北150米',
    comments: [],
  },
  {
    id: 's008',
    name: '卫生间(鸿泰·千佰汇)',
    lat: 39.028281,
    lng: 117.700363,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '开发区第三大街32号鸿泰·千佰汇4F层',
    comments: [],
  },
  {
    id: 's009',
    name: '海晨道与芳林路公厕',
    lat: 39.099135,
    lng: 117.749689,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '海晨道与芳林路交叉口东40米',
    comments: [],
  },
  {
    id: 's010',
    name: '鸿泰·千佰汇商业广场-洗手间',
    lat: 39.028415,
    lng: 117.699566,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '开发区第三大街32号鸿泰·千佰汇2F层',
    comments: [],
  },
  {
    id: 's011',
    name: '一经路与七星路公厕',
    lat: 39.248642,
    lng: 117.791121,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '一经路与七星路交叉口西南140米',
    comments: [],
  },
  {
    id: 's012',
    name: '麦当劳(开发区第三大街店)-洗手间',
    lat: 39.028669,
    lng: 117.699588,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '滨海新区经济开发区第三大街32号鸿泰千佰汇购物广场1楼',
    comments: [],
  },
  {
    id: 's013',
    name: '北海东路与发达街公厕',
    lat: 39.021996,
    lng: 117.712269,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '北海东路与发达街交叉口北40米',
    comments: [],
  },
  {
    id: 's014',
    name: '新城西路与广达街公厕',
    lat: 39.022166,
    lng: 117.69774,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '新城西路与广达街交叉口南100米',
    comments: [],
  },
  {
    id: 's015',
    name: '鸿泰·千佰汇商业广场-女洗手间',
    lat: 39.028769,
    lng: 117.698428,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '第三大街32号鸿泰·千佰汇商业广场F2',
    comments: [],
  },
  {
    id: 's016',
    name: '鸿泰·千佰汇商业广场-男洗手间',
    lat: 39.028783,
    lng: 117.698412,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '第三大街32号鸿泰·千佰汇商业广场F2',
    comments: [],
  },
  {
    id: 's017',
    name: '无障碍洗手间(鸿泰·千佰汇)',
    lat: 39.028793,
    lng: 117.698373,
    source: 'amap',
    status: 'open',
    accessible: true,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '开发区第三大街32号鸿泰·千佰汇2F层',
    comments: [],
  },
  {
    id: 's018',
    name: '开发区第三大街32号鸿泰·千佰汇2F层公厕',
    lat: 39.028818,
    lng: 117.698387,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '开发区第三大街32号鸿泰·千佰汇2F层',
    comments: [],
  },
  {
    id: 's019',
    name: '鸿泰·千佰汇商业广场-洗手间',
    lat: 39.028822,
    lng: 117.698384,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '开发区第三大街32号鸿泰·千佰汇4F层',
    comments: [],
  },
  {
    id: 's020',
    name: '碧水道与安正路公厕',
    lat: 39.095296,
    lng: 117.743527,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '碧水道与安正路交叉口东南200米',
    comments: [],
  },
  {
    id: 's021',
    name: '芳菲路99号公厕',
    lat: 39.097211,
    lng: 117.737559,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '芳菲路99号',
    comments: [],
  },
  {
    id: 's022',
    name: '卫生间(鸿泰·千佰汇)',
    lat: 39.028838,
    lng: 117.698244,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '开发区第三大街32号鸿泰·千佰汇3F层',
    comments: [],
  },
  {
    id: 's023',
    name: '河西公园-公共厕所',
    lat: 39.248809,
    lng: 117.792786,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '一经路河西公园(西北角)',
    comments: [],
  },
  {
    id: 's024',
    name: '肯德基(鸿泰餐厅)-洗手间',
    lat: 39.029279,
    lng: 117.698202,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '巢湖路与第三大街交叉口南60米',
    comments: [],
  },
  {
    id: 's025',
    name: '花园街泰达热带植物园(泰丰公园附近)公厕',
    lat: 39.032118,
    lng: 117.705839,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '花园街泰达热带植物园(泰丰公园附近)',
    comments: [],
  },
  {
    id: 's026',
    name: '三纬路与二经路公厕',
    lat: 39.242337,
    lng: 117.788658,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '三纬路与二经路交叉口东南200米',
    comments: [],
  },
  {
    id: 's027',
    name: '无障碍公共厕所',
    lat: 39.242239,
    lng: 117.788663,
    source: 'amap',
    status: 'open',
    accessible: true,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '二经路与三纬路交叉口东南180米',
    comments: [],
  },
  {
    id: 's028',
    name: '一经路汉沽体育馆对过河西公园画廊景区公厕',
    lat: 39.245211,
    lng: 117.793574,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '一经路汉沽体育馆对过河西公园画廊景区',
    comments: [],
  },
  {
    id: 's029',
    name: '海通街与泰康路公厕',
    lat: 39.072302,
    lng: 117.719783,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '海通街与泰康路交叉口东南40米',
    comments: [],
  },
  {
    id: 's030',
    name: '第四大街95号附近公厕',
    lat: 39.030893,
    lng: 117.696869,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '第四大街95号附近',
    comments: [],
  },
  {
    id: 's031',
    name: '天津滨海假日酒店-洗手间',
    lat: 39.018915,
    lng: 117.696914,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '中国··天津··天津经济技术开发区第一大街86号',
    comments: [],
  },
  {
    id: 's032',
    name: '汉茶路星达里公厕',
    lat: 39.239256,
    lng: 117.786815,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '汉茶路星达里',
    comments: [],
  },
  {
    id: 's033',
    name: '公共厕所(天津生态城第一社区中心)',
    lat: 39.106224,
    lng: 117.731653,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '和畅路与和睦路交口天津生态城第一社区中心F4层',
    comments: [],
  },
  {
    id: 's034',
    name: '和畅路与中天大道交口附近永定洲公园内(南侧)公厕',
    lat: 39.101075,
    lng: 117.730535,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '和畅路与中天大道交口附近永定洲公园内(南侧)',
    comments: [],
  },
  {
    id: 's035',
    name: '瑞龙城西南侧230米公厕',
    lat: 39.096669,
    lng: 117.755209,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '瑞龙城西南侧230米',
    comments: [],
  },
  {
    id: 's036',
    name: '男洗手间(九号线广场)',
    lat: 39.0189,
    lng: 117.716393,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '第二大街91号宏晋时代广场2F层',
    comments: [],
  },
  {
    id: 's037',
    name: '寨上汉沽区汉沽环卫所(滨河路东)汉沽环境卫生管理所(滨河路)附近公厕',
    lat: 39.254496,
    lng: 117.796222,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '寨上汉沽区汉沽环卫所(滨河路东)汉沽环境卫生管理所(滨河路)附近',
    comments: [],
  },
  {
    id: 's038',
    name: '青少年宫右手边小广场公厕',
    lat: 39.252232,
    lng: 117.798047,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '青少年宫右手边小广场',
    comments: [],
  },
  {
    id: 's039',
    name: '发达街泰达城市公园(西侧)公厕',
    lat: 39.019412,
    lng: 117.718581,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '发达街泰达城市公园(西侧)',
    comments: [],
  },
  {
    id: 's040',
    name: '中津大道与和畅路公厕',
    lat: 39.111907,
    lng: 117.735418,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '中津大道与和畅路交叉口西北100米',
    comments: [],
  },
  {
    id: 's041',
    name: '顺达街8号A-102附近公厕',
    lat: 39.019674,
    lng: 117.691881,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '顺达街8号A-102附近',
    comments: [],
  },
  {
    id: 's042',
    name: '汉茶路与三经路公厕',
    lat: 39.237162,
    lng: 117.782544,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '汉茶路与三经路交叉口南160米',
    comments: [],
  },
  {
    id: 's043',
    name: '女洗手间(泰达时尚购物中心C区)',
    lat: 39.032199,
    lng: 117.717621,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '时尚西路18号泰达时尚购物中心C区F3层',
    comments: [],
  },
  {
    id: 's044',
    name: '无障碍洗手间(泰达时尚购物中心C区)',
    lat: 39.032151,
    lng: 117.717669,
    source: 'amap',
    status: 'open',
    accessible: true,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '时尚西路18号泰达时尚购物中心C区B1层',
    comments: [],
  },
  {
    id: 's045',
    name: '无障碍洗手间(泰达时尚购物中心C区)',
    lat: 39.032158,
    lng: 117.717668,
    source: 'amap',
    status: 'open',
    accessible: true,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '时尚西路18号泰达时尚购物中心C区F1层',
    comments: [],
  },
  {
    id: 's046',
    name: '女洗手间(泰达时尚购物中心C区)',
    lat: 39.032157,
    lng: 117.717698,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '时尚西路18号泰达时尚购物中心C区B1层',
    comments: [],
  },
  {
    id: 's047',
    name: '男洗手间(泰达时尚购物中心C区)',
    lat: 39.032143,
    lng: 117.717738,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '时尚西路18号泰达时尚购物中心C区B1层',
    comments: [],
  },
  {
    id: 's048',
    name: '五纬路与秀茶路公厕',
    lat: 39.237075,
    lng: 117.78553,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '五纬路与秀茶路交叉口北200米',
    comments: [],
  },
  {
    id: 's049',
    name: '中天大道与中生大道公厕',
    lat: 39.114307,
    lng: 117.749009,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '中天大道与中生大道交叉口西南120米',
    comments: [],
  },
  {
    id: 's050',
    name: '中津大道与和韵路公厕',
    lat: 39.112371,
    lng: 117.732797,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '中津大道与和韵路交叉口南260米',
    comments: [],
  },
  {
    id: 's051',
    name: '公共卫生间',
    lat: 39.093532,
    lng: 117.757482,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '安明路461号',
    comments: [],
  },
  {
    id: 's052',
    name: '汉沽图书馆(汉沽百货大楼西南)公厕',
    lat: 39.241184,
    lng: 117.799136,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '汉沽图书馆(汉沽百货大楼西南)',
    comments: [],
  },
  {
    id: 's053',
    name: '寨上世纪客都超市西南(新开北路)公厕',
    lat: 39.254744,
    lng: 117.800575,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '寨上世纪客都超市西南(新开北路)',
    comments: [],
  },
  {
    id: 's054',
    name: '公共卫生间',
    lat: 39.253905,
    lng: 117.802677,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '',
    comments: [],
  },
  {
    id: 's055',
    name: '二百间无障碍公共厕所',
    lat: 39.240761,
    lng: 117.801382,
    source: 'amap',
    status: 'open',
    accessible: true,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '新开中路与福顺街交叉口西北100米',
    comments: [],
  },
  {
    id: 's056',
    name: '汉沽街道新开南路8号汉沽商场1楼公厕',
    lat: 39.241765,
    lng: 117.802143,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '汉沽街道新开南路8号汉沽商场1楼',
    comments: [],
  },
  {
    id: 's057',
    name: '红霞路与府北街公厕',
    lat: 39.247535,
    lng: 117.806156,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '红霞路与府北街交叉口东南60米',
    comments: [],
  },
  {
    id: 's058',
    name: '寨上富顺街公共卫生间',
    lat: 39.239834,
    lng: 117.802998,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '福顺街与新开中路交叉口东80米',
    comments: [],
  },
  {
    id: 's059',
    name: '公共厕所(第三社区卫生服务中心)',
    lat: 39.119036,
    lng: 117.749617,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '和畅路532号第三社区卫生服务中心F3层',
    comments: [],
  },
  {
    id: 's060',
    name: 'G25长深高速附近公厕',
    lat: 39.266402,
    lng: 117.779067,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: 'G25长深高速附近',
    comments: [],
  },
  {
    id: 's061',
    name: '第九大街与洞庭路公厕',
    lat: 39.064254,
    lng: 117.686942,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '第九大街与洞庭路交叉口东40米',
    comments: [],
  },
  {
    id: 's062',
    name: '男洗手间(天津市第五中心医院生态城医院)',
    lat: 39.12011,
    lng: 117.748928,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '和畅路3333号天津市第五中心医院生态城医院F2层',
    comments: [],
  },
  {
    id: 's063',
    name: '公共厕所(天津市第五中心医院生态城医院)',
    lat: 39.12013,
    lng: 117.748911,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '和畅路3333号天津市第五中心医院生态城医院F3层',
    comments: [],
  },
  {
    id: 's064',
    name: '公共厕所(天津市第五中心医院生态城医院)',
    lat: 39.12014,
    lng: 117.748899,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '和畅路3333号天津市第五中心医院生态城医院F1层',
    comments: [],
  },
  {
    id: 's065',
    name: '公共厕所(天津医科大学中新生态城医院)',
    lat: 39.120107,
    lng: 117.749102,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '和畅路3333号天津医科大学中新生态城医院F2层',
    comments: [],
  },
  {
    id: 's066',
    name: '公共厕所(天津市第五中心医院生态城医院)',
    lat: 39.120106,
    lng: 117.749109,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '和畅路3333号天津市第五中心医院生态城医院F3层',
    comments: [],
  },
  {
    id: 's067',
    name: '女洗手间(天津市第五中心医院生态城医院)',
    lat: 39.120143,
    lng: 117.748903,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '和畅路3333号天津市第五中心医院生态城医院F10层',
    comments: [],
  },
  {
    id: 's068',
    name: '女洗手间(天津市第五中心医院生态城医院)',
    lat: 39.120146,
    lng: 117.748896,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '和畅路3333号天津市第五中心医院生态城医院F2层',
    comments: [],
  },
  {
    id: 's069',
    name: '男洗手间(天津市第五中心医院生态城医院)',
    lat: 39.12017,
    lng: 117.748901,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '和畅路3333号天津市第五中心医院生态城医院F10层',
    comments: [],
  },
  {
    id: 's070',
    name: '公共厕所(天津市第五中心医院生态城医院)',
    lat: 39.120378,
    lng: 117.748696,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '和畅路3333号天津市第五中心医院生态城医院F2层',
    comments: [],
  },
  {
    id: 's071',
    name: '公共厕所(天津市第五中心医院生态城医院)',
    lat: 39.120381,
    lng: 117.748693,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '和畅路3333号天津市第五中心医院生态城医院F3层',
    comments: [],
  },
  {
    id: 's072',
    name: '印象海堤公共洗手间',
    lat: 39.113414,
    lng: 117.762941,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '海富园附近',
    comments: [],
  },
  {
    id: 's073',
    name: '公共厕所(天津市第五中心医院生态城医院)',
    lat: 39.120391,
    lng: 117.748722,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '和畅路3333号天津市第五中心医院生态城医院F1层',
    comments: [],
  },
  {
    id: 's074',
    name: '公共卫生间',
    lat: 39.241408,
    lng: 117.806001,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '牌坊街天津市滨海新区汉沽中医医院',
    comments: [],
  },
  {
    id: 's075',
    name: '公共厕所(天津市第五中心医院生态城医院)',
    lat: 39.120421,
    lng: 117.748735,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '和畅路3333号天津市第五中心医院生态城医院F8层',
    comments: [],
  },
  {
    id: 's076',
    name: '东风北路与东滨街公厕',
    lat: 39.257485,
    lng: 117.805467,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '东风北路与东滨街交叉口西南160米',
    comments: [],
  },
  {
    id: 's077',
    name: '公共卫生间',
    lat: 39.235927,
    lng: 117.801348,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '新开南路81号附近',
    comments: [],
  },
  {
    id: 's078',
    name: '第七大街与黄海路公厕',
    lat: 39.05398,
    lng: 117.692849,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '第七大街与黄海路交叉口东200米',
    comments: [],
  },
  {
    id: 's079',
    name: '第七大街26号公厕',
    lat: 39.054357,
    lng: 117.691343,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '第七大街26号',
    comments: [],
  },
  {
    id: 's080',
    name: '洞庭路148号北60米公厕',
    lat: 39.05811,
    lng: 117.684186,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '洞庭路148号北60米',
    comments: [],
  },
  {
    id: 's081',
    name: '共发大道天津金元宝滨海农产品交易市场公厕',
    lat: 39.069699,
    lng: 117.674324,
    source: 'amap',
    status: 'open',
    accessible: false,
    family: false,
    water: false,
    rating: 3,
    confidence: 0.5,
    last_update: Date.now() - 30 * 86400000,
    created_by: 'amap',
    address: '共发大道天津金元宝滨海农产品交易市场',
    comments: [],
  }
];

/* ============ 用户上报点位持久化 ============ */
let userToilets = [];

/* ============ 用户补充设施标签持久化（针对高德/amap-live 点位） ============ */
// 存储结构：[{ lat, lng, tags: {accessible:number, family:number, water:number}, last_update }]
// tags 值为补充人数 count：0=无，1=单人补充（待复核），≥2=已确认（与点位 confirm_count 逻辑对齐）
// 匹配规则：50m 范围内的最近一条补充记录
const TAG_SUPPLEMENT_MATCH_RADIUS = 50;
const SUPPLEMENT_CONFIRM_THRESHOLD = 2;  // ≥2 人独立补充 → 已确认
let tagSupplements = [];

// 从 localStorage 加载补充标签
function loadTagSupplements() {
  try {
    const raw = localStorage.getItem(TAG_SUPPLEMENTS_KEY);
    tagSupplements = raw ? JSON.parse(raw) : [];
  } catch (e) {
    tagSupplements = [];
  }
}

// 保存补充标签到 localStorage
function saveTagSupplements() {
  try {
    localStorage.setItem(TAG_SUPPLEMENTS_KEY, JSON.stringify(tagSupplements));
  } catch (e) {
    console.log('localStorage 写入失败：', e.message);
  }
}

// 查找坐标 50m 内的补充记录，返回最近的一条；无则返回 null
function findSupplementMatch(lat, lng) {
  let best = null, bestDist = TAG_SUPPLEMENT_MATCH_RADIUS;
  for (const s of tagSupplements) {
    const d = haversine(lat, lng, s.lat, s.lng);
    if (d <= bestDist) { best = s; bestDist = d; }
  }
  return best;
}

// 返回某标签的补充状态：null=无补充，'pending'=单人待复核，'confirmed'=已确认
function getSupplementStatus(t, tag) {
  const sup = findSupplementMatch(t.lat, t.lng);
  if (!sup) return null;
  const count = sup.tags[tag] || 0;
  if (count === 0) return null;
  if (count >= SUPPLEMENT_CONFIRM_THRESHOLD) return 'confirmed';
  return 'pending';
}

// 对单条厕所数据应用补充标签（直接修改对象，count>=1 即标记为 true）
function applySupplementToToilet(t) {
  const sup = findSupplementMatch(t.lat, t.lng);
  if (!sup) return;
  if (sup.tags.accessible >= 1) t.accessible = true;
  if (sup.tags.family >= 1) t.family = true;
  if (sup.tags.water >= 1) t.water = true;
}

// 增加一条补充标签（50m 内已有记录则 count+1，否则新增 count=1）
function addTagSupplement(lat, lng, tag) {
  const sup = findSupplementMatch(lat, lng);
  if (sup) {
    sup.tags[tag] = (sup.tags[tag] || 0) + 1;
    sup.lat = (sup.lat + lat) / 2;  // 坐标取平均，提高下次匹配精度
    sup.lng = (sup.lng + lng) / 2;
    sup.last_update = Date.now();
  } else {
    const tags = { accessible: 0, family: 0, water: 0 };
    tags[tag] = 1;
    tagSupplements.push({ lat, lng, tags, last_update: Date.now() });
  }
  saveTagSupplements();
}

// 撤销一条补充标签（count-1，到 0 则保留 0 不删除记录，便于未来审计）
function removeTagSupplement(lat, lng, tag) {
  const sup = findSupplementMatch(lat, lng);
  if (!sup) return;
  if (sup.tags[tag] > 0) {
    sup.tags[tag]--;
    sup.last_update = Date.now();
    saveTagSupplements();
  }
}

/* ============ 位置描述补充持久化（多描述独立确认机制） ============ */
// 独立于 tagSupplements：描述是文本，同一点位可有多条不同视角描述
// 结构：[{ lat, lng, descs: [{ text, count, last_update }], last_update }]
// descs 数组：每条独立描述各自维护 count（确认人数）
// count: 1=单人补充（待确认），≥2=已确认（SUPPLEMENT_CONFIRM_THRESHOLD）
// 多条描述各自独立确认，各自独立展示
let descSupplements = [];

// 从 localStorage 加载位置描述补充
function loadDescSupplements() {
  try {
    const raw = localStorage.getItem('cena_desc_supplements');
    descSupplements = raw ? JSON.parse(raw) : [];
  } catch (e) {
    descSupplements = [];
  }
}

// 保存位置描述补充到 localStorage
function saveDescSupplements() {
  try {
    localStorage.setItem('cena_desc_supplements', JSON.stringify(descSupplements));
  } catch (e) {
    console.log('localStorage 写入失败：', e.message);
  }
}

// 查找坐标 50m 内的位置描述补充记录，返回最近一条；无则 null
function findDescSupplementMatch(lat, lng) {
  let best = null, bestDist = TAG_SUPPLEMENT_MATCH_RADIUS;
  for (const s of descSupplements) {
    const d = haversine(lat, lng, s.lat, s.lng);
    if (d <= bestDist) { best = s; bestDist = d; }
  }
  return best;
}

// 返回某点位的描述列表 [{ text, status, count }]，按 count 降序（已确认在前）
// status: 'pending'(count<2) / 'confirmed'(count≥2)
function getDescSupplementList(t) {
  const sup = findDescSupplementMatch(t.lat, t.lng);
  if (!sup || !sup.descs || sup.descs.length === 0) return [];
  return sup.descs
    .map(d => ({
      text: d.text,
      count: d.count,
      status: d.count >= SUPPLEMENT_CONFIRM_THRESHOLD ? 'confirmed' : 'pending'
    }))
    .sort((a, b) => {
      // 已确认在前，同状态按 count 降序
      if (a.status !== b.status) return a.status === 'confirmed' ? -1 : 1;
      return b.count - a.count;
    });
}

// 将补充描述应用到点位对象（getAllToilets 合并时调用）
// 取 descs 中 count 最高的写入 t.desc（单人补充即可展示，UI 标注待确认）
function applyDescSupplementToToilet(t) {
  // 已有 desc 的点位不覆盖
  if (t.desc) return;
  const list = getDescSupplementList(t);
  if (list.length === 0) return;
  t.desc = list[0].text;  // list 已按 count 降序，第一条为最高票
  t._descSupplementStatus = list[0].status;
}

// 新增一条位置描述补充
// 50m 内已有记录：相同文本 count+1，不同文本在 descs 数组新增 {text, count:1}
// 无记录：新增 {lat, lng, descs: [{text, count:1}]}
function addDescSupplement(lat, lng, desc) {
  const sup = findDescSupplementMatch(lat, lng);
  if (sup) {
    // 查找是否已有相同文本
    const existing = sup.descs.find(d => d.text === desc);
    if (existing) {
      existing.count++;
      existing.last_update = Date.now();
    } else {
      sup.descs.push({ text: desc, count: 1, last_update: Date.now() });
    }
    sup.lat = (sup.lat + lat) / 2;
    sup.lng = (sup.lng + lng) / 2;
    sup.last_update = Date.now();
  } else {
    descSupplements.push({
      lat, lng,
      descs: [{ text: desc, count: 1, last_update: Date.now() }],
      last_update: Date.now()
    });
  }
  saveDescSupplements();
}

// 对指定描述 count+1（点"👍 准确"时调用，独立于 addDescSupplement）
function confirmDescSupplement(lat, lng, desc) {
  const sup = findDescSupplementMatch(lat, lng);
  if (!sup) return;
  const target = sup.descs.find(d => d.text === desc);
  if (!target) return;
  target.count++;
  target.last_update = Date.now();
  sup.last_update = Date.now();
  saveDescSupplements();
}

// 撤销指定描述（count-1，count=0 从 descs 移除；descs 空则删整条记录）
function removeDescSupplement(lat, lng, desc) {
  const sup = findDescSupplementMatch(lat, lng);
  if (!sup) return;
  const idx = sup.descs.findIndex(d => d.text === desc);
  if (idx < 0) return;
  sup.descs[idx].count--;
  if (sup.descs[idx].count <= 0) {
    sup.descs.splice(idx, 1);
  }
  // descs 数组空 → 删除整条记录
  if (sup.descs.length === 0) {
    const i = descSupplements.indexOf(sup);
    if (i >= 0) descSupplements.splice(i, 1);
  }
  sup.last_update = Date.now();
  saveDescSupplements();
}

// 判断当前用户是否已补充过描述（用于判断显示输入框还是补充按钮）
// 简化逻辑：存在 pending（count=1）描述视为当前用户刚补充
function hasUserDescSupplement(t) {
  const list = getDescSupplementList(t);
  return list.some(d => d.status === 'pending' && d.count === 1);
}

// 将任意来源点位提升到 userToilets 持久化，返回持久化对象引用
// 核心逻辑：getAllToilets() 对 Mock/live 点位做浅拷贝，直接修改 copy 会丢失
// 任何状态/标签/评论修改前必须先 ensurePersisted，确保改的是持久化对象
// 如果已在 userToilets 中（id 以 user_ 开头且存在于数组），直接返回原引用
function ensurePersisted(t) {
  // 已经是 userToilets 里的持久化对象：直接返回
  if (t.id && t.id.startsWith('user_')) {
    const existing = userToilets.find(x => x.id === t.id);
    if (existing) return existing;
  }
  // 否则克隆到 userToilets（分配新 user_ id，保留原 id 作为 originalId 用于去重）
  const newId = 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const persisted = {
    ...t,
    id: newId,
    originalId: t.id,
    source: 'amap+user',
    last_update: Date.now(),
    comments: t.comments || [],
    confirm_count: t.confirm_count || 0,
    recovery_count: t.recovery_count || 0
  };
  addUserToilet(persisted);
  return persisted;
}

// 将 Mock 点位提升为用户点位（兼容旧接口，内部调用 ensurePersisted）
function promoteMockToUser(mockT, tag) {
  const persisted = ensurePersisted(mockT);
  if (tag) persisted[tag] = true;
  saveUserToilets();
  return persisted;
}

// 撤销 Mock 点位提升：从 userToilets 删除 promoted 记录（按 id 匹配）
function unpromoteMockFromUser(promotedId) {
  const idx = userToilets.findIndex(t => t.id === promotedId);
  if (idx >= 0) {
    userToilets.splice(idx, 1);
    saveUserToilets();
  }
}

// 从 localStorage 加载历史上报点位
function loadUserToilets() {
  try {
    const raw = localStorage.getItem(USER_TOILETS_STORAGE_KEY);
    userToilets = raw ? JSON.parse(raw) : [];
  } catch (e) {
    userToilets = [];
  }
}

// 保存到 localStorage
function saveUserToilets() {
  try {
    localStorage.setItem(USER_TOILETS_STORAGE_KEY, JSON.stringify(userToilets));
  } catch (e) {
    console.log('localStorage 写入失败：', e.message);
  }
}

// 新增上报点位（插到数组头部）
function addUserToilet(t) {
  userToilets.unshift(t);
  saveUserToilets();
}

// 更新指定上报点位（用于 confirm_count 累加等）
function updateUserToilet(id, patch) {
  const t = userToilets.find(x => x.id === id);
  if (t) { Object.assign(t, patch); saveUserToilets(); }
}

/* 24h 频率限制（防刷，初赛同设备计数） */
function canReport() {
  try {
    const raw = localStorage.getItem(USER_REPORT_COUNT_KEY);
    const today = new Date().toDateString();
    const data = raw ? JSON.parse(raw) : { date: today, count: 0 };
    if (data.date !== today) { data.date = today; data.count = 0; }
    return data.count < 5;
  } catch (e) { return true; }
}

function incrReportCount() {
  try {
    const raw = localStorage.getItem(USER_REPORT_COUNT_KEY);
    const today = new Date().toDateString();
    const data = raw ? JSON.parse(raw) : { date: today, count: 0 };
    if (data.date !== today) { data.date = today; data.count = 0; }
    data.count++;
    localStorage.setItem(USER_REPORT_COUNT_KEY, JSON.stringify(data));
  } catch (e) {}
}
