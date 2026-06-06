import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useReviewStore } from '@/app/stores/reviewStore'
import type { ReviewJob } from '@/core/types'

const mocks = vi.hoisted(() => ({
  captureCurrentPage: vi.fn(),
  enrichJob: vi.fn(),
  greetJob: vi.fn(),
  DomBossAdapter: vi.fn(),
}))

vi.mock('@/page/bossAdapter', () => ({
  DomBossAdapter: mocks.DomBossAdapter,
}))

describe('reviewStore', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    mocks.DomBossAdapter.mockImplementation(() => ({
      captureCurrentPage: mocks.captureCurrentPage,
      enrichJob: mocks.enrichJob,
      greetJob: mocks.greetJob,
    }))
    mocks.enrichJob.mockImplementation(async (job) => ({ ...job, jdText: '补全后的 JD' }))
    mocks.greetJob.mockResolvedValue(createGreetOutcome('已后台打招呼，使用 Boss 默认招呼语'))
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('adds captured jobs and selects first job', () => {
    const store = useReviewStore()
    const job = createReviewJob('job-1')

    store.setJobs([job])

    expect(store.jobs).toHaveLength(1)
    expect(store.selectedJob?.jobId).toBe('job-1')
  })

  it('scans current page jobs without detail enrichment or drafting pipeline', async () => {
    const store = useReviewStore()
    const captured = createCapturedJob('job-1')
    store.setJobs([createReviewJob('old-job')])
    mocks.captureCurrentPage.mockResolvedValue([captured])

    await store.scanCurrentPage()

    expect(mocks.DomBossAdapter).toHaveBeenCalledWith(document)
    expect(mocks.captureCurrentPage).toHaveBeenCalledOnce()
    expect(mocks.enrichJob).not.toHaveBeenCalled()
    expect(store.jobs).toHaveLength(1)
    expect(store.jobs[0]).toMatchObject({
      jobId: 'job-1',
      status: 'captured',
      statusMessage: '待读取 JD',
      salary: '25-35K',
      location: '杭州 西湖区',
      experience: '5-10年',
      degree: '本科',
    })
    expect(store.scanning).toBe(false)
  })

  it('enriches the selected queue job with JD', async () => {
    const store = useReviewStore()
    const job = createReviewJob('job-2')
    store.setJobs([createReviewJob('job-1'), job])
    mocks.enrichJob.mockResolvedValue({ ...job, jdText: '当前右侧详情 JD' })

    await store.selectJob('job-2')

    expect(store.selectedJobId).toBe('job-2')
    expect(mocks.enrichJob).toHaveBeenCalledWith(job, { focus: true })
    expect(store.selectedJob?.jdText).toBe('当前右侧详情 JD')
    expect(store.selectedJob?.statusMessage).toBe('已读取 JD')
  })

  it('keeps the list location after detail enrichment returns city only', async () => {
    const store = useReviewStore()
    const job = { ...createReviewJob('job-2'), location: '杭州 西湖区 转塘' }
    store.setJobs([job])
    mocks.enrichJob.mockResolvedValue({ ...job, location: '杭州', jdText: '当前右侧详情 JD' })

    await store.selectJob('job-2')

    expect(store.selectedJob?.location).toBe('杭州 西湖区 转塘')
    expect(store.filteredJobs[0].location).toBe('杭州 西湖区 转塘')
  })

  it('keeps the current queue when rescanning unchanged list', async () => {
    const store = useReviewStore()
    const captured = createCapturedJob('job-1')
    mocks.captureCurrentPage.mockResolvedValue([captured])

    await store.scanCurrentPage()
    store.updateSelected({ jdText: '已读取过的 JD', statusMessage: '已读取 JD' })
    await store.scanCurrentPage()

    expect(store.jobs[0].jdText).toBe('已读取过的 JD')
  })

  it('filters jobs by title and list location keywords', () => {
    const store = useReviewStore()
    store.setJobs([
      createReviewJob('job-1'),
      { ...createReviewJob('job-2'), title: '增长产品经理', location: '上海', workAddress: '浦东新区' },
    ])

    store.titleFilter = 'AI'
    store.locationFilter = '杭州西湖'

    expect(store.filteredJobs.map((job) => job.jobId)).toEqual(['job-1'])
  })

  it('greets selected job with optional custom message', async () => {
    const store = useReviewStore()
    const job = createReviewJob('job-1')
    store.setJobs([job])
    store.greetingText = '你好，想了解这个岗位。'
    store.customGreetingEnabled = true
    mocks.greetJob.mockResolvedValue(createGreetOutcome('已后台打招呼，并已发送自定义内容', true))

    await store.greetSelectedJob()

    expect(mocks.greetJob).toHaveBeenCalledWith(job, {
      customMessage: '你好，想了解这个岗位。',
      sendCustomMessage: true,
    })
    expect(store.selectedJob?.status).toBe('sent')
    expect(store.selectedJob?.statusMessage).toBe('已后台打招呼，并已发送自定义内容')
  })

  it('keeps greeting result on the job that started the request after selection changes', async () => {
    const store = useReviewStore()
    let resolveGreeting: (value: ReturnType<typeof createGreetOutcome>) => void = () => {}
    const greetingPromise = new Promise<ReturnType<typeof createGreetOutcome>>((resolve) => {
      resolveGreeting = resolve
    })
    mocks.greetJob.mockReturnValue(greetingPromise)
    store.setJobs([createReviewJob('job-1'), createReviewJob('job-2')])

    const task = store.greetSelectedJob()
    await Promise.resolve()
    await store.selectJob('job-2')
    resolveGreeting(createGreetOutcome('A 岗位打招呼成功'))
    await task

    const firstJob = store.jobs.find((job) => job.jobId === 'job-1')
    const secondJob = store.jobs.find((job) => job.jobId === 'job-2')
    expect(firstJob?.status).toBe('sent')
    expect(firstJob?.statusMessage).toBe('A 岗位打招呼成功')
    expect(secondJob?.status).not.toBe('sent')
    expect(secondJob?.statusMessage).toBe('已读取 JD')
  })

  it('exports only current session greeting records as csv', async () => {
    const store = useReviewStore()
    class TestBlob {
      readonly type: string

      constructor(
        private readonly parts: string[],
        options: { type: string },
      ) {
        this.type = options.type
      }

      async text() {
        return this.parts.join('')
      }
    }
    const exportedBlob = { current: null as TestBlob | null }
    const createObjectURL = vi.fn((blob: TestBlob) => {
      exportedBlob.current = blob
      return 'blob:boss-greeting-records'
    })
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('Blob', TestBlob)
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    store.setJobs([createReviewJob('job-1')])
    mocks.greetJob.mockResolvedValue(createGreetOutcome('已后台打招呼，并已发送自定义内容', true))

    await store.greetSelectedJob()
    await store.exportGreetingLogs()

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:boss-greeting-records')
    expect(exportedBlob.current?.type).toBe('text/csv;charset=utf-8')
    const csv = await exportedBlob.current?.text()
    expect(csv).toContain('"时间","状态"')
    expect(csv).toContain('打招呼')
    expect(csv).toContain('AI 产品经理')
    expect(csv).toContain('已后台打招呼，并已发送自定义内容')
  })
})

function createGreetOutcome(resultMessage: string, customGreetingSent = false) {
  return {
    defaultGreetingSent: true,
    defaultGreetingContent: 'Boss 默认招呼语',
    customGreetingEnabled: customGreetingSent,
    customGreetingContent: customGreetingSent ? '你好，想了解这个岗位。' : '',
    customGreetingSent,
    resultMessage,
  }
}

function createCapturedJob(jobId: string) {
  return {
    jobId,
    title: 'AI 产品经理',
    company: '示例科技',
    salary: '25-35K',
    location: '杭州 西湖区',
    workAddress: '杭州西湖区',
    experience: '5-10年',
    degree: '本科',
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
    salary: '25-35K',
    location: '杭州 西湖区',
    workAddress: '杭州西湖区',
    experience: '5-10年',
    degree: '本科',
    skills: [],
    welfare: [],
    sourceUrl: 'https://www.zhipin.com',
    status: 'captured',
    statusMessage: '待读取 JD',
    capturedAt: Date.now(),
  }
}
