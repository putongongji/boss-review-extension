import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { ExtensionStorage } from '@/core/storage'
import type { CapturedJob, GreetingLogEntry, ReviewJob } from '@/core/types'
import { DomBossAdapter } from '@/page/bossAdapter'

const AUTO_SYNC_DEBOUNCE_MS = 250
const ROOT_ID = 'boss-review-sender-root'

interface SessionGreetingRecord {
  id: string
  job: ReviewJob
  status: '成功' | '失败'
  defaultGreetingContent: string
  customGreetingEnabled: boolean
  customGreetingContent: string
  customGreetingSent: boolean
  customGreetingError?: string
  resultMessage: string
  createdAt: number
}

export const useReviewStore = defineStore('review', () => {
  const storage = new ExtensionStorage()
  const jobs = ref<ReviewJob[]>([])
  const selectedJobId = ref<string>('')
  const scanning = ref(false)
  const greetingText = ref('')
  const customGreetingEnabled = ref(false)
  const syncMessage = ref('等待同步')
  const titleFilter = ref('')
  const locationFilter = ref('')
  const sessionGreetingRecords = ref<SessionGreetingRecord[]>([])
  let observer: MutationObserver | null = null
  let pageClickListener: ((event: MouseEvent) => void) | null = null
  let syncTimer: number | undefined
  let lastSignature = ''

  const selectedJob = computed(() => jobs.value.find((job) => job.jobId === selectedJobId.value))
  const filteredJobs = computed(() =>
    jobs.value.filter((job) => {
      return (
        includesKeyword(job.title, titleFilter.value) &&
        includesKeyword(job.location, locationFilter.value)
      )
    }),
  )
  const stats = computed(() => ({ captured: jobs.value.length }))

  function setJobs(nextJobs: ReviewJob[], preferredJobId?: string): void {
    jobs.value = nextJobs
    selectedJobId.value =
      preferredJobId && nextJobs.some((job) => job.jobId === preferredJobId) ? preferredJobId : nextJobs[0]?.jobId || ''
  }

  async function selectJob(jobId: string): Promise<void> {
    selectedJobId.value = jobId
    await fetchSelectedDetail()
  }

  async function scanCurrentPage(): Promise<void> {
    scanning.value = true
    try {
      const adapter = new DomBossAdapter(document)
      const captured = await adapter.captureCurrentPage()
      const signature = createListSignature(captured)
      if (signature !== lastSignature) {
        lastSignature = signature
        const greetedLogs = await storage.getGreetingLogs()
        setJobs(captured.map((job) => toReviewJob(job, greetedLogs.find((log) => log.job.jobId === job.jobId))), selectedJobId.value)
      }
      syncMessage.value = captured.length > 0 ? `已同步 ${captured.length} 个岗位` : '当前页没有识别到岗位'
    } finally {
      scanning.value = false
    }
  }

  function startAutoSync(): void {
    if (observer) return

    void scanCurrentPage()
    observer = new MutationObserver((records) => {
      if (records.some(isBossPageMutation)) {
        scheduleAutoSync()
      }
    })
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true,
    })
    pageClickListener = (event) => {
      void syncSelectionFromPageClick(event)
    }
    document.addEventListener('click', pageClickListener, true)
  }

  function stopAutoSync(): void {
    observer?.disconnect()
    observer = null
    if (syncTimer != null) {
      window.clearTimeout(syncTimer)
      syncTimer = undefined
    }
    if (pageClickListener) {
      document.removeEventListener('click', pageClickListener, true)
      pageClickListener = null
    }
  }

  function scheduleAutoSync(): void {
    if (syncTimer != null) {
      window.clearTimeout(syncTimer)
    }
    syncTimer = window.setTimeout(() => {
      syncTimer = undefined
      void scanCurrentPage()
    }, AUTO_SYNC_DEBOUNCE_MS)
  }

  function updateSelected(patch: Partial<ReviewJob>): void {
    updateJob(selectedJobId.value, patch)
  }

  function updateJob(jobId: string, patch: Partial<ReviewJob>): void {
    jobs.value = jobs.value.map((job) => (job.jobId === jobId ? { ...job, ...patch } : job))
  }

  async function syncSelectionFromPageClick(event: MouseEvent): Promise<void> {
    if (isInsideAssistant(event.target)) return

    const adapter = new DomBossAdapter(document)
    const jobId = adapter.getJobIdFromElement(event.target)
    if (!jobId || !jobs.value.some((job) => job.jobId === jobId)) return

    selectedJobId.value = jobId
    window.setTimeout(() => {
      void fetchSelectedDetail()
    }, 150)
  }

  async function fetchSelectedDetail(): Promise<void> {
    const job = selectedJob.value
    if (!job) return

    updateJob(job.jobId, { status: 'enriching', statusMessage: '读取详情中' })
    try {
      const adapter = new DomBossAdapter(document)
      const enriched = await adapter.enrichJob(job, { focus: true })
      const enrichedJob = { ...enriched, location: job.location || enriched.location }
      jobs.value = jobs.value.map((item) =>
        item.jobId === job.jobId ? { ...toReviewJob(enrichedJob), status: 'drafted', statusMessage: '已读取 JD' } : item,
      )
    } catch (error) {
      updateJob(job.jobId, {
        status: 'failed',
        statusMessage: error instanceof Error ? error.message : '详情读取失败',
      })
    }
  }

  async function greetSelectedJob(): Promise<void> {
    const job = selectedJob.value
    if (!job) return

    updateJob(job.jobId, { status: 'enriching', statusMessage: '打招呼中' })
    try {
      const adapter = new DomBossAdapter(document)
      const outcome = await adapter.greetJob(job, {
        customMessage: greetingText.value,
        sendCustomMessage: customGreetingEnabled.value,
      })
      const log = createGreetingLog(job, outcome)
      sessionGreetingRecords.value.unshift(createSessionGreetingRecord(job, '成功', {
        defaultGreetingContent: outcome.defaultGreetingContent,
        customGreetingEnabled: outcome.customGreetingEnabled,
        customGreetingContent: outcome.customGreetingContent,
        customGreetingSent: outcome.customGreetingSent,
        customGreetingError: outcome.customGreetingError,
        resultMessage: outcome.resultMessage,
      }))
      await storage.appendGreetingLog(log)
      updateJob(job.jobId, {
        status: 'sent',
        statusMessage: outcome.resultMessage,
        greetedAt: log.createdAt,
        greetingRecordId: log.id,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '打招呼失败'
      sessionGreetingRecords.value.unshift(createSessionGreetingRecord(job, '失败', {
        defaultGreetingContent: '',
        customGreetingEnabled: customGreetingEnabled.value,
        customGreetingContent: greetingText.value,
        customGreetingSent: false,
        customGreetingError: message,
        resultMessage: message,
      }))
      updateJob(job.jobId, {
        status: 'failed',
        statusMessage: message,
      })
    }
  }

  async function loadJobs(): Promise<void> {
    jobs.value = []
    selectedJobId.value = ''
  }

  async function exportGreetingLogs(): Promise<void> {
    const csv = createGreetingCsv(sessionGreetingRecords.value)
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `boss-greeting-records-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function createListSignature(captured: CapturedJob[]): string {
    return captured
      .map((job) =>
        [job.jobId, job.title, job.company, job.salary, job.location, job.workAddress, job.experience, job.degree].join(
          '|',
        ),
      )
      .join('\n')
  }

  function toReviewJob(job: CapturedJob, greetedLog?: GreetingLogEntry): ReviewJob {
    return {
      ...job,
      status: greetedLog ? 'sent' : job.jdText ? 'drafted' : 'captured',
      statusMessage: greetedLog?.resultMessage ?? (job.jdText ? '已读取 JD' : '待读取 JD'),
      capturedAt: Date.now(),
      greetedAt: greetedLog?.createdAt,
      greetingRecordId: greetedLog?.id,
    }
  }

  function createGreetingLog(job: ReviewJob, outcome: Awaited<ReturnType<DomBossAdapter['greetJob']>>): GreetingLogEntry {
    return {
      id: `${job.jobId}-${Date.now()}`,
      job: { ...job },
      defaultGreetingContent: outcome.defaultGreetingContent,
      customGreetingEnabled: outcome.customGreetingEnabled,
      customGreetingContent: outcome.customGreetingContent,
      customGreetingSent: outcome.customGreetingSent,
      customGreetingError: outcome.customGreetingError,
      resultMessage: outcome.resultMessage,
      createdAt: Date.now(),
    }
  }

  function createSessionGreetingRecord(
    job: ReviewJob,
    status: SessionGreetingRecord['status'],
    data: Omit<SessionGreetingRecord, 'id' | 'job' | 'status' | 'createdAt'>,
  ): SessionGreetingRecord {
    return {
      id: `${job.jobId}-${Date.now()}`,
      job: { ...job },
      status,
      ...data,
      createdAt: Date.now(),
    }
  }

  function createGreetingCsv(records: SessionGreetingRecord[]): string {
    const headers = [
      '时间',
      '状态',
      '结果',
      '岗位ID',
      '岗位名称',
      '公司',
      '薪资',
      '地点',
      '经验',
      '学历',
      '默认打招呼',
      '自定义开关',
      '自定义内容',
      '自定义发送状态',
      '自定义错误',
    ]
    const rows = records.map((record) => [
      new Date(record.createdAt).toISOString(),
      record.status,
      record.resultMessage,
      record.job.jobId,
      record.job.title,
      record.job.company,
      record.job.salary || '',
      record.job.location || '',
      record.job.experience || '',
      record.job.degree || '',
      record.defaultGreetingContent,
      record.customGreetingEnabled ? '开启' : '关闭',
      record.customGreetingContent,
      record.customGreetingSent ? '已发送' : '未发送',
      record.customGreetingError || '',
    ])

    return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n')
  }

  function escapeCsvCell(value: string): string {
    return `"${value.replace(/"/g, '""')}"`
  }

  function isBossPageMutation(record: MutationRecord): boolean {
    return !isInsideAssistant(record.target)
  }

  function isInsideAssistant(target: EventTarget | null): boolean {
    return target instanceof Element && Boolean(target.closest(`#${ROOT_ID}`))
  }

  function includesKeyword(value: string | undefined, keyword: string): boolean {
    const normalizedKeyword = normalizeFilterText(keyword)
    if (!normalizedKeyword) return true
    return normalizeFilterText(value ?? '').includes(normalizedKeyword)
  }

  function normalizeFilterText(value: string): string {
    return value.toLowerCase().replace(/[·\s,，/｜|-]+/g, '')
  }

  return {
    jobs,
    filteredJobs,
    selectedJobId,
    selectedJob,
    scanning,
    greetingText,
    customGreetingEnabled,
    sessionGreetingRecords,
    syncMessage,
    titleFilter,
    locationFilter,
    stats,
    setJobs,
    selectJob,
    fetchSelectedDetail,
    greetSelectedJob,
    exportGreetingLogs,
    loadJobs,
    scanCurrentPage,
    startAutoSync,
    stopAutoSync,
    updateSelected,
  }
})
