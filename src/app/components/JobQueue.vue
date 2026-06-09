<template>
  <section class="brs-section brs-queue" aria-label="岗位队列">
    <div class="brs-section-heading">
      <h2>待审岗位</h2>
      <span>{{ store.filteredJobs.length }}/{{ store.jobs.length }}</span>
    </div>

    <div v-if="store.jobs.length === 0" class="brs-empty">
      <p>暂无待审岗位</p>
      <span>打开 Boss 职位列表后会自动同步。</span>
    </div>
    <div v-else-if="store.filteredJobs.length === 0" class="brs-empty">
      <p>没有匹配岗位</p>
      <span>调整上方筛选关键词。</span>
    </div>

    <div v-else class="brs-job-list">
      <button
        v-for="job in store.filteredJobs"
        :key="job.jobId"
        class="brs-job-row"
        :class="{
          'is-selected': job.jobId === store.selectedJobId,
          'is-sent': job.status === 'sent',
          'is-failed': job.status === 'failed',
          'is-processing': job.status === 'enriching',
        }"
        type="button"
        :aria-current="job.jobId === store.selectedJobId ? 'true' : undefined"
        @click="store.selectJob(job.jobId)"
      >
        <span class="brs-job-row-main">
          <strong>{{ job.title }}</strong>
          <small>{{ job.company }}</small>
        </span>
        <span class="brs-job-row-meta">
          <span>{{ job.salary || '薪资未标注' }}</span>
          <span>{{ [job.location, job.experience, job.degree].filter(Boolean).join(' · ') || '基础信息待同步' }}</span>
          <span>{{ statusLabel(job.status) }}</span>
        </span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useReviewStore } from '@/app/stores/reviewStore'

const store = useReviewStore()

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    captured: '待读取',
    enriching: '处理中',
    drafted: '已读取',
    reviewing: '已沟通',
    sent: '已打招呼',
    failed: '失败',
  }
  return labels[status] ?? '待审'
}
</script>
