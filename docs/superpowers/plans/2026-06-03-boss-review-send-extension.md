# Boss 人审发送 Chrome 扩展 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 WXT + Vue + TypeScript Chrome 扩展，在 Boss 直聘职位页支持多页抓取岗位、根据简历和 JD 生成打招呼语，并且只允许用户人工审核后发送或复制。

**Architecture:** 扩展由 `content script`、`main-world script`、Vue 右侧审核面板和 `background/storage` 四部分组成。核心业务逻辑放在可测试的纯 TypeScript 模块里：岗位标准化、去重、pipeline、打招呼语生成、扫描状态机；页面集成层只负责从 Boss 页面读取数据、翻页和触发用户确认后的发送/复制动作。

**Tech Stack:** WXT, Vue 3, TypeScript, Pinia, Vitest, @vue/test-utils, jsdom, lucide-vue-next.

---

## 文件结构

- `package.json`：项目脚本、依赖和包管理配置。
- `tsconfig.json`、`vitest.config.ts`、`wxt.config.ts`：TypeScript、测试和扩展构建配置。
- `src/entrypoints/content.ts`：匹配 Boss 页面，注入 main-world 脚本和基础样式。
- `src/entrypoints/main-world.ts`：在页面上下文挂载 Vue 应用，并监听路由变化。
- `src/entrypoints/background.ts`：扩展后台消息和本地存储入口。
- `src/app/App.vue`：右侧面板应用壳。
- `src/app/components/*.vue`：扫描控制、统计条、岗位队列、岗位详情、招呼语审核、设置抽屉。
- `src/app/stores/reviewStore.ts`：Pinia store，管理扫描、队列、选中岗位、发送/跳过日志。
- `src/core/types.ts`：领域类型。
- `src/core/defaults.ts`：默认设置、默认阈值、UI 文案常量。
- `src/core/storage.ts`：扩展本地存储封装。
- `src/core/greeting.ts`：打招呼语生成 prompt、结构化输出校验和规则兜底。
- `src/core/pipeline.ts`：去重、黑名单、评分、草稿生成流程。
- `src/core/scanner.ts`：多页扫描状态机。
- `src/page/bossAdapter.ts`：Boss 页面数据适配器接口和 DOM 兜底实现。
- `src/page/bossRuntime.ts`：页面运行时 Vue 数据读取和翻页动作探测。
- `src/page/sender.ts`：用户点击后的发送动作，首版支持复制并聚焦兜底。
- `src/utils/delay.ts`：随机延迟、超时等待和可取消 sleep。
- `src/utils/text.ts`：文本清洗、长度计算和关键词工具。
- `tests/core/*.test.ts`：纯逻辑测试。
- `tests/page/*.test.ts`：jsdom 页面适配和发送兜底测试。
- `tests/app/*.test.ts`：Vue 组件基础行为测试。

---

### Task 1: 初始化 WXT + Vue + TypeScript 扩展骨架

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `wxt.config.ts`
- Create: `src/entrypoints/content.ts`
- Create: `src/entrypoints/main-world.ts`
- Create: `src/entrypoints/background.ts`
- Create: `src/app/App.vue`
- Create: `src/styles/main.css`

- [ ] **Step 1: 写入项目配置**

`package.json` 内容：

```json
{
  "name": "boss-review-sender",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wxt",
    "build": "wxt build -b chrome",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "vue-tsc --noEmit"
  },
  "dependencies": {
    "@vitejs/plugin-vue": "^5.2.4",
    "@wxt-dev/module-vue": "^1.0.3",
    "lucide-vue-next": "^0.468.0",
    "pinia": "^2.3.1",
    "vue": "^3.5.13",
    "wxt": "^0.20.13"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.301",
    "@types/node": "^22.10.2",
    "@vue/test-utils": "^2.4.6",
    "jsdom": "^25.0.1",
    "typescript": "^5.7.2",
    "vite": "^6.0.5",
    "vitest": "^2.1.8",
    "vue-tsc": "^2.2.0"
  },
  "packageManager": "pnpm@9.12.3"
}
```

`tsconfig.json` 内容：

```json
{
  "extends": "./.wxt/tsconfig.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "types": ["vitest/globals", "chrome"]
  }
}
```

`vitest.config.ts` 内容：

```ts
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
})
```

`wxt.config.ts` 内容：

```ts
import { defineConfig } from 'wxt'

const matches = ['*://zhipin.com/*', '*://*.zhipin.com/*']

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-vue'],
  imports: false,
  manifest: {
    name: 'Boss 人审助手',
    description: '扫描 Boss 岗位，生成打招呼语，并由用户人工审核发送。',
    permissions: ['storage', 'notifications'],
    host_permissions: ['*://zhipin.com/*', '*://*.zhipin.com/*'],
    web_accessible_resources: [
      {
        resources: ['main-world.js'],
        matches,
      },
    ],
  },
  hooks: {
    'build:manifestGenerated': (_, manifest) => {
      manifest.content_scripts ??= []
      manifest.content_scripts.push({
        matches,
        css: ['/assets/main.css'],
      })
    },
  },
})
```

- [ ] **Step 2: 写入最小入口文件**

`src/entrypoints/content.ts` 内容：

```ts
import { defineContentScript, injectScript } from 'wxt/sandbox'

import '@/styles/main.css'

export default defineContentScript({
  matches: ['*://zhipin.com/*', '*://*.zhipin.com/*'],
  async main() {
    await injectScript('/main-world.js', { keepInDom: true })
  },
})
```

`src/entrypoints/main-world.ts` 内容：

```ts
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { defineUnlistedScript } from 'wxt/sandbox'

import App from '@/app/App.vue'

const ROOT_ID = 'boss-review-sender-root'

function mountApp() {
  if (document.getElementById(ROOT_ID)) return

  const root = document.createElement('div')
  root.id = ROOT_ID
  document.body.append(root)

  const app = createApp(App)
  app.use(createPinia())
  app.mount(root)
}

export default defineUnlistedScript(() => {
  mountApp()
})
```

`src/entrypoints/background.ts` 内容：

```ts
import { defineBackground } from 'wxt/sandbox'

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '/icon/128.png',
      title: 'Boss 人审助手已安装',
      message: '打开 Boss 职位页后可在右侧使用审核面板。',
    })
  })
})
```

`src/app/App.vue` 内容：

```vue
<template>
  <aside class="brs-shell" aria-label="Boss 人审助手">
    <header class="brs-header">
      <p class="brs-kicker">Boss 人审助手</p>
      <h1>岗位审核队列</h1>
    </header>
    <main class="brs-placeholder">
      <p>扩展骨架已加载。</p>
    </main>
  </aside>
</template>
```

`src/styles/main.css` 内容：

```css
#boss-review-sender-root {
  position: fixed;
  top: 72px;
  right: 16px;
  z-index: 2147483647;
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.brs-shell {
  width: min(480px, calc(100vw - 32px));
  max-height: calc(100vh - 96px);
  overflow: auto;
  background: #fbfdfc;
  border: 1px solid #d9e5e1;
  color: #13231f;
  border-radius: 8px;
  box-shadow: 0 16px 48px rgba(15, 23, 42, 0.16);
}

.brs-header {
  padding: 16px 18px 12px;
  border-bottom: 1px solid #e5eeee;
}

.brs-kicker {
  margin: 0 0 4px;
  color: #0d9488;
  font-size: 12px;
  font-weight: 700;
}

.brs-header h1 {
  margin: 0;
  font-size: 17px;
  line-height: 1.3;
  letter-spacing: 0;
}

.brs-placeholder {
  padding: 18px;
  font-size: 13px;
}
```

- [ ] **Step 3: 安装依赖并生成 WXT 类型**

Run:

```bash
pnpm install
```

Expected: dependencies install successfully and `.wxt/` is generated by WXT prepare.

- [ ] **Step 4: 运行构建和类型检查**

Run:

```bash
pnpm run typecheck
pnpm run build
```

Expected: both commands pass.

- [ ] **Step 5: 提交**

```bash
git add package.json pnpm-lock.yaml tsconfig.json vitest.config.ts wxt.config.ts src
git commit -m "feat: scaffold Boss review extension"
```

---

### Task 2: 定义领域类型、默认配置和本地存储封装

**Files:**
- Create: `src/core/types.ts`
- Create: `src/core/defaults.ts`
- Create: `src/core/storage.ts`
- Create: `tests/core/storage.test.ts`

- [ ] **Step 1: 写 failing tests**

`tests/core/storage.test.ts` 内容：

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_SETTINGS } from '@/core/defaults'
import { createMemoryStorageArea, ExtensionStorage } from '@/core/storage'

describe('ExtensionStorage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns default settings when storage is empty', async () => {
    const storage = new ExtensionStorage(createMemoryStorageArea())

    await expect(storage.getSettings()).resolves.toEqual(DEFAULT_SETTINGS)
  })

  it('merges partial settings with defaults', async () => {
    const storage = new ExtensionStorage(createMemoryStorageArea())

    await storage.saveSettings({ maxPages: 2, maxJobs: 20 })

    await expect(storage.getSettings()).resolves.toEqual({
      ...DEFAULT_SETTINGS,
      maxPages: 2,
      maxJobs: 20,
    })
  })

  it('stores resume material and dedupe keys', async () => {
    const storage = new ExtensionStorage(createMemoryStorageArea())

    await storage.saveResumeMaterial('6年产品经理经验')
    await storage.markCompanyReviewed('company-1')
    await storage.markRecruiterReviewed('recruiter-1')

    await expect(storage.getResumeMaterial()).resolves.toBe('6年产品经理经验')
    await expect(storage.hasCompanyReviewed('company-1')).resolves.toBe(true)
    await expect(storage.hasRecruiterReviewed('recruiter-1')).resolves.toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm test tests/core/storage.test.ts
```

Expected: FAIL because `@/core/defaults` and `@/core/storage` do not exist.

- [ ] **Step 3: 写领域类型和默认配置**

`src/core/types.ts` 内容：

```ts
export type JobStatus =
  | 'captured'
  | 'enriching'
  | 'filtered'
  | 'scoring'
  | 'drafted'
  | 'reviewing'
  | 'sent'
  | 'skipped'
  | 'failed'

export type ScoreLabel = 'high' | 'medium' | 'low'

export interface CapturedJob {
  jobId: string
  securityId?: string
  lid?: string
  title: string
  company: string
  salary?: string
  location?: string
  experience?: string
  degree?: string
  recruiterName?: string
  recruiterTitle?: string
  recruiterId?: string
  companyId?: string
  activeText?: string
  skills: string[]
  welfare: string[]
  jdText?: string
  sourceUrl: string
}

export interface ReviewJob extends CapturedJob {
  status: JobStatus
  statusMessage: string
  capturedAt: number
  greeting?: GreetingResult
}

export interface GreetingResult {
  score: number
  scoreLabel: ScoreLabel
  jdSummary: string
  matchedEvidence: string[]
  risks: string[]
  greeting: string
  rationale: string
}

export interface Settings {
  maxPages: number
  maxJobs: number
  pageDelayMinMs: number
  pageDelayMaxMs: number
  detailDelayMinMs: number
  detailDelayMaxMs: number
  dailySendLimit: number
  highScoreThreshold: number
  mediumScoreThreshold: number
  blacklistCompanies: string[]
  blacklistRecruiters: string[]
  keywordExcludes: string[]
}

export interface LocalLogEntry {
  id: string
  jobId: string
  action: 'sent' | 'skipped' | 'copied' | 'rewritten' | 'failed'
  message: string
  createdAt: number
}
```

`src/core/defaults.ts` 内容：

```ts
import type { Settings } from './types'

export const DEFAULT_SETTINGS: Settings = {
  maxPages: 5,
  maxJobs: 100,
  pageDelayMinMs: 1200,
  pageDelayMaxMs: 2600,
  detailDelayMinMs: 700,
  detailDelayMaxMs: 1600,
  dailySendLimit: 30,
  highScoreThreshold: 80,
  mediumScoreThreshold: 60,
  blacklistCompanies: [],
  blacklistRecruiters: [],
  keywordExcludes: ['外包', '销售', '电销'],
}

export const DEFAULT_RESUME_PATH = '/Users/sanjin/无用/find_job/简历.md'
```

- [ ] **Step 4: 写存储封装**

`src/core/storage.ts` 内容：

```ts
import { DEFAULT_SETTINGS } from './defaults'
import type { LocalLogEntry, Settings } from './types'

type StorageRecord = Record<string, unknown>

export interface StorageAreaLike {
  get(keys?: string | string[] | StorageRecord | null): Promise<StorageRecord>
  set(items: StorageRecord): Promise<void>
}

const KEYS = {
  settings: 'settings',
  resumeMaterial: 'resumeMaterial',
  reviewedCompanies: 'reviewedCompanies',
  reviewedRecruiters: 'reviewedRecruiters',
  logs: 'logs',
} as const

export function createMemoryStorageArea(seed: StorageRecord = {}): StorageAreaLike {
  const data = new Map<string, unknown>(Object.entries(seed))

  return {
    async get(keys?: string | string[] | StorageRecord | null) {
      if (keys == null) return Object.fromEntries(data.entries())
      if (typeof keys === 'string') return { [keys]: data.get(keys) }
      if (Array.isArray(keys)) {
        return Object.fromEntries(keys.map((key) => [key, data.get(key)]))
      }
      return Object.fromEntries(
        Object.entries(keys).map(([key, fallback]) => [key, data.get(key) ?? fallback]),
      )
    },
    async set(items: StorageRecord) {
      for (const [key, value] of Object.entries(items)) data.set(key, value)
    },
  }
}

export class ExtensionStorage {
  constructor(private readonly area: StorageAreaLike = chrome.storage.local) {}

  async getSettings(): Promise<Settings> {
    const data = await this.area.get({ [KEYS.settings]: {} })
    return { ...DEFAULT_SETTINGS, ...(data[KEYS.settings] as Partial<Settings>) }
  }

  async saveSettings(settings: Partial<Settings>): Promise<void> {
    const current = await this.getSettings()
    await this.area.set({ [KEYS.settings]: { ...current, ...settings } })
  }

  async getResumeMaterial(): Promise<string> {
    const data = await this.area.get({ [KEYS.resumeMaterial]: '' })
    return String(data[KEYS.resumeMaterial] ?? '')
  }

  async saveResumeMaterial(material: string): Promise<void> {
    await this.area.set({ [KEYS.resumeMaterial]: material })
  }

  async markCompanyReviewed(companyId: string): Promise<void> {
    await this.addToSet(KEYS.reviewedCompanies, companyId)
  }

  async hasCompanyReviewed(companyId: string): Promise<boolean> {
    return this.hasInSet(KEYS.reviewedCompanies, companyId)
  }

  async markRecruiterReviewed(recruiterId: string): Promise<void> {
    await this.addToSet(KEYS.reviewedRecruiters, recruiterId)
  }

  async hasRecruiterReviewed(recruiterId: string): Promise<boolean> {
    return this.hasInSet(KEYS.reviewedRecruiters, recruiterId)
  }

  async appendLog(entry: LocalLogEntry): Promise<void> {
    const data = await this.area.get({ [KEYS.logs]: [] })
    const logs = Array.isArray(data[KEYS.logs]) ? (data[KEYS.logs] as LocalLogEntry[]) : []
    await this.area.set({ [KEYS.logs]: [entry, ...logs].slice(0, 500) })
  }

  private async addToSet(key: string, value: string): Promise<void> {
    const data = await this.area.get({ [key]: [] })
    const values = new Set(Array.isArray(data[key]) ? (data[key] as string[]) : [])
    values.add(value)
    await this.area.set({ [key]: [...values] })
  }

  private async hasInSet(key: string, value: string): Promise<boolean> {
    const data = await this.area.get({ [key]: [] })
    const values = Array.isArray(data[key]) ? (data[key] as string[]) : []
    return values.includes(value)
  }
}
```

- [ ] **Step 5: 运行测试、类型检查并提交**

Run:

```bash
pnpm test tests/core/storage.test.ts
pnpm run typecheck
```

Expected: both pass.

Commit:

```bash
git add src/core tests/core
git commit -m "feat: add extension domain storage"
```

---

### Task 3: 实现打招呼语生成规则和离线兜底

**Files:**
- Create: `src/utils/text.ts`
- Create: `src/core/greeting.ts`
- Create: `tests/core/greeting.test.ts`

- [ ] **Step 1: 写 failing tests**

`tests/core/greeting.test.ts` 内容：

```ts
import { describe, expect, it } from 'vitest'

import { buildGreetingPrompt, createRuleBasedGreeting, validateGreetingResult } from '@/core/greeting'
import type { CapturedJob } from '@/core/types'

const job: CapturedJob = {
  jobId: 'job-1',
  title: 'AI 产品经理',
  company: '示例科技',
  salary: '25-35K',
  location: '上海',
  experience: '3-5年',
  degree: '本科',
  recruiterName: '王女士',
  recruiterTitle: 'HR',
  companyId: 'company-1',
  recruiterId: 'recruiter-1',
  skills: ['AI产品', '需求分析', '跨团队协作'],
  welfare: ['双休'],
  jdText: '负责 AI 应用产品规划、需求拆解、跨团队推进和数据分析。',
  sourceUrl: 'https://www.zhipin.com/job_detail/job-1.html',
}

describe('greeting generation', () => {
  it('builds a prompt with resume and JD evidence', () => {
    const prompt = buildGreetingPrompt(job, '6年AI产品经验，做过智能体和ToB产品。')

    expect(prompt).toContain('6年AI产品经验')
    expect(prompt).toContain('AI 产品经理')
    expect(prompt).toContain('负责 AI 应用产品规划')
    expect(prompt).toContain('80-120')
  })

  it('creates a concise rule based greeting without inventing facts', () => {
    const result = createRuleBasedGreeting(job, '6年AI产品经验，做过智能体和ToB产品。')

    expect(result.score).toBeGreaterThanOrEqual(60)
    expect(result.scoreLabel).toBe('medium')
    expect(result.greeting).toContain('你好')
    expect(result.greeting).toContain('6年AI产品经验')
    expect(result.greeting.length).toBeLessThanOrEqual(150)
    expect(result.matchedEvidence[0]).toContain('6年AI产品经验')
  })

  it('rejects greetings with unsupported evidence', () => {
    const result = createRuleBasedGreeting(job, '6年AI产品经验，做过智能体和ToB产品。')
    const invalid = { ...result, greeting: '你好，前字节AI负责人，管理过百人团队，想进一步沟通。' }

    expect(validateGreetingResult(invalid, job, '6年AI产品经验，做过智能体和ToB产品。').ok).toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm test tests/core/greeting.test.ts
```

Expected: FAIL because `@/core/greeting` and `@/utils/text` do not exist.

- [ ] **Step 3: 写文本工具**

`src/utils/text.ts` 内容：

```ts
export function compactText(value: string | undefined): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

export function firstNonEmpty(values: Array<string | undefined>): string {
  return values.map(compactText).find(Boolean) ?? ''
}

export function includesAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase()
  return keywords.some((keyword) => keyword && lower.includes(keyword.toLowerCase()))
}

export function trimToLength(text: string, maxLength: number): string {
  const value = compactText(text)
  return value.length <= maxLength ? value : value.slice(0, maxLength - 1)
}
```

- [ ] **Step 4: 写打招呼语模块**

`src/core/greeting.ts` 内容：

```ts
import type { CapturedJob, GreetingResult, ScoreLabel } from './types'
import { compactText, includesAny, trimToLength } from '@/utils/text'

const RISK_KEYWORDS = ['外包', '销售', '电销', '驻场']
const STRONG_MATCH_KEYWORDS = ['AI', '智能体', 'ToB', 'SaaS', '增长', '数据分析', '需求分析']
const UNSUPPORTED_CLAIMS = ['前字节', '百人团队', '负责人', '千万级', '上市公司']

export function buildGreetingPrompt(job: CapturedJob, resumeMaterial: string): string {
  return `你是求职打招呼语助手。请只基于简历素材和 JD 生成中文 Boss 直聘打招呼语。

约束：
- 80-120 个中文字符，最多 150 个字符。
- 不编造经历、数字、公司、工具或头衔。
- 结构：简短问候 + 预览钩子 + 匹配证据 + 低成本下一步。
- 输出 JSON，字段为 score, scoreLabel, jdSummary, matchedEvidence, risks, greeting, rationale。

简历素材：
${resumeMaterial}

岗位：
岗位名：${job.title}
公司：${job.company}
薪资：${job.salary ?? ''}
地点：${job.location ?? ''}
经验：${job.experience ?? ''}
学历：${job.degree ?? ''}
技能：${job.skills.join('、')}
JD：${job.jdText ?? ''}
`
}

export function createRuleBasedGreeting(job: CapturedJob, resumeMaterial: string): GreetingResult {
  const resume = compactText(resumeMaterial)
  const jd = compactText(`${job.title} ${job.skills.join(' ')} ${job.jdText ?? ''}`)
  const evidence = selectEvidence(resume, jd)
  const risks = detectRisks(job)
  const score = calculateScore(evidence, risks)
  const scoreLabel = toScoreLabel(score)
  const hook = evidence[0] || '有相关产品经验'
  const roleSignal = job.title.includes('AI') || jd.includes('AI') ? 'AI产品规划/落地' : '岗位核心要求'
  const greeting = trimToLength(
    `你好，${hook}。我过往经历和这个岗位的${roleSignal}、需求拆解及跨团队推进较匹配，已附简历供参考，想进一步沟通。`,
    150,
  )

  return {
    score,
    scoreLabel,
    jdSummary: trimToLength(`${job.title}，重点是${compactText(job.jdText).slice(0, 48)}`, 90),
    matchedEvidence: evidence,
    risks,
    greeting,
    rationale: evidence.length > 0 ? '使用简历中最贴近 JD 的证据生成。' : '简历证据较弱，仅生成保守版本。',
  }
}

export function validateGreetingResult(
  result: GreetingResult,
  job: CapturedJob,
  resumeMaterial: string,
): { ok: boolean; reason: string } {
  if (result.greeting.length > 150) return { ok: false, reason: '招呼语超过 150 字符' }
  const allowedText = `${resumeMaterial} ${job.title} ${job.company} ${job.jdText ?? ''} ${job.skills.join(' ')}`
  const unsupported = UNSUPPORTED_CLAIMS.find(
    (claim) => result.greeting.includes(claim) && !allowedText.includes(claim),
  )
  if (unsupported) return { ok: false, reason: `包含未提供证据：${unsupported}` }
  if (!result.greeting.startsWith('你好')) return { ok: false, reason: '缺少简短问候' }
  return { ok: true, reason: 'ok' }
}

function selectEvidence(resume: string, jd: string): string[] {
  const candidates = resume
    .split(/[。；;\n]/)
    .map(compactText)
    .filter(Boolean)

  const matched = candidates.filter((line) => {
    const lineTokens = STRONG_MATCH_KEYWORDS.filter((keyword) => line.includes(keyword))
    return lineTokens.some((keyword) => jd.includes(keyword))
  })

  return (matched.length > 0 ? matched : candidates).slice(0, 2)
}

function detectRisks(job: CapturedJob): string[] {
  const text = `${job.title} ${job.company} ${job.jdText ?? ''}`
  return RISK_KEYWORDS.filter((keyword) => includesAny(text, [keyword])).map((keyword) => `可能包含${keyword}`)
}

function calculateScore(evidence: string[], risks: string[]): number {
  return Math.max(30, Math.min(95, 55 + evidence.length * 15 - risks.length * 10))
}

function toScoreLabel(score: number): ScoreLabel {
  if (score >= 80) return 'high'
  if (score >= 60) return 'medium'
  return 'low'
}
```

- [ ] **Step 5: 运行测试、类型检查并提交**

Run:

```bash
pnpm test tests/core/greeting.test.ts
pnpm run typecheck
```

Expected: both pass.

Commit:

```bash
git add src/core/greeting.ts src/utils/text.ts tests/core/greeting.test.ts
git commit -m "feat: add greeting generation rules"
```

---

### Task 4: 实现岗位处理 Pipeline

**Files:**
- Create: `src/core/pipeline.ts`
- Create: `tests/core/pipeline.test.ts`

- [ ] **Step 1: 写 failing tests**

`tests/core/pipeline.test.ts` 内容：

```ts
import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS } from '@/core/defaults'
import { runJobPipeline } from '@/core/pipeline'
import { createMemoryStorageArea, ExtensionStorage } from '@/core/storage'
import type { CapturedJob } from '@/core/types'

const baseJob: CapturedJob = {
  jobId: 'job-1',
  title: 'AI 产品经理',
  company: '示例科技',
  companyId: 'company-1',
  recruiterId: 'recruiter-1',
  skills: ['AI产品'],
  welfare: [],
  jdText: '负责 AI 应用产品规划。',
  sourceUrl: 'https://www.zhipin.com/job_detail/job-1.html',
}

describe('runJobPipeline', () => {
  it('drafts a reviewable job when it passes filters', async () => {
    const storage = new ExtensionStorage(createMemoryStorageArea())
    const result = await runJobPipeline({
      job: baseJob,
      resumeMaterial: '6年AI产品经验，做过智能体和ToB产品。',
      settings: DEFAULT_SETTINGS,
      storage,
    })

    expect(result.status).toBe('drafted')
    expect(result.greeting?.greeting).toContain('你好')
  })

  it('filters duplicate company', async () => {
    const storage = new ExtensionStorage(createMemoryStorageArea())
    await storage.markCompanyReviewed('company-1')

    const result = await runJobPipeline({
      job: baseJob,
      resumeMaterial: '6年AI产品经验',
      settings: DEFAULT_SETTINGS,
      storage,
    })

    expect(result.status).toBe('filtered')
    expect(result.statusMessage).toContain('同公司')
  })

  it('filters blacklisted keyword', async () => {
    const result = await runJobPipeline({
      job: { ...baseJob, jdText: '外包驻场项目，需要销售支持。' },
      resumeMaterial: '6年AI产品经验',
      settings: DEFAULT_SETTINGS,
      storage: new ExtensionStorage(createMemoryStorageArea()),
    })

    expect(result.status).toBe('filtered')
    expect(result.statusMessage).toContain('关键词')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm test tests/core/pipeline.test.ts
```

Expected: FAIL because `@/core/pipeline` does not exist.

- [ ] **Step 3: 写 pipeline**

`src/core/pipeline.ts` 内容：

```ts
import { createRuleBasedGreeting, validateGreetingResult } from './greeting'
import type { CapturedJob, ReviewJob, Settings } from './types'
import type { ExtensionStorage } from './storage'
import { includesAny } from '@/utils/text'

export interface PipelineInput {
  job: CapturedJob
  resumeMaterial: string
  settings: Settings
  storage: ExtensionStorage
}

export async function runJobPipeline(input: PipelineInput): Promise<ReviewJob> {
  const { job, resumeMaterial, settings, storage } = input
  const base = toReviewJob(job, 'captured', '已抓取')

  if (job.companyId && (await storage.hasCompanyReviewed(job.companyId))) {
    return { ...base, status: 'filtered', statusMessage: '同公司已处理' }
  }

  if (job.recruiterId && (await storage.hasRecruiterReviewed(job.recruiterId))) {
    return { ...base, status: 'filtered', statusMessage: '同招聘者已处理' }
  }

  if (settings.blacklistCompanies.includes(job.company)) {
    return { ...base, status: 'filtered', statusMessage: '公司在黑名单中' }
  }

  const filterText = `${job.title} ${job.company} ${job.jdText ?? ''}`
  if (includesAny(filterText, settings.keywordExcludes)) {
    return { ...base, status: 'filtered', statusMessage: '命中排除关键词' }
  }

  const greeting = createRuleBasedGreeting(job, resumeMaterial)
  const validation = validateGreetingResult(greeting, job, resumeMaterial)
  if (!validation.ok) {
    return { ...base, status: 'failed', statusMessage: validation.reason, greeting }
  }

  return {
    ...base,
    status: 'drafted',
    statusMessage: '已生成草稿',
    greeting,
  }
}

function toReviewJob(job: CapturedJob, status: ReviewJob['status'], statusMessage: string): ReviewJob {
  return {
    ...job,
    status,
    statusMessage,
    capturedAt: Date.now(),
  }
}
```

- [ ] **Step 4: 运行测试、类型检查并提交**

Run:

```bash
pnpm test tests/core/pipeline.test.ts
pnpm run typecheck
```

Expected: both pass.

Commit:

```bash
git add src/core/pipeline.ts tests/core/pipeline.test.ts
git commit -m "feat: add job review pipeline"
```

---

### Task 5: 实现 Boss DOM 适配器和翻页探测

**Files:**
- Create: `src/page/bossAdapter.ts`
- Create: `src/page/bossRuntime.ts`
- Create: `tests/page/bossAdapter.test.ts`

- [ ] **Step 1: 写 failing tests**

`tests/page/bossAdapter.test.ts` 内容：

```ts
import { describe, expect, it } from 'vitest'

import { DomBossAdapter } from '@/page/bossAdapter'

describe('DomBossAdapter', () => {
  it('captures visible job cards from DOM', async () => {
    document.body.innerHTML = `
      <a class="job-card-wrapper" href="/job_detail/job-1.html">
        <span class="job-name">AI 产品经理</span>
        <span class="boss-name">王女士</span>
        <span class="boss-title">HR</span>
        <span class="salary">25-35K</span>
        <span class="job-area">上海</span>
        <span class="company-name">示例科技</span>
        <span class="tag">AI产品</span>
      </a>
    `

    const adapter = new DomBossAdapter(document)
    const jobs = await adapter.captureCurrentPage()

    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({
      jobId: 'job-1',
      title: 'AI 产品经理',
      company: '示例科技',
      salary: '25-35K',
      location: '上海',
      recruiterName: '王女士',
    })
  })

  it('detects next page availability', () => {
    document.body.innerHTML = `<button class="next">下一页</button>`

    const adapter = new DomBossAdapter(document)

    expect(adapter.hasNextPage()).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm test tests/page/bossAdapter.test.ts
```

Expected: FAIL because page adapter files do not exist.

- [ ] **Step 3: 写页面运行时辅助**

`src/page/bossRuntime.ts` 内容：

```ts
export function findBossVueRoot(doc: Document = document): unknown | null {
  const wrap = doc.querySelector<HTMLElement>('#wrap')
  return wrap && '__vue__' in wrap ? (wrap as HTMLElement & { __vue__?: unknown }).__vue__ ?? null : null
}

export function isVerificationVisible(doc: Document = document): boolean {
  const text = doc.body.textContent ?? ''
  return ['验证码', '安全验证', '登录异常', '操作过于频繁'].some((keyword) => text.includes(keyword))
}
```

- [ ] **Step 4: 写 DOM 适配器**

`src/page/bossAdapter.ts` 内容：

```ts
import type { CapturedJob } from '@/core/types'
import { compactText } from '@/utils/text'

export interface BossPageAdapter {
  captureCurrentPage(): Promise<CapturedJob[]>
  enrichJob(job: CapturedJob): Promise<CapturedJob>
  hasNextPage(): boolean
  goNextPage(): Promise<void>
}

export class DomBossAdapter implements BossPageAdapter {
  constructor(private readonly doc: Document = document) {}

  async captureCurrentPage(): Promise<CapturedJob[]> {
    const cards = Array.from(
      this.doc.querySelectorAll<HTMLElement>('.job-card-wrapper, .job-card-left, a[href*="/job_detail/"]'),
    )

    const jobs = cards.map((card) => this.parseCard(card)).filter((job): job is CapturedJob => job != null)
    return uniqueJobs(jobs)
  }

  async enrichJob(job: CapturedJob): Promise<CapturedJob> {
    return job
  }

  hasNextPage(): boolean {
    const candidates = Array.from(this.doc.querySelectorAll<HTMLElement>('button, a, .next, .ui-icon-arrow-right'))
    return candidates.some((node) => compactText(node.textContent).includes('下一页') || node.className.includes('next'))
  }

  async goNextPage(): Promise<void> {
    const next = Array.from(this.doc.querySelectorAll<HTMLElement>('button, a, .next')).find(
      (node) => compactText(node.textContent).includes('下一页') || node.className.includes('next'),
    )
    next?.click()
  }

  private parseCard(card: HTMLElement): CapturedJob | null {
    const link = card.matches('a') ? (card as HTMLAnchorElement) : card.querySelector<HTMLAnchorElement>('a[href*="/job_detail/"]')
    const href = link?.href || card.getAttribute('href') || ''
    const jobId = parseJobId(href)
    const title = selectText(card, ['.job-name', '.job-title', '[class*="job-name"]'])
    const company = selectText(card, ['.company-name', '.boss-company', '[class*="company"]'])

    if (!jobId || !title || !company) return null

    return {
      jobId,
      title,
      company,
      salary: selectText(card, ['.salary', '.job-salary', '[class*="salary"]']),
      location: selectText(card, ['.job-area', '.location', '[class*="area"]']),
      recruiterName: selectText(card, ['.boss-name', '[class*="boss-name"]']),
      recruiterTitle: selectText(card, ['.boss-title', '[class*="boss-title"]']),
      skills: selectTexts(card, ['.tag', '.job-tag', '[class*="tag"]']),
      welfare: [],
      sourceUrl: href || location.href,
    }
  }
}

function selectText(root: HTMLElement, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const value = compactText(root.querySelector(selector)?.textContent ?? '')
    if (value) return value
  }
  return undefined
}

function selectTexts(root: HTMLElement, selectors: string[]): string[] {
  return [...new Set(selectors.flatMap((selector) => Array.from(root.querySelectorAll(selector)).map((node) => compactText(node.textContent ?? '')).filter(Boolean)))]
}

function parseJobId(href: string): string {
  const match = href.match(/job_detail\/([^/?#]+)(?:\.html)?/)
  return match?.[1] ?? ''
}

function uniqueJobs(jobs: CapturedJob[]): CapturedJob[] {
  const map = new Map<string, CapturedJob>()
  for (const job of jobs) map.set(job.jobId, job)
  return [...map.values()]
}
```

- [ ] **Step 5: 运行测试、类型检查并提交**

Run:

```bash
pnpm test tests/page/bossAdapter.test.ts
pnpm run typecheck
```

Expected: both pass.

Commit:

```bash
git add src/page tests/page
git commit -m "feat: add Boss page DOM adapter"
```

---

### Task 6: 实现多页扫描状态机

**Files:**
- Create: `src/utils/delay.ts`
- Create: `src/core/scanner.ts`
- Create: `tests/core/scanner.test.ts`

- [ ] **Step 1: 写 failing tests**

`tests/core/scanner.test.ts` 内容：

```ts
import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS } from '@/core/defaults'
import { ScanController } from '@/core/scanner'
import type { BossPageAdapter } from '@/page/bossAdapter'

describe('ScanController', () => {
  it('stops at configured max pages', async () => {
    const adapter = createFakeAdapter(10)
    const controller = new ScanController(adapter, { ...DEFAULT_SETTINGS, maxPages: 2, maxJobs: 20 })

    const jobs = await controller.scan()

    expect(jobs.map((job) => job.jobId)).toEqual(['job-page-1', 'job-page-2'])
  })

  it('stops at configured max jobs', async () => {
    const adapter = createFakeAdapter(10)
    const controller = new ScanController(adapter, { ...DEFAULT_SETTINGS, maxPages: 10, maxJobs: 1 })

    const jobs = await controller.scan()

    expect(jobs).toHaveLength(1)
  })
})

function createFakeAdapter(totalPages: number): BossPageAdapter {
  let page = 1
  return {
    async captureCurrentPage() {
      return [
        {
          jobId: `job-page-${page}`,
          title: 'AI 产品经理',
          company: '示例科技',
          skills: [],
          welfare: [],
          sourceUrl: 'https://www.zhipin.com',
        },
      ]
    },
    async enrichJob(job) {
      return job
    },
    hasNextPage() {
      return page < totalPages
    },
    async goNextPage() {
      page += 1
    },
  }
}
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm test tests/core/scanner.test.ts
```

Expected: FAIL because `@/core/scanner` does not exist.

- [ ] **Step 3: 写延迟工具和扫描器**

`src/utils/delay.ts` 内容：

```ts
export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}
```

`src/core/scanner.ts` 内容：

```ts
import type { Settings, CapturedJob } from './types'
import type { BossPageAdapter } from '@/page/bossAdapter'
import { randomBetween, sleep } from '@/utils/delay'

export class ScanController {
  private stopped = false
  private paused = false

  constructor(
    private readonly adapter: BossPageAdapter,
    private readonly settings: Settings,
  ) {}

  pause(): void {
    this.paused = true
  }

  resume(): void {
    this.paused = false
  }

  stop(): void {
    this.stopped = true
  }

  async scan(): Promise<CapturedJob[]> {
    const collected = new Map<string, CapturedJob>()

    for (let page = 1; page <= this.settings.maxPages; page += 1) {
      if (this.stopped) break
      await this.waitWhilePaused()

      const jobs = await this.adapter.captureCurrentPage()
      for (const job of jobs) {
        if (collected.size >= this.settings.maxJobs) break
        if (!collected.has(job.jobId)) {
          const enriched = await this.adapter.enrichJob(job)
          collected.set(enriched.jobId, enriched)
          await sleep(randomBetween(this.settings.detailDelayMinMs, this.settings.detailDelayMaxMs))
        }
      }

      if (collected.size >= this.settings.maxJobs) break
      if (page >= this.settings.maxPages) break
      if (!this.adapter.hasNextPage()) break

      await sleep(randomBetween(this.settings.pageDelayMinMs, this.settings.pageDelayMaxMs))
      await this.adapter.goNextPage()
    }

    return [...collected.values()]
  }

  private async waitWhilePaused(): Promise<void> {
    while (this.paused && !this.stopped) {
      await sleep(100)
    }
  }
}
```

- [ ] **Step 4: 运行测试、类型检查并提交**

Run:

```bash
pnpm test tests/core/scanner.test.ts
pnpm run typecheck
```

Expected: both pass.

Commit:

```bash
git add src/core/scanner.ts src/utils/delay.ts tests/core/scanner.test.ts
git commit -m "feat: add bounded page scanner"
```

---

### Task 7: 实现 Pinia 审核队列 Store

**Files:**
- Create: `src/app/stores/reviewStore.ts`
- Create: `tests/app/reviewStore.test.ts`

- [ ] **Step 1: 写 failing tests**

`tests/app/reviewStore.test.ts` 内容：

```ts
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useReviewStore } from '@/app/stores/reviewStore'
import type { ReviewJob } from '@/core/types'

describe('reviewStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('adds drafted jobs and selects first job', () => {
    const store = useReviewStore()
    const job = createReviewJob('job-1')

    store.setJobs([job])

    expect(store.jobs).toHaveLength(1)
    expect(store.selectedJob?.jobId).toBe('job-1')
  })

  it('marks selected job as skipped', () => {
    const store = useReviewStore()
    store.setJobs([createReviewJob('job-1')])

    store.skipSelected()

    expect(store.jobs[0].status).toBe('skipped')
  })
})

function createReviewJob(jobId: string): ReviewJob {
  return {
    jobId,
    title: 'AI 产品经理',
    company: '示例科技',
    skills: [],
    welfare: [],
    sourceUrl: 'https://www.zhipin.com',
    status: 'drafted',
    statusMessage: '已生成草稿',
    capturedAt: Date.now(),
  }
}
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm test tests/app/reviewStore.test.ts
```

Expected: FAIL because store file does not exist.

- [ ] **Step 3: 写 store**

`src/app/stores/reviewStore.ts` 内容：

```ts
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { ReviewJob } from '@/core/types'

export const useReviewStore = defineStore('review', () => {
  const jobs = ref<ReviewJob[]>([])
  const selectedJobId = ref<string>('')
  const scanning = ref(false)
  const paused = ref(false)

  const selectedJob = computed(() => jobs.value.find((job) => job.jobId === selectedJobId.value))
  const stats = computed(() => ({
    captured: jobs.value.length,
    high: jobs.value.filter((job) => job.greeting?.scoreLabel === 'high').length,
    review: jobs.value.filter((job) => ['drafted', 'reviewing'].includes(job.status)).length,
    sent: jobs.value.filter((job) => job.status === 'sent').length,
    skipped: jobs.value.filter((job) => job.status === 'skipped').length,
  }))

  function setJobs(nextJobs: ReviewJob[]): void {
    jobs.value = nextJobs
    selectedJobId.value = nextJobs[0]?.jobId ?? ''
  }

  function selectJob(jobId: string): void {
    selectedJobId.value = jobId
  }

  function skipSelected(): void {
    updateSelected({ status: 'skipped', statusMessage: '已跳过' })
  }

  function markSelectedSent(): void {
    updateSelected({ status: 'sent', statusMessage: '已发送' })
  }

  function updateSelected(patch: Partial<ReviewJob>): void {
    jobs.value = jobs.value.map((job) => (job.jobId === selectedJobId.value ? { ...job, ...patch } : job))
  }

  return {
    jobs,
    selectedJobId,
    selectedJob,
    scanning,
    paused,
    stats,
    setJobs,
    selectJob,
    skipSelected,
    markSelectedSent,
    updateSelected,
  }
})
```

- [ ] **Step 4: 运行测试、类型检查并提交**

Run:

```bash
pnpm test tests/app/reviewStore.test.ts
pnpm run typecheck
```

Expected: both pass.

Commit:

```bash
git add src/app/stores tests/app/reviewStore.test.ts
git commit -m "feat: add review queue store"
```

---

### Task 8: 实现简洁高级右侧审核面板

**Files:**
- Modify: `src/app/App.vue`
- Create: `src/app/components/ScanControls.vue`
- Create: `src/app/components/StatsBar.vue`
- Create: `src/app/components/JobQueue.vue`
- Create: `src/app/components/JobReview.vue`
- Modify: `src/styles/main.css`
- Create: `tests/app/App.test.ts`

- [ ] **Step 1: 写 UI smoke test**

`tests/app/App.test.ts` 内容：

```ts
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import App from '@/app/App.vue'

describe('App', () => {
  it('renders the review panel controls', () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia()],
      },
    })

    expect(wrapper.text()).toContain('Boss 人审助手')
    expect(wrapper.text()).toContain('扫描当前页')
    expect(wrapper.text()).toContain('连续扫描')
    expect(wrapper.text()).toContain('待审')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm test tests/app/App.test.ts
```

Expected: FAIL because components are not implemented.

- [ ] **Step 3: 写组件**

`src/app/components/ScanControls.vue` 内容：

```vue
<template>
  <section class="brs-section brs-controls" aria-label="扫描控制">
    <button class="brs-button brs-button-secondary" type="button">扫描当前页</button>
    <button class="brs-button brs-button-primary" type="button">连续扫描</button>
    <button class="brs-icon-button" type="button" aria-label="暂停扫描">
      <PauseIcon :size="16" />
    </button>
  </section>
</template>

<script setup lang="ts">
import { PauseIcon } from 'lucide-vue-next'
</script>
```

`src/app/components/StatsBar.vue` 内容：

```vue
<template>
  <section class="brs-stats" aria-label="统计">
    <span>已抓取 {{ stats.captured }}</span>
    <span>高分 {{ stats.high }}</span>
    <span>待审 {{ stats.review }}</span>
    <span>已发 {{ stats.sent }}</span>
    <span>跳过 {{ stats.skipped }}</span>
  </section>
</template>

<script setup lang="ts">
import { useReviewStore } from '@/app/stores/reviewStore'

const { stats } = useReviewStore()
</script>
```

`src/app/components/JobQueue.vue` 内容：

```vue
<template>
  <section class="brs-section" aria-label="岗位队列">
    <div class="brs-section-title">
      <h2>队列</h2>
    </div>
    <p v-if="store.jobs.length === 0" class="brs-empty">扫描后，高匹配岗位会出现在这里。</p>
    <button
      v-for="job in store.jobs"
      :key="job.jobId"
      class="brs-job-row"
      :class="{ active: job.jobId === store.selectedJobId }"
      type="button"
      @click="store.selectJob(job.jobId)"
    >
      <span class="brs-job-main">
        <strong>{{ job.title }}</strong>
        <small>{{ job.company }}</small>
      </span>
      <span class="brs-score">{{ job.greeting?.score ?? '-' }}</span>
    </button>
  </section>
</template>

<script setup lang="ts">
import { useReviewStore } from '@/app/stores/reviewStore'

const store = useReviewStore()
</script>
```

`src/app/components/JobReview.vue` 内容：

```vue
<template>
  <section class="brs-section brs-review" aria-label="岗位审核">
    <div class="brs-section-title">
      <h2>当前岗位</h2>
    </div>
    <p v-if="!job" class="brs-empty">选择一个岗位后审核 JD、证据和打招呼语。</p>
    <template v-else>
      <h3>{{ job.title }}</h3>
      <p class="brs-meta">{{ job.company }} · {{ job.salary || '薪资未披露' }} · {{ job.location || '地点未知' }}</p>
      <div class="brs-block">
        <span>JD 摘要</span>
        <p>{{ job.greeting?.jdSummary || job.jdText || '暂无详情' }}</p>
      </div>
      <div class="brs-block">
        <span>简历匹配证据</span>
        <p>{{ evidence }}</p>
      </div>
      <div class="brs-draft">{{ job.greeting?.greeting || '等待生成草稿' }}</div>
      <div class="brs-actions">
        <button class="brs-button brs-button-primary" type="button">发送</button>
        <button class="brs-icon-button" type="button" aria-label="重写"><RefreshCwIcon :size="16" /></button>
        <button class="brs-icon-button" type="button" aria-label="复制"><CopyIcon :size="16" /></button>
        <button class="brs-button brs-button-secondary" type="button" @click="store.skipSelected">跳过</button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CopyIcon, RefreshCwIcon } from 'lucide-vue-next'

import { useReviewStore } from '@/app/stores/reviewStore'

const store = useReviewStore()
const job = computed(() => store.selectedJob)
const evidence = computed(() => job.value?.greeting?.matchedEvidence.join('；') || '暂无匹配证据')
</script>
```

`src/app/App.vue` 内容：

```vue
<template>
  <aside class="brs-shell" aria-label="Boss 人审助手">
    <header class="brs-header">
      <p class="brs-kicker">Boss 人审助手</p>
      <h1>岗位审核队列</h1>
      <p class="brs-subtitle">5 页 · 100 岗 · 人审发送</p>
    </header>
    <ScanControls />
    <StatsBar />
    <main class="brs-main">
      <JobQueue />
      <JobReview />
    </main>
  </aside>
</template>

<script setup lang="ts">
import JobQueue from './components/JobQueue.vue'
import JobReview from './components/JobReview.vue'
import ScanControls from './components/ScanControls.vue'
import StatsBar from './components/StatsBar.vue'
</script>
```

- [ ] **Step 4: 更新 CSS**

Add to `src/styles/main.css`:

```css
.brs-subtitle {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
}

.brs-main {
  display: grid;
  gap: 10px;
  padding: 12px;
}

.brs-section {
  border-top: 1px solid #e5eeee;
  padding: 12px;
}

.brs-controls {
  display: grid;
  grid-template-columns: 1fr 1fr 36px;
  gap: 8px;
}

.brs-button,
.brs-icon-button,
.brs-job-row {
  cursor: pointer;
  border: 1px solid #cbded9;
  background: #ffffff;
  color: #13231f;
  border-radius: 8px;
  font: inherit;
  transition: border-color 160ms ease, background 160ms ease, color 160ms ease;
}

.brs-button {
  min-height: 34px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 700;
}

.brs-button-primary {
  border-color: #f97316;
  background: #f97316;
  color: #ffffff;
}

.brs-button-secondary:hover,
.brs-icon-button:hover,
.brs-job-row:hover {
  border-color: #0d9488;
}

.brs-icon-button {
  display: inline-grid;
  min-width: 34px;
  min-height: 34px;
  place-items: center;
}

.brs-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid #e5eeee;
  color: #475569;
  font-size: 12px;
}

.brs-section-title h2 {
  margin: 0 0 8px;
  font-size: 13px;
}

.brs-empty {
  margin: 0;
  color: #64748b;
  font-size: 12px;
}

.brs-job-row {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  padding: 9px 10px;
  text-align: left;
}

.brs-job-row + .brs-job-row {
  margin-top: 6px;
}

.brs-job-row.active {
  border-color: #0d9488;
  background: #f0fdfa;
}

.brs-job-main {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.brs-job-main strong,
.brs-job-main small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brs-job-main strong {
  font-size: 13px;
}

.brs-job-main small,
.brs-meta {
  color: #64748b;
  font-size: 12px;
}

.brs-score {
  color: #0d9488;
  font-weight: 800;
}

.brs-review h3 {
  margin: 0;
  font-size: 15px;
}

.brs-meta {
  margin: 4px 0 10px;
}

.brs-block {
  margin-top: 10px;
}

.brs-block span {
  color: #0d9488;
  font-size: 12px;
  font-weight: 800;
}

.brs-block p {
  margin: 4px 0 0;
  color: #334155;
  font-size: 12px;
  line-height: 1.55;
}

.brs-draft {
  margin-top: 12px;
  padding: 10px;
  border: 1px solid #cbded9;
  background: #ffffff;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.6;
}

.brs-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
```

- [ ] **Step 5: 运行测试、类型检查并提交**

Run:

```bash
pnpm test tests/app/App.test.ts
pnpm run typecheck
pnpm run build
```

Expected: all pass.

Commit:

```bash
git add src/app src/styles tests/app/App.test.ts
git commit -m "feat: build review panel UI"
```

---

### Task 9: 连接扫描、pipeline 和 UI

**Files:**
- Modify: `src/app/stores/reviewStore.ts`
- Modify: `src/app/components/ScanControls.vue`
- Modify: `src/entrypoints/main-world.ts`

- [ ] **Step 1: 给 store 增加扫描 action**

Modify `src/app/stores/reviewStore.ts` by adding imports:

```ts
import { DEFAULT_SETTINGS } from '@/core/defaults'
import { runJobPipeline } from '@/core/pipeline'
import { ScanController } from '@/core/scanner'
import { ExtensionStorage } from '@/core/storage'
import { DomBossAdapter } from '@/page/bossAdapter'
```

Add inside store:

```ts
const storage = new ExtensionStorage()

async function scanCurrentPage(): Promise<void> {
  scanning.value = true
  try {
    const settings = await storage.getSettings()
    const resumeMaterial = await storage.getResumeMaterial()
    const adapter = new DomBossAdapter(document)
    const captured = await adapter.captureCurrentPage()
    const drafted = await Promise.all(
      captured.map((job) => runJobPipeline({ job, resumeMaterial, settings, storage })),
    )
    setJobs(drafted)
  } finally {
    scanning.value = false
  }
}

async function scanPages(): Promise<void> {
  scanning.value = true
  try {
    const settings = await storage.getSettings()
    const resumeMaterial = await storage.getResumeMaterial()
    const adapter = new DomBossAdapter(document)
    const controller = new ScanController(adapter, settings)
    const captured = await controller.scan()
    const drafted = await Promise.all(
      captured.map((job) => runJobPipeline({ job, resumeMaterial, settings, storage })),
    )
    setJobs(drafted)
  } finally {
    scanning.value = false
  }
}
```

Return `scanCurrentPage` and `scanPages` from the store.

- [ ] **Step 2: 连接扫描按钮**

Modify `src/app/components/ScanControls.vue`:

```vue
<template>
  <section class="brs-section brs-controls" aria-label="扫描控制">
    <button class="brs-button brs-button-secondary" type="button" :disabled="store.scanning" @click="store.scanCurrentPage">
      扫描当前页
    </button>
    <button class="brs-button brs-button-primary" type="button" :disabled="store.scanning" @click="store.scanPages">
      连续扫描
    </button>
    <button class="brs-icon-button" type="button" aria-label="暂停扫描" :disabled="!store.scanning">
      <PauseIcon :size="16" />
    </button>
  </section>
</template>

<script setup lang="ts">
import { PauseIcon } from 'lucide-vue-next'

import { useReviewStore } from '@/app/stores/reviewStore'

const store = useReviewStore()
</script>
```

- [ ] **Step 3: 运行测试、类型检查并提交**

Run:

```bash
pnpm test
pnpm run typecheck
pnpm run build
```

Expected: all pass.

Commit:

```bash
git add src/app/stores/reviewStore.ts src/app/components/ScanControls.vue src/entrypoints/main-world.ts
git commit -m "feat: connect scanner to review UI"
```

---

### Task 10: 实现复制并聚焦发送兜底

**Files:**
- Create: `src/page/sender.ts`
- Modify: `src/app/stores/reviewStore.ts`
- Modify: `src/app/components/JobReview.vue`
- Create: `tests/page/sender.test.ts`

- [ ] **Step 1: 写 failing tests**

`tests/page/sender.test.ts` 内容：

```ts
import { describe, expect, it, vi } from 'vitest'

import { copyAndFocusBossInput } from '@/page/sender'

describe('copyAndFocusBossInput', () => {
  it('copies greeting and focuses textarea', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    document.body.innerHTML = `<textarea class="chat-input"></textarea>`

    const result = await copyAndFocusBossInput('你好，想进一步沟通。', document)

    expect(result.ok).toBe(true)
    expect(writeText).toHaveBeenCalledWith('你好，想进一步沟通。')
    expect(document.activeElement).toBe(document.querySelector('textarea'))
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm test tests/page/sender.test.ts
```

Expected: FAIL because sender file does not exist.

- [ ] **Step 3: 写 sender**

`src/page/sender.ts` 内容：

```ts
export interface SendResult {
  ok: boolean
  mode: 'copy-focus'
  message: string
}

export async function copyAndFocusBossInput(greeting: string, doc: Document = document): Promise<SendResult> {
  await navigator.clipboard.writeText(greeting)

  const input = doc.querySelector<HTMLElement>(
    'textarea, [contenteditable="true"], .chat-input, [class*="chat"] textarea',
  )

  input?.focus()

  return {
    ok: true,
    mode: 'copy-focus',
    message: input ? '已复制并聚焦输入框，请手动确认发送。' : '已复制打招呼语，请手动粘贴发送。',
  }
}
```

- [ ] **Step 4: 连接 UI**

Modify `src/app/stores/reviewStore.ts`:

```ts
import { copyAndFocusBossInput } from '@/page/sender'
```

Add action:

```ts
async function copySelectedGreeting(): Promise<void> {
  const job = selectedJob.value
  const greeting = job?.greeting?.greeting
  if (!job || !greeting) return

  const result = await copyAndFocusBossInput(greeting)
  updateSelected({
    status: result.ok ? 'reviewing' : 'failed',
    statusMessage: result.message,
  })
}
```

Return `copySelectedGreeting`.

Modify `src/app/components/JobReview.vue` copy button:

```vue
<button class="brs-icon-button" type="button" aria-label="复制" @click="store.copySelectedGreeting">
  <CopyIcon :size="16" />
</button>
```

- [ ] **Step 5: 运行测试、类型检查并提交**

Run:

```bash
pnpm test tests/page/sender.test.ts
pnpm run typecheck
pnpm run build
```

Expected: all pass.

Commit:

```bash
git add src/page/sender.ts src/app/stores/reviewStore.ts src/app/components/JobReview.vue tests/page/sender.test.ts
git commit -m "feat: add copy focus send fallback"
```

---

### Task 11: 添加设置入口和简历素材配置

**Files:**
- Create: `src/app/components/SettingsPanel.vue`
- Modify: `src/app/App.vue`
- Modify: `src/styles/main.css`

- [ ] **Step 1: 写设置组件**

`src/app/components/SettingsPanel.vue` 内容：

```vue
<template>
  <section class="brs-section" aria-label="设置">
    <details>
      <summary>设置</summary>
      <label class="brs-field">
        <span>简历素材</span>
        <textarea v-model="resume" rows="6" placeholder="粘贴你的简历素材，生成打招呼语时只使用这里的证据。" />
      </label>
      <label class="brs-field">
        <span>最大页数</span>
        <input v-model.number="maxPages" min="1" max="10" type="number" />
      </label>
      <label class="brs-field">
        <span>最大岗位数</span>
        <input v-model.number="maxJobs" min="1" max="150" type="number" />
      </label>
      <button class="brs-button brs-button-secondary" type="button" @click="save">保存设置</button>
    </details>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { ExtensionStorage } from '@/core/storage'

const storage = new ExtensionStorage()
const resume = ref('')
const maxPages = ref(5)
const maxJobs = ref(100)

onMounted(async () => {
  resume.value = await storage.getResumeMaterial()
  const settings = await storage.getSettings()
  maxPages.value = settings.maxPages
  maxJobs.value = settings.maxJobs
})

async function save() {
  await storage.saveResumeMaterial(resume.value)
  await storage.saveSettings({ maxPages: maxPages.value, maxJobs: maxJobs.value })
}
</script>
```

- [ ] **Step 2: 挂载设置组件**

Modify `src/app/App.vue`:

```vue
<template>
  <aside class="brs-shell" aria-label="Boss 人审助手">
    <header class="brs-header">
      <p class="brs-kicker">Boss 人审助手</p>
      <h1>岗位审核队列</h1>
      <p class="brs-subtitle">5 页 · 100 岗 · 人审发送</p>
    </header>
    <ScanControls />
    <StatsBar />
    <main class="brs-main">
      <JobQueue />
      <JobReview />
      <SettingsPanel />
    </main>
  </aside>
</template>

<script setup lang="ts">
import JobQueue from './components/JobQueue.vue'
import JobReview from './components/JobReview.vue'
import ScanControls from './components/ScanControls.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import StatsBar from './components/StatsBar.vue'
</script>
```

- [ ] **Step 3: 添加设置 CSS**

Add to `src/styles/main.css`:

```css
.brs-field {
  display: grid;
  gap: 6px;
  margin: 10px 0;
  color: #334155;
  font-size: 12px;
}

.brs-field textarea,
.brs-field input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #cbded9;
  border-radius: 8px;
  padding: 8px;
  color: #13231f;
  font: inherit;
}
```

- [ ] **Step 4: 运行验证并提交**

Run:

```bash
pnpm test
pnpm run typecheck
pnpm run build
```

Expected: all pass.

Commit:

```bash
git add src/app/components/SettingsPanel.vue src/app/App.vue src/styles/main.css
git commit -m "feat: add resume settings panel"
```

---

### Task 12: 最终构建和手动验证

**Files:**
- Modify: `docs/superpowers/plans/2026-06-03-boss-review-send-extension.md`

- [ ] **Step 1: 运行完整验证**

Run:

```bash
pnpm test
pnpm run typecheck
pnpm run build
```

Expected:

- Vitest passes.
- `vue-tsc` passes.
- WXT Chrome build succeeds.

- [ ] **Step 2: 在 Chrome 加载扩展**

Run:

```bash
pnpm run dev
```

Expected: WXT dev server starts and prints the extension output path.

Manual:

1. Open Chrome Extensions.
2. Enable developer mode.
3. Load the WXT generated extension directory.
4. Open a Boss job-list page while logged in.
5. Confirm the right-side panel mounts.
6. Click `扫描当前页`.
7. Confirm jobs appear in queue.
8. Save resume material in settings.
9. Click `连续扫描` with a low limit such as 2 pages / 10 jobs.
10. Confirm scanning stops at the limit.
11. Click copy on a drafted greeting.
12. Confirm the greeting is copied and the Boss input is focused when a chat input exists.

- [ ] **Step 3: 记录验证结果**

Append a short verification note to this plan:

```markdown
## Verification Result

- `pnpm test`: passed
- `pnpm run typecheck`: passed
- `pnpm run build`: passed
- Manual Boss page smoke test: passed on Boss job-list page
```

If Boss cannot be tested because login or site access is unavailable, append this exact blocked form instead:

```markdown
## Verification Result

- `pnpm test`: passed
- `pnpm run typecheck`: passed
- `pnpm run build`: passed
- Manual Boss page smoke test: blocked because Boss login or site access was unavailable in this environment
```

- [ ] **Step 4: 提交验证记录**

```bash
git add docs/superpowers/plans/2026-06-03-boss-review-send-extension.md
git commit -m "docs: record Boss extension verification"
```

---

## 计划自查

- Spec 覆盖：计划覆盖了 WXT 扩展骨架、页面挂载、当前页抓取、多页扫描、岗位详情/pipeline、简历配置、打招呼语、人审队列、复制并聚焦兜底、同公司/同招聘者去重、本地日志入口、暂停停止基础结构、UI 验收和最终构建验证。
- 风险边界：计划没有实现无人值守自动发送、多账号 cookie 管理、自动回复、验证码绕过或平台限制绕过。发送首版明确为复制并聚焦兜底，不能记录为已发送。
- 待扩展项：直接聊天发送、LLM provider API 调用、Boss Vue runtime 深度 hook 可以在 MVP smoke test 通过后作为后续计划补充。

## Verification Result

- `pnpm test`: passed, 10 test files and 36 tests.
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed, Chrome MV3 output generated under `.output/chrome-mv3`.
- Manual Boss page smoke test: blocked because Boss login or site access was unavailable in this environment.
