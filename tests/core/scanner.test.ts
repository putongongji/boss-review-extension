import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS } from '@/core/defaults'
import { ScanController } from '@/core/scanner'
import type { BossPageAdapter } from '@/page/bossAdapter'

describe('ScanController', () => {
  it('stops at configured max pages', async () => {
    const adapter = createFakeAdapter(10)
    const controller = new ScanController(adapter, createTestSettings({ maxPages: 2, maxJobs: 20 }))

    const jobs = await controller.scan()

    expect(jobs.map((job) => job.jobId)).toEqual(['job-page-1', 'job-page-2'])
  })

  it('stops at configured max jobs', async () => {
    const adapter = createFakeAdapter(10)
    const controller = new ScanController(adapter, createTestSettings({ maxPages: 10, maxJobs: 1 }))

    const jobs = await controller.scan()

    expect(jobs).toHaveLength(1)
  })

  it('stops promptly when stopped during page scan', async () => {
    let controller: ScanController
    const enrichedJobIds: string[] = []
    let goNextCalls = 0
    const adapter: BossPageAdapter = {
      async captureCurrentPage() {
        return [
          {
            jobId: 'job-1',
            title: 'AI 产品经理',
            company: '示例科技',
            skills: [],
            welfare: [],
            sourceUrl: 'https://www.zhipin.com',
          },
          {
            jobId: 'job-2',
            title: 'AI 产品经理',
            company: '示例科技',
            skills: [],
            welfare: [],
            sourceUrl: 'https://www.zhipin.com',
          },
        ]
      },
      async enrichJob(job) {
        enrichedJobIds.push(job.jobId)
        controller.stop()
        return job
      },
      hasNextPage() {
        return true
      },
      async goNextPage() {
        goNextCalls += 1
        return true
      },
    }
    controller = new ScanController(
      adapter,
      createTestSettings({
        maxPages: 10,
        maxJobs: 20,
      }),
    )

    const jobs = await controller.scan()

    expect(jobs.map((job) => job.jobId)).toEqual(['job-1'])
    expect(enrichedJobIds).toEqual(['job-1'])
    expect(goNextCalls).toBe(0)
  })

  it('captures the next page after async page navigation resolves', async () => {
    let visiblePage = 1
    const adapter: BossPageAdapter = {
      async captureCurrentPage() {
        return [
          {
            jobId: `job-page-${visiblePage}`,
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
        return visiblePage < 2
      },
      async goNextPage() {
        await new Promise((resolve) => setTimeout(resolve, 1))
        visiblePage = 2
        return true
      },
    }
    const controller = new ScanController(adapter, createTestSettings({ maxPages: 2, maxJobs: 20 }))

    const jobs = await controller.scan()

    expect(jobs.map((job) => job.jobId)).toEqual(['job-page-1', 'job-page-2'])
  })
})

function createTestSettings(overrides: Partial<typeof DEFAULT_SETTINGS>) {
  return {
    ...DEFAULT_SETTINGS,
    pageDelayMinMs: 0,
    pageDelayMaxMs: 0,
    detailDelayMinMs: 0,
    detailDelayMaxMs: 0,
    ...overrides,
  }
}

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
