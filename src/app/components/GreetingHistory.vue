<template>
  <section class="brs-section brs-history" aria-label="打招呼历史记录">
    <div v-if="store.greetingLogs.length > 0" class="brs-history-list">
      <button
        v-for="record in store.greetingLogs"
        :key="record.id"
        class="brs-history-item"
        type="button"
        @click="toggleExpand(record.id)"
      >
        <div class="brs-history-item-head">
          <strong>{{ record.job.company }} · {{ record.job.title }}</strong>
          <span
            class="brs-history-pill"
            :class="{
              'is-success': record.customGreetingSent,
              'is-failed': record.customGreetingError && !record.customGreetingSent,
              'is-default': !record.customGreetingSent && !record.customGreetingError,
            }"
          >
            {{ statusLabel(record) }}
          </span>
        </div>
        <div class="brs-history-meta">
          <span>{{ formatTime(record.createdAt) }}</span>
          <span v-if="record.resultMessage">{{ record.resultMessage }}</span>
        </div>
        <div v-if="expandedId === record.id && record.customGreetingContent" class="brs-history-content">
          <h4>自定义内容</h4>
          <p>{{ record.customGreetingContent }}</p>
        </div>
        <div v-if="expandedId === record.id && record.customGreetingError" class="brs-history-error">
          <h4>错误</h4>
          <p>{{ record.customGreetingError }}</p>
        </div>
      </button>
    </div>
    <div v-else class="brs-empty">
      <p>暂无招呼记录</p>
      <span>成功打招呼后会自动记录。</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import type { GreetingLogEntry } from '@/core/types'
import { useReviewStore } from '@/app/stores/reviewStore'

const store = useReviewStore()
const expandedId = ref<string | null>(null)

function toggleExpand(id: string): void {
  expandedId.value = expandedId.value === id ? null : id
}

function statusLabel(record: GreetingLogEntry): string {
  if (record.customGreetingSent) return '自定义已发'
  if (record.customGreetingError) return '失败'
  return '仅默认'
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>
