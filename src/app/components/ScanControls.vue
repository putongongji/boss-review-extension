<template>
  <section class="brs-section brs-scan-controls" aria-label="扫描控制">
    <div class="brs-control-copy">
      <h2>当前页岗位</h2>
      <p>{{ store.syncMessage }}</p>
    </div>

    <div class="brs-control-actions">
      <button
        class="brs-button brs-button-secondary"
        type="button"
        :disabled="store.scanning"
        @click="store.scanCurrentPage"
      >
        刷新
      </button>
      <button class="brs-button brs-button-secondary" type="button" @click="store.exportGreetingLogs">
        导出记录
      </button>
    </div>

    <div class="brs-filter-grid is-two" aria-label="岗位筛选">
      <label class="brs-field">
        <span>岗位名称</span>
        <input v-model="store.titleFilter" type="search" placeholder="如 AI 产品" />
      </label>
      <label class="brs-field">
        <span>地点</span>
        <input v-model="store.locationFilter" type="search" placeholder="如 杭州 西湖" />
      </label>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useReviewStore } from '@/app/stores/reviewStore'

const store = useReviewStore()
</script>
