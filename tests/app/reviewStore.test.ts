import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useReviewStore } from '@/app/stores/reviewStore'
import { DEFAULT_SETTINGS } from '@/core/defaults'
import type { ReviewJob } from '@/core/types'

const mocks = vi.hoisted(() => ({
  captureCurrentPage: vi.fn(),
  scan: vi.fn(),
  getSettings: vi.fn(),
  getResumeMaterial: vi.fn(),
  runJobPipeline: vi.fn(),
  DomBossAdapter: vi.fn(),
  ScanController: vi.fn(),
  ExtensionStorage: vi.fn(),
}))

vi.mock('@/page/bossAdapter', () => ({
  DomBossAdapter: mocks.DomBossAdapter,
}))

vi.mock('@/core/scanner', () => ({
  ScanController: mocks.ScanController,
}))

vi.mock('@/core/storage', () => ({
  ExtensionStorage: mocks.ExtensionStorage,
}))

vi.mock('@/core/pipeline', () => ({
  runJobPipeline: mocks.runJobPipeline,
}))

describe('reviewStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.DomBossAdapter.mockImplementation(() => ({
      captureCurrentPage: mocks.captureCurrentPage,
    }))
    mocks.ScanController.mockImplementation(() => ({
      scan: mocks.scan,
    }))
    mocks.ExtensionStorage.mockImplementation(() => ({
      getSettings: mocks.getSettings,
      getResumeMaterial: mocks.getResumeMaterial,
      hasCompanyReviewed: vi.fn().mockResolvedValue(false),
      hasRecruiterReviewed: vi.fn().mockResolvedValue(false),
    }))
    mocks.getSettings.mockResolvedValue(DEFAULT_SETTINGS)
    mocks.getResumeMaterial.mockResolvedValue('6年 AI 产品经验')
    mocks.runJobPipeline.mockImplementation(async ({ job }) => createReviewJob(job.jobId))
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

  it('scans the current page through the drafting pipeline', async () => {
    const store = useReviewStore()
    const captured = createCapturedJob('job-1')
    mocks.captureCurrentPage.mockResolvedValue([captured])

    await store.scanCurrentPage()

    expect(mocks.DomBossAdapter).toHaveBeenCalledWith(document)
    expect(mocks.captureCurrentPage).toHaveBeenCalledOnce()
    expect(mocks.runJobPipeline).toHaveBeenCalledWith({
      job: captured,
      resumeMaterial: '6年 AI 产品经验',
      settings: DEFAULT_SETTINGS,
      storage: expect.any(Object),
    })
    expect(store.jobs).toHaveLength(1)
    expect(store.jobs[0].jobId).toBe('job-1')
    expect(store.scanning).toBe(false)
  })

  it('scans multiple pages through ScanController and drafts captured jobs', async () => {
    const store = useReviewStore()
    const captured = createCapturedJob('job-2')
    mocks.scan.mockResolvedValue([captured])

    await store.scanPages()

    expect(mocks.ScanController).toHaveBeenCalledWith(expect.any(Object), DEFAULT_SETTINGS)
    expect(mocks.scan).toHaveBeenCalledOnce()
    expect(mocks.runJobPipeline).toHaveBeenCalledWith({
      job: captured,
      resumeMaterial: '6年 AI 产品经验',
      settings: DEFAULT_SETTINGS,
      storage: expect.any(Object),
    })
    expect(store.jobs[0].jobId).toBe('job-2')
    expect(store.scanning).toBe(false)
  })
})

function createCapturedJob(jobId: string) {
  return {
    jobId,
    title: 'AI 产品经理',
    company: '示例科技',
    skills: [],
    welfare: [],
    sourceUrl: 'https://www.zhipin.com',
  }
}

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
