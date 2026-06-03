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
