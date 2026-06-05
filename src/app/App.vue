<template>
  <button v-if="hidden && !closed" class="brs-restore-button" type="button" @click="hidden = false">Boss 助手</button>
  <aside v-if="!hidden && !closed" class="brs-shell" aria-label="Boss 人审助手">
    <header class="brs-header">
      <div>
        <p class="brs-kicker">Boss 人审助手</p>
        <h1>右侧审核面板</h1>
      </div>
      <div class="brs-header-actions">
        <p class="brs-subtitle">当前页自动同步。</p>
        <button class="brs-icon-button" type="button" aria-label="隐藏助手" title="隐藏助手" @click="hidden = true">
          <PanelRightCloseIcon aria-hidden="true" :size="15" />
        </button>
        <button class="brs-icon-button" type="button" aria-label="关闭助手" title="关闭助手" @click="closed = true">
          <XIcon aria-hidden="true" :size="15" />
        </button>
      </div>
    </header>

    <main class="brs-panel">
      <ScanControls />
      <section class="brs-workspace" aria-label="岗位审核工作区">
        <JobQueue />
        <JobReview />
      </section>
    </main>
  </aside>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { PanelRightCloseIcon, XIcon } from 'lucide-vue-next'

import JobQueue from '@/app/components/JobQueue.vue'
import JobReview from '@/app/components/JobReview.vue'
import ScanControls from '@/app/components/ScanControls.vue'
import { useReviewStore } from '@/app/stores/reviewStore'

const hidden = ref(false)
const closed = ref(false)
const store = useReviewStore()

onMounted(() => {
  void store.loadJobs()
  store.startAutoSync()
})

onUnmounted(() => {
  store.stopAutoSync()
})

watch(closed, (isClosed) => {
  if (isClosed) {
    store.stopAutoSync()
  }
})
</script>
