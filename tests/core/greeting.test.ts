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
  it('builds a prompt with resume, JD details and formatting rules', () => {
    const prompt = buildGreetingPrompt(job, '6年AI产品经验，做过智能体和ToB产品。')

    expect(prompt).toContain('6年AI产品经验')
    expect(prompt).toContain('AI 产品经理')
    expect(prompt).toContain('负责 AI 应用产品规划')
    expect(prompt).toContain('前 20 个字要有钩子')
    expect(prompt).toContain('60–90')
    expect(prompt).toContain('我的背景')
    expect(prompt).toContain('以"你好"开头')
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

  it('keeps unrelated resume material out of matched evidence and greeting', () => {
    const result = createRuleBasedGreeting(job, '5年餐饮门店运营经验，熟悉排班和库存管理。')

    expect(result.matchedEvidence).toEqual([])
    expect(result.scoreLabel).toBe('low')
    expect(result.greeting).toContain('职责聚焦')
    expect(result.greeting).not.toContain('匹配证据有限')
    expect(result.greeting).not.toContain('餐饮门店运营')
    expect(result.greeting).not.toContain('排班')
    expect(result.greeting).not.toContain('库存管理')
  })

  it('summarizes JD without noisy section prefixes', () => {
    const result = createRuleBasedGreeting(
      { ...job, jdText: '岗位定位 你将负责用户画像与标签体系。岗位职责 设计风控规则后台。任职要求 5年以上产品经验。' },
      '5年餐饮门店运营经验。',
    )

    expect(result.jdSummary).toContain('用户画像与标签体系')
    expect(result.jdSummary).not.toContain('岗位定位')
    expect(result.jdSummary).not.toContain('岗位职责')
  })

  it('rejects unsupported claims outside the greeting text', () => {
    const result = createRuleBasedGreeting(job, '6年AI产品经验，做过智能体和ToB产品。')
    const invalidEvidence = { ...result, matchedEvidence: ['前字节AI负责人'] }
    const invalidRationale = { ...result, rationale: '曾管理过百人团队，所以匹配度高。' }

    expect(validateGreetingResult(invalidEvidence, job, '6年AI产品经验，做过智能体和ToB产品。').ok).toBe(false)
    expect(validateGreetingResult(invalidRationale, job, '6年AI产品经验，做过智能体和ToB产品。').ok).toBe(false)
  })

  it('avoids specific unsupported capability phrases without JD or resume overlap', () => {
    const genericJob: CapturedJob = {
      ...job,
      jobId: 'job-2',
      title: '运营专员',
      skills: [],
      jdText: '',
      sourceUrl: 'https://www.zhipin.com/job_detail/job-2.html',
    }
    const result = createRuleBasedGreeting(genericJob, '6年AI产品经验，做过智能体和ToB产品。')

    expect(result.matchedEvidence).toEqual([])
    expect(result.greeting).not.toContain('AI产品规划')
    expect(result.greeting).not.toContain('需求拆解')
    expect(result.greeting).not.toContain('跨团队推进')
  })
})
