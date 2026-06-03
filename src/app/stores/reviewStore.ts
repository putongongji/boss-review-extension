import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { DEFAULT_SETTINGS } from '@/core/defaults'
import { runJobPipeline } from '@/core/pipeline'
import { ScanController } from '@/core/scanner'
import { ExtensionStorage } from '@/core/storage'
import type { CapturedJob, ReviewJob } from '@/core/types'
import { DomBossAdapter } from '@/page/bossAdapter'

export const useReviewStore = defineStore('review', () => {
  const storage = new ExtensionStorage()
  const jobs = ref<ReviewJob[]>([])
  const selectedJobId = ref<string>('')
  const scanning = ref(false)
  const paused = ref(false)

  const selectedJob = computed(() => jobs.value.find((job) => job.jobId === selectedJobId.value))
  const stats = computed(() => ({
    captured: jobs.value.length,
    high: jobs.value.filter((job) => job.greeting?.scoreLabel === 'high').length,
    review: jobs.value.filter((job) => ['drafted', 'reviewing'].includes(job.status)).length,
    sent: jobs.value.filter((job) => job.status === 'sent').length,
    skipped: jobs.value.filter((job) => job.status === 'skipped').length,
  }))

  function setJobs(nextJobs: ReviewJob[]): void {
    jobs.value = nextJobs
    selectedJobId.value = nextJobs[0]?.jobId ?? ''
  }

  function selectJob(jobId: string): void {
    selectedJobId.value = jobId
  }

  function skipSelected(): void {
    updateSelected({ status: 'skipped', statusMessage: '已跳过' })
  }

  function markSelectedSent(): void {
    updateSelected({ status: 'sent', statusMessage: '已发送' })
  }

  async function scanCurrentPage(): Promise<void> {
    scanning.value = true
    try {
      const { settings, resumeMaterial } = await getScanInputs()
      const adapter = new DomBossAdapter(document)
      const captured = await adapter.captureCurrentPage()
      const drafted = await draftJobs(captured, settings, resumeMaterial)
      setJobs(drafted)
    } finally {
      scanning.value = false
    }
  }

  async function scanPages(): Promise<void> {
    scanning.value = true
    try {
      const { settings, resumeMaterial } = await getScanInputs()
      const adapter = new DomBossAdapter(document)
      const controller = new ScanController(adapter, settings)
      const captured = await controller.scan()
      const drafted = await draftJobs(captured, settings, resumeMaterial)
      setJobs(drafted)
    } finally {
      scanning.value = false
    }
  }

  function updateSelected(patch: Partial<ReviewJob>): void {
    jobs.value = jobs.value.map((job) => (job.jobId === selectedJobId.value ? { ...job, ...patch } : job))
  }

  async function getScanInputs() {
    const [storedSettings, resumeMaterial] = await Promise.all([storage.getSettings(), storage.getResumeMaterial()])
    return {
      settings: { ...DEFAULT_SETTINGS, ...storedSettings },
      resumeMaterial,
    }
  }

  async function draftJobs(captured: CapturedJob[], settings: typeof DEFAULT_SETTINGS, resumeMaterial: string) {
    return Promise.all(
      captured.map((job) =>
        runJobPipeline({
          job,
          resumeMaterial,
          settings,
          storage,
        }),
      ),
    )
  }

  return {
    jobs,
    selectedJobId,
    selectedJob,
    scanning,
    paused,
    stats,
    setJobs,
    selectJob,
    skipSelected,
    markSelectedSent,
    scanCurrentPage,
    scanPages,
    updateSelected,
  }
})
