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
