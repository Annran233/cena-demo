# 项目说明

这是一个基于 Web技术栈 的 厕哪-找厕所 项目，相关PRD与技评文档通过 lark-doc 或 lark-drive 能力查阅飞书“厕哪”文件夹下。
初赛基于纯Web开发，后端最多限制在localStorage mock，

## 项目结构

Cena/
├── src/
│   ├── core/                   # 核心逻辑（复赛零成本迁移 packages/core）
│   │   ├── geo.js              # 坐标转换+距离+时间
│   │   ├── confidence.js       # 可信度四因子模型
│   │   └── status.js           # 状态分层+映射
│   ├── data/
│   │   ├── toilets.js          # Mock 数据
│   │   └── config.js           # 配置常量
│   ├── ui/
│   │   ├── utils.js            # 工具函数
│   │   ├── map.js              # 地图渲染
│   │   ├── panel.js            # 详情面板
│   │   ├── nearby.js           # 周边列表
│   │   └── search.js           # 搜索+高德API
│   ├── app.js                  # 入口
│   └── styles.css
├── build.js                    # 构建脚本（零依赖）
├── index.template.html         # HTML 模板
└── index.html                  # 构建产物（48KB，11模块拼接）

## 代码规范

- 所有代码必须添加注释

## 开发约定

- 使用 workspace 方式引用模块
- API 必须统一错误处理
- 沙箱外与危险命令必须由用户确认执行
- 对用户给出的问题/询问不止一味的附和，需要给出相反意见时可rebuttal并明确理由
- 要求prompt的不把prompt写进PRD/技评/html产物中
- Prompt 默认在对话中输出；仅当用户提示或助手发现输出渲染截断时，才改为写 PROMPT.md 文件（用 4 空格缩进代替反引号避免嵌套代码块断裂）
- Git推送前必须检查.gitignore文件夹与.git文件夹等关键位置及其内容物，确保Key/Secret/Token等敏感信息无泄露风险
