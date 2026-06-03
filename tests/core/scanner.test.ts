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
      return true
    },
  }
}
