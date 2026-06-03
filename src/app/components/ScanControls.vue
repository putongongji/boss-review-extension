<template>
  <section class="brs-section brs-scan-controls" aria-label="扫描控制">
    <div class="brs-control-copy">
      <h2>采集队列</h2>
      <p>从当前 Boss 页面收集岗位，进入人工审核。</p>
    </div>

    <div class="brs-control-actions">
      <button
        class="brs-button brs-button-secondary"
        type="button"
        :disabled="store.scanning"
        @click="store.scanCurrentPage"
      >
        扫描当前页
      </button>
      <button class="brs-button brs-button-primary" type="button" :disabled="store.scanning" @click="store.scanPages">
        连续扫描
      </button>
      <button
        class="brs-icon-button"
        type="button"
        aria-label="暂停扫描"
        title="暂停扫描"
        :disabled="!store.scanning"
      >
        <PauseIcon aria-hidden="true" :size="16" />
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { PauseIcon } from 'lucide-vue-next'

import { useReviewStore } from '@/app/stores/reviewStore'

const store = useReviewStore()
</script>
