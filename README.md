# Boss 人审助手

一个运行在 Boss 直聘网页端的 Chrome 扩展，帮助你更高效地筛选岗位、管理打招呼流程。

## 项目定位

求职沟通的辅助工具，不是批量投递机器人。所有自动操作都设计为可观察、可控制、可中断。

## Features

### 岗位采集
- 自动同步当前 Boss 职位页的岗位列表
- Boss 页面变化时列表自动刷新
- 点击 Boss 页面岗位时扩展列表同步选中
- 支持跨页扫描（ScanController，可配置页数和延迟）

### 岗位审核
- 读取岗位 JD、薪资、地点、经验、学历、技能标签
- 按岗位名称和地点关键词筛选
- 岗位评分（高/中/低），基于规则匹配简历材料
- 公司和招聘者黑名单过滤
- 关键词排除过滤

### 打招呼
- **单岗位手动打招呼**：点开岗位后「立即沟通」
- **批量自动打招呼**：一键遍历待沟通岗位，逐个发送
- **默认打招呼**：调用 Boss 官方接口发送默认招呼语
- **自定义打招呼**：打招呼成功后，通过 Boss 内部聊天通道发送自定义内容
- **智能间隔**：每次发送间隔 3-7 秒随机（带小数），模拟自然节奏
- **打招呼历史记录**：存储并可视化管理每次打招呼的时间、内容、结果

### 大模型（可选）
- 集成 DeepSeek Chat Completions，根据简历材料和 JD 生成个性化打招呼语
- 支持自定义 API Base URL 和 Model
- 生成结果含匹配度评分和风险评估

### 数据管理
- 打招呼日志：本地保存最多 1000 条记录，支持 CSV 导出
- 已沟通岗位：自动标记去重，不支持重复发送
- 全局开关：一键启用/停用全部自动行为

## Non-goals

- 不做无人值守批量发送
- 不绕过平台风控
- 不替用户决定哪些岗位应该沟通
- 不把本地数据上传到第三方服务

## Tech Stack

- WXT（Chrome MV3）
- Vue 3 + Composition API
- Pinia
- TypeScript
- protobufjs（Boss 聊天协议编码）
- Vitest + jsdom
- Lucide Vue Next（图标）

## Install

```bash
pnpm install
```

## Development

```bash
pnpm dev
```

## Build

```bash
pnpm build
```

Chrome MV3 构建产物：

```text
.output/chrome-mv3
```

## Load in Chrome

1. 打开 `chrome://extensions/`。
2. 开启「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择 `.output/chrome-mv3`。
4. 打开 Boss 直聘职位列表页。

## Usage

1. 登录 Boss 直聘网页端，进入职位列表页。
2. 右侧出现「Boss 人审助手」面板。
3. 筛选岗位 → 点击读取 JD → 确认后「立即沟通」。
4. 如需批量操作，点击「自动打招呼」。
5. 查看「招呼记录」面板追踪所有沟通历史。

### 启用/停用
面板头部绿色圆点控制插件状态：停用时所有操作暂停，历史记录仍可查看。

### 自定义消息
勾选「默认打招呼后，延迟发送自定义内容」，填写你想说的具体话术。

## Configuration

项目保留 DeepSeek Chat Completions 的调用封装，默认配置：

- Base URL: `https://api.deepseek.com`
- Model: `deepseek-chat`

其它可配置项（在 `src/core/defaults.ts` 中）：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| maxPages | 5 | 最大扫描页数 |
| maxJobs | 100 | 最大采集岗位数 |
| pageDelayMin/Max | 1200-2600 ms | 翻页随机延迟 |
| detailDelayMin/Max | 700-1600 ms | 读详情随机延迟 |
| dailySendLimit | 30 | 每日打招呼上限 |
| scoreThresholds | 60/80 | 中/高评分阈值 |

## Verify

```bash
pnpm run typecheck
pnpm test
pnpm build
```

## Project Structure

```text
src/
  app/              右侧审核面板（Vue 组件 + Pinia Store）
  core/             类型定义、chrome.storage 封装、大模型调用、打招乎生成
  entrypoints/      WXT 入口（content script、main-world bridge、background）
  page/             Boss 页面适配器、聊天协议编码、发送逻辑
  styles/           CSS
tests/              单元测试
```

## Privacy

岗位数据和沟通记录保存在浏览器本地扩展存储中，不会主动上传到自有服务。配置大模型 API Key 后，简历和 JD 内容会发送到你指定的 API 端点。

## Disclaimer

这个扩展会和 Boss 直聘页面及其接口交互。请自行确认使用方式符合平台规则和法律法规。

## License

No license yet.
