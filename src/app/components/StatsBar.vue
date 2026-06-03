<template>
  <section class="brs-stats" aria-label="审核统计">
    <div class="brs-stat">
      <span class="brs-stat-value">{{ store.stats.captured }}</span>
      <span class="brs-stat-label">已采集</span>
    </div>
    <div class="brs-stat">
      <span class="brs-stat-value">{{ store.stats.high }}</span>
      <span class="brs-stat-label">高匹配</span>
    </div>
    <div class="brs-stat">
      <span class="brs-stat-value brs-stat-accent">{{ store.stats.review }}</span>
      <span class="brs-stat-label">待审</span>
    </div>
    <div class="brs-stat">
      <span class="brs-stat-value">{{ store.stats.sent }}</span>
      <span class="brs-stat-label">已发送</span>
    </div>
    <div class="brs-stat">
      <span class="brs-stat-value">{{ store.stats.skipped }}</span>
      <span class="brs-stat-label">已跳过</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useReviewStore } from '@/app/stores/reviewStore'

const store = useReviewStore()
</script>
