<template>
  <section class="brs-section brs-queue" aria-label="岗位队列">
    <div class="brs-section-heading">
      <h2>待审岗位</h2>
      <span>{{ store.jobs.length }}</span>
    </div>

    <div v-if="store.jobs.length === 0" class="brs-empty">
      <p>暂无待审岗位</p>
      <span>点击扫描后，岗位会显示在这里。</span>
    </div>

    <div v-else class="brs-job-list">
      <button
        v-for="job in store.jobs"
        :key="job.jobId"
        class="brs-job-row"
        :class="{ 'is-selected': job.jobId === store.selectedJobId }"
        type="button"
        @click="store.selectJob(job.jobId)"
      >
        <span class="brs-job-row-main">
          <strong>{{ job.title }}</strong>
          <small>{{ job.company }}</small>
        </span>
        <span class="brs-job-row-meta">
          <span>{{ job.salary || '薪资未标注' }}</span>
          <span>{{ statusLabel(job.statusMessage) }}</span>
        </span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useReviewStore } from '@/app/stores/reviewStore'

const store = useReviewStore()

function statusLabel(statusMessage: string): string {
  return statusMessage || '待审'
}
</script>
