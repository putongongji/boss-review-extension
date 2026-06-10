import type { CapturedJob, GreetingResult, ScoreLabel } from './types'
import { compactText, includesAny, trimToLength } from '@/utils/text'

const RISK_KEYWORDS = ['外包', '销售', '电销', '驻场']
const STRONG_MATCH_KEYWORDS = ['AI', '智能体', 'ToB', 'SaaS', '增长', '数据分析', '需求分析']
const UNSUPPORTED_CLAIMS = ['前字节', '百人团队', '负责人', '千万级', '上市公司']
const JD_CAPABILITY_PHRASES = ['AI产品规划', 'AI 应用产品规划', '需求拆解', '跨团队推进', '数据分析']

export function buildGreetingPrompt(job: CapturedJob, resumeMaterial: string): string {
  return `你是一名懂招聘转化、HR 初筛心理和求职平台消息展示机制的职业文案顾问。

我要写一条发给 HR / HRBP / 猎头 / 业务负责人的求职打招呼语，用在 BOSS 直聘、猎聘、脉脉、LinkedIn 等平台。

请注意：这不是完整自我介绍，而是招聘列表里的第一句话。很多平台只会显示前 10–30 个字，所以开头必须有"点开理由"。

请根据我提供的【岗位信息】和【我的背景】，帮我生成打招呼语。

## 目标

1. 打招呼语必须以"你好"开头，紧跟钩子内容。不要用"您好"。
2. 前 20 个字要有钩子，让对方愿意点开。
3. 整句话控制在 60–90 字左右。
4. 不要用"您好，我对贵司岗位很感兴趣"这种废话开头。
5. 不要夸大我的身份。
6. 如果我是转向某类岗位，不要直接暴露"我想转型"。
7. 用具体经历和业务场景替代抽象能力。
8. 语气要自然、专业、像真人发出的消息，不要像简历摘要。

## 写法原则

开头优先使用这种结构：

【岗位相关钩子】+【我的真实背景】+【2 个最相关证据】+【轻沟通意愿】

其中：

* 岗位相关钩子 = 我的优势和岗位需求的交集
* 真实背景 = 不夸大的主线经验
* 证据 = 做过的系统、业务场景、项目、结果
* 轻沟通意愿 = 想沟通岗位匹配度 / 希望进一步交流

## 特别注意

如果我投的是 AI 产品经理，但我的主线经验不是多年 AI 产品，而是 ToB / B 端 / 复杂业务系统，同时有 AI 落地经验，不要开头写：

"AI 产品经理｜……"

更适合写：

"ToB复杂流程+大模型应用"
"复杂业务系统+AI落地经验"
"企业流程系统+大模型应用"
"工单/设备/ERP+大模型应用"

原则是：

不说"我要转什么岗位"，只说"我已经做过哪些岗位相关的事"。

## 避免写法

不要写：

* 您好，我对贵司岗位很感兴趣
* 我有 X 年产品经理经验
* 我是资深 AI 产品经理
* 熟悉 Agent、RAG、Prompt、Dify、Coze、LangChain
* 有较强的业务理解能力、沟通能力和项目推进能力

除非这些后面有具体证据支撑。

## 输出格式

只输出 JSON，不要多余文字。JSON 字段如下：

{
  "greeting": "最建议使用的打招呼语全文",
  "preview20": "前 20 个字预览",
  "why": ["钩子是什么", "为什么能吸引点开", "哪些地方避免了夸大", "和岗位需求如何匹配"],
  "alternatives": ["备选钩子1", "备选钩子2", "备选钩子3"]
}

## 岗位信息

岗位名：${job.title}
公司：${job.company}
薪资：${job.salary ?? ''}
地点：${job.location ?? ''}
经验：${job.experience ?? ''}
学历：${job.degree ?? ''}
技能：${toStringArray(job.skills).join('、')}
JD：${job.jdText ?? ''}

## 我的背景

${resumeMaterial}
`
}

export function createRuleBasedGreeting(job: CapturedJob, resumeMaterial: string): GreetingResult {
  const skills = toStringArray(job.skills)
  const resume = compactText(resumeMaterial)
  const jd = compactText(`${job.title} ${skills.join(' ')} ${job.jdText ?? ''}`)
  const evidence = selectEvidence(resume, jd)
  const risks = detectRisks(job)
  const score = calculateScore(evidence, risks)
  const scoreLabel = toScoreLabel(score)
  const hook = evidence[0]
  const roleSignal = selectRoleSignal(job, jd, evidence)
  const greeting =
    evidence.length > 0
      ? trimToLength(
          `你好，${hook}。我关注到${job.title || '这个岗位'}需要${roleSignal}，过往经历和要求较匹配，已附简历供参考，想进一步沟通。`,
          150,
        )
      : trimToLength(
          `你好，我关注到${job.title || '这个岗位'}岗位，职责聚焦${roleSignal}。已附上简历，若背景方向合适，想进一步了解团队当前重点。`,
          150,
        )

  return {
    score,
    scoreLabel,
    jdSummary: summarizeJd(job),
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
  const normalizedResult = normalizeGreetingResult(result)
  if (normalizedResult.greeting.length > 150) return { ok: false, reason: '招呼语超过 150 字符' }

  const allowedText = compactText(
    `${resumeMaterial} ${job.title} ${job.company} ${job.jdText ?? ''} ${toStringArray(job.skills).join(' ')}`,
  )
  const generatedText = compactText(
    `${normalizedResult.greeting} ${normalizedResult.jdSummary} ${normalizedResult.matchedEvidence.join(' ')} ${normalizedResult.risks.join(' ')} ${normalizedResult.rationale}`,
  )
  const unsupported = UNSUPPORTED_CLAIMS.find((claim) => generatedText.includes(claim) && !allowedText.includes(claim))
  if (unsupported) return { ok: false, reason: `包含未提供证据：${unsupported}` }
  if (!normalizedResult.greeting.startsWith('你好')) return { ok: false, reason: '缺少简短问候' }

  return { ok: true, reason: 'ok' }
}

export function normalizeGreetingResult(result: GreetingResult): GreetingResult {
  return {
    ...result,
    matchedEvidence: toStringArray(result.matchedEvidence),
    risks: toStringArray(result.risks),
  }
}

function selectEvidence(resume: string, jd: string): string[] {
  const candidates = resume
    .split(/[。；;\n]/)
    .map(compactText)
    .filter(Boolean)

  const jdTerms = extractTerms(jd)
  const matched = candidates.filter((line) => hasOverlap(line, jdTerms))

  return matched.slice(0, 2)
}

function detectRisks(job: CapturedJob): string[] {
  const text = `${job.title} ${job.company} ${job.jdText ?? ''}`
  return RISK_KEYWORDS.filter((keyword) => includesAny(text, [keyword])).map((keyword) => `可能包含${keyword}`)
}

function calculateScore(evidence: string[], risks: string[]): number {
  if (evidence.length === 0) return Math.max(30, 45 - risks.length * 10)
  return Math.max(30, Math.min(95, 55 + evidence.length * 15 - risks.length * 10))
}

function toScoreLabel(score: number): ScoreLabel {
  if (score >= 80) return 'high'
  if (score >= 60) return 'medium'
  return 'low'
}

function selectRoleSignal(job: CapturedJob, jd: string, evidence: string[]): string {
  const evidenceText = evidence.join(' ')
  const skillSignal = toStringArray(job.skills).filter((skill) => hasOverlap(evidenceText, [skill])).slice(0, 2).join('、')
  if (skillSignal) return skillSignal

  const jdSignal = JD_CAPABILITY_PHRASES.filter((phrase) => jd.includes(phrase)).slice(0, 2).join('、')
  if (jdSignal) return jdSignal

  const terms = extractTerms(jd).filter((term) => !['职位描述', '岗位职责', '任职要求'].includes(term)).slice(0, 2)
  if (terms.length > 0) return terms.join('、')

  return job.title || '岗位核心要求'
}

function hasOverlap(text: string, terms: string[]): boolean {
  const compactedText = compactText(text).toLowerCase().replace(/\s+/g, '')
  return terms.some((term) => compactedText.includes(term.toLowerCase().replace(/\s+/g, '')))
}

function extractTerms(text: string): string[] {
  const compactedText = compactText(text)
  const knownTerms = [...STRONG_MATCH_KEYWORDS, ...JD_CAPABILITY_PHRASES].filter((keyword) =>
    hasOverlap(compactedText, [keyword]),
  )
  const literalTerms = compactedText
    .split(/[，。；、,.;:\s/()（）+-]+/)
    .map(compactText)
    .filter((term) => term.length >= 2 && !/^(负责|岗位|要求|经验|学历|公司|地点|薪资)$/.test(term))

  return Array.from(new Set([...knownTerms, ...literalTerms]))
}

function summarizeJd(job: CapturedJob): string {
  const jd = compactText(job.jdText)
    .replace(/^(职位描述|岗位描述|岗位职责|岗位定位|任职要求)[:：]?\s*/g, '')
    .replace(/\s*(职位描述|岗位描述|岗位职责|岗位定位|任职要求)[:：]?\s*/g, ' ')

  if (!jd) return `${job.title || '岗位'}，暂无完整 JD。`
  return trimToLength(`${job.title || '岗位'}：${jd}`, 160)
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}
