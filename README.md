# 厕哪 — 找公厕的说是

厕哪是一款面向天津滨海新区的公厕地图应用，解决「出门在外找不到厕所、找到厕所不知道能不能用」的核心痛点。覆盖 175 座公厕和 31 座地铁站厕所，初赛 Demo 以单文件 HTML 交付，零后端依赖。

## 初赛 Demo

- **地理范围**：天津滨海新区（12 顶点地理围栏）
- **定位锚点**：海港公园
- **交付形式**：单文件 `index.html`，可直接双击打开或部署到 Cloudflare Pages
- **线上地址**：Cloudflare Pages（待部署）

## 核心功能

- **4 色语义标记**：绿=能用 / 红=不能用 / 半透明红=不确定 / 灰=信息待复核，户外强光可辨
- **搜索与联想**：全量 175 条厕所数据本地 0-API 模糊搜索，21 个预设地点快速定位，8 条搜索历史
- **周边列表**：Bottom Sheet 三档拖拽（收起/预览/全展开），惯性 fling 手势，3km 半径距离排序
- **厕所详情**：状态一键上报、设施标签补充（无障碍/第三卫生间/房车水源）、位置描述众包补充、星级评论、高德/百度一键导航、分享好友
- **地铁图层**：9 号线（21 站）+ Z4 线北段（10 站）Cardinal 样条平滑曲线，三色圆点标记站内厕所状态，不可关闭
- **暗色模式**：一键切换 + localStorage 记忆 + 跟随系统偏好，MD3 全 token 覆盖
- **用户体系**：随机调查兵团风格身份（昵称 + emoji 头像），贡献统计

## 技术亮点

- **零依赖构建**：`node build.js` 将 12 个 JS/CSS 模块拼为单文件，无需 npm install
- **API Key 零暴露**：双模式架构 — `direct` 模式前端直连高德；`proxy` 模式 Cloudflare Pages Function 代理
- **四因子可信度模型**：来源基准 × 众包加成 - 新鲜度衰减 + 评论加成
- **Cardinal/Catmull-Rom 样条**：三次 Hermite 曲线严格经过每个地铁站点，非折线连接
- **移动端优先**：Bottom Sheet 跟手拖拽 + 惯性 fling + 速度采样，长按防误触
- **小程序迁移友好**：BEM 命名 · CSS 变量 · 组件化拆分，所有文件标注了 wx:for / bindtap / wx.setStorageSync 迁移映射

## 项目结构

```
Cena/
├── src/
│   ├── core/           # 核心逻辑（复赛零成本迁移 packages/core）
│   │   ├── geo.js      # 坐标转换 + Haversine 距离
│   │   ├── confidence.js # 可信度四因子模型
│   │   └── status.js   # 状态分层 + 映射
│   ├── data/
│   │   ├── toilets.js  # Mock 数据（175 条）
│   │   ├── metro.js    # 地铁线路 + 站点数据
│   │   └── config.js   # 配置常量
│   ├── ui/
│   │   ├── map.js      # 地图渲染 + 地铁图层
│   │   ├── panel.js    # 详情面板 + 分享
│   │   ├── nearby.js   # 周边列表
│   │   ├── search.js   # 搜索 + 联想 + 历史记录
│   │   └── utils.js    # 工具函数 + 用户身份
│   ├── app.js          # 入口 + 事件绑定 + 暗色模式
│   └── styles.css      # MD3 设计系统 + 暗色模式
├── build.js            # 构建脚本（零依赖）
├── index.template.html # HTML 模板
└── index.html          # 构建产物
```

## 快速开始

```bash
# 构建
node build.js

# 打开
open index.html  # 或双击 index.html
```

构建产物为纯静态 HTML，可直接部署到任意静态托管平台（Cloudflare Pages / Vercel / GitHub Pages）。

## 设计系统

遵循 Google Material Design 3 规范，完整的 tonal palette 体系，CSS 变量驱动主题色，支持暗色模式一键切换。

## 版本

V1.4 — 2026-06-28

## 许可

TRAE 创作者大赛参赛作品
