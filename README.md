# Boss Review Extension

一个运行在 Boss 直聘网页端的 Chrome 扩展。它把当前页面的岗位列表同步到右侧审核面板，支持筛选、读取 JD、人工确认后打招呼，并记录已沟通过的岗位。

项目目标很小：让求职沟通更清楚、更可控，而不是做批量投递机器。

## Features

- 同步当前 Boss 职位页的岗位列表。
- Boss 页面岗位变化时，扩展列表自动更新。
- 点击 Boss 页面岗位时，扩展列表同步选中。
- 点击扩展列表岗位后读取该岗位 JD。
- 展示岗位名、公司、薪资、地点、经验、学历、关键词等基础信息。
- 支持按岗位名称和地点关键词筛选。
- 支持调用 Boss 默认打招呼接口。
- 支持可选自定义消息：默认打招呼成功后，再发送一条自定义内容。
- 记录已沟通过的岗位、发送结果和自定义内容。
- 支持导出沟通记录 JSON。
- 右侧面板可隐藏或关闭。

## Non-goals

这个项目不追求自动化到失控。

- 不做跨页长期任务队列。
- 不做无人值守批量发送。
- 不承诺绕过平台风控。
- 不替用户决定哪些岗位应该沟通。
- 不把本地数据上传到第三方服务。

## Tech Stack

- WXT
- Vue 3
- TypeScript
- Pinia
- Vitest
- protobufjs

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

Chrome MV3 构建产物会生成到：

```text
.output/chrome-mv3
```

## Load in Chrome

1. 打开 `chrome://extensions/`。
2. 开启“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择 `.output/chrome-mv3`。
5. 打开 Boss 直聘职位页。

## Usage

1. 登录 Boss 直聘网页端。
2. 进入职位列表页。
3. 右侧会出现 `Boss 人审助手` 面板。
4. 使用岗位名称或地点筛选岗位。
5. 点击岗位读取 JD。
6. 确认岗位信息后点击“立即沟通”。
7. 如需发送自定义消息，先打开自定义消息开关并填写内容。
8. 使用“导出记录”保存沟通结果。

## Configuration

项目里保留了 DeepSeek Chat Completions 的调用封装，默认配置为：

- Base URL: `https://api.deepseek.com`
- Model: `deepseek-chat`

当前 UI 聚焦在岗位扫描和人工沟通流程。如果要继续接入“根据 JD 和简历生成打招呼语”，建议保持生成结果为草稿，并在发送前保留人工确认。

## Verify

```bash
pnpm run typecheck
pnpm test
pnpm build
```

## Project Structure

```text
src/
  app/              右侧审核面板
  core/             类型、存储、大模型调用和通用逻辑
  entrypoints/      WXT 入口
  page/             Boss 页面适配和发送逻辑
  styles/           样式
tests/              单元测试
```

## Privacy

岗位数据和沟通记录保存在浏览器本地扩展存储中。项目不会主动把这些数据上传到自有服务。

如果你配置了大模型 API Key，并接入生成能力，请确认你发送给模型的简历和 JD 内容符合你的隐私预期。

## Disclaimer

这个项目会和 Boss 直聘页面及其接口交互。请自行确认使用方式符合平台规则、法律法规和基本招聘沟通礼仪。

## License

No license yet.
