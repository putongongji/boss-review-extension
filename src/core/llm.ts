import { buildGreetingPrompt } from './greeting'
import type { CapturedJob, GreetingAnalysis, GreetingResult, Settings } from './types'

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

export async function testLlmConnection(settings: Settings): Promise<void> {
  if (!settings.llmApiKey) {
    throw new Error('请先填写 DeepSeek API Key')
  }

  const endpoint = `${settings.llmBaseUrl.replace(/\/$/, '')}/chat/completions`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.llmApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.llmModel,
      temperature: 0,
      max_tokens: 8,
      messages: [{ role: 'user', content: '回复 ok' }],
    }),
  })

  if (!response.ok) {
    throw new Error(`DeepSeek 测试失败：${response.status}`)
  }
}

export async function generateLlmGreeting(
  job: CapturedJob,
  resumeMaterial: string,
  settings: Settings,
): Promise<GreetingResult | null> {
  if (!settings.llmApiKey || !settings.llmModel) return null

  const endpoint = `${settings.llmBaseUrl.replace(/\/$/, '')}/chat/completions`
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), 30000)
  let response: Response

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${settings.llmApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.llmModel,
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: '你是严谨的打招呼语助手。只输出 JSON，不编造事实。严格遵循用户指定的 JSON 格式。',
          },
          {
            role: 'user',
            content: buildGreetingPrompt(job, resumeMaterial),
          },
        ],
      }),
    })
  } finally {
    globalThis.clearTimeout(timeout)
  }

  if (!response.ok) {
    throw new Error(`大模型请求失败：${response.status}`)
  }

  const data = (await response.json()) as ChatCompletionResponse
  const content = data.choices?.[0]?.message?.content
  if (!content) return null

  // Parse flexible format — accept both simple greeting and full analysis
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(content) as Record<string, unknown>
  } catch {
    throw new Error('大模型返回了非 JSON 格式')
  }

  const greeting = String(parsed.greeting ?? '')
  if (!greeting || greeting.length < 10) {
    throw new Error('生成的招呼语不符合要求')
  }

  // Store the full analysis on the GreetingResult for richer UI display
  const analysis: GreetingAnalysis = {
    greeting,
    preview20: String(parsed.preview20 ?? greeting.slice(0, 20)),
    why: Array.isArray(parsed.why) ? parsed.why.map(String) : [],
    alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives.map(String) : [],
  }

  return {
    score: 0,
    scoreLabel: 'medium' as const,
    jdSummary: '',
    matchedEvidence: [],
    risks: [],
    greeting,
    rationale: '',
    ...analysis,
  } as GreetingResult & GreetingAnalysis
}
