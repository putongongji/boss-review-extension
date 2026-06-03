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
