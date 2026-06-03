import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { ReviewJob } from '@/core/types'

export const useReviewStore = defineStore('review', () => {
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

  function updateSelected(patch: Partial<ReviewJob>): void {
    jobs.value = jobs.value.map((job) => (job.jobId === selectedJobId.value ? { ...job, ...patch } : job))
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
    updateSelected,
  }
})
