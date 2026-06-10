import { buildGreetingPrompt, normalizeGreetingResult, validateGreetingResult } from './greeting'
import type { CapturedJob, GreetingResult, Settings } from './types'

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
            content: '你是严谨的打招呼语助手。只输出 JSON，不编造事实。',
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

  const parsed = JSON.parse(content) as { greeting?: string }
  const greeting = parsed?.greeting
  if (!greeting || greeting.length < 10) {
    throw new Error('生成的招呼语不符合要求')
  }

  return {
    score: 0,
    scoreLabel: 'medium',
    jdSummary: '',
    matchedEvidence: [],
    risks: [],
    greeting,
    rationale: '',
  }
}
