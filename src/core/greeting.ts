import type { CapturedJob, GreetingResult, ScoreLabel } from './types'
import { compactText, includesAny, trimToLength } from '@/utils/text'

const RISK_KEYWORDS = ['外包', '销售', '电销', '驻场']
const STRONG_MATCH_KEYWORDS = ['AI', '智能体', 'ToB', 'SaaS', '增长', '数据分析', '需求分析']
const UNSUPPORTED_CLAIMS = ['前字节', '百人团队', '负责人', '千万级', '上市公司']
const JD_CAPABILITY_PHRASES = ['AI产品规划', 'AI 应用产品规划', '需求拆解', '跨团队推进', '数据分析']

export function buildGreetingPrompt(job: CapturedJob, _resumeMaterial?: string): string {
  return `你是一个 Boss 直聘打招呼语助手。根据岗位 JD 生成一段打招呼语，让求职者发送给招聘方。

## 输出要求
- JSON 格式：{ "greeting": "..." }
- 只输出 JSON，不要多余文字。

## 打招呼语要求（严格遵循）
1. 开头 20 个字内制造钩子，让招聘方愿意点开。
2. 第二句证明你和岗位相关（基于 JD 技能/经验），但不要具体写过去公司/项目。
3. 不夸大身份，不编造经历。
4. 控制在 60–90 字之间。
5. 用中文，语气自然，不要模板感。

## 岗位信息
岗位名：${job.title}
公司：${job.company}
薪资：${job.salary ?? ''}
地点：${job.location ?? ''}
经验：${job.experience ?? ''}
学历：${job.degree ?? ''}
技能：${toStringArray(job.skills).join('、')}
JD：${job.jdText ?? ''}
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
