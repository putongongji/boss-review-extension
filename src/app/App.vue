<template>
  <button v-if="hidden && !closed" class="brs-restore-button" type="button" @click="hidden = false">Boss 助手</button>
  <aside v-if="!hidden && !closed" class="brs-shell" :style="panelStyle" aria-label="Boss 人审助手">
    <header class="brs-header" @mousedown="startDrag">
      <div>
        <p class="brs-kicker">Boss 人审助手</p>
        <h1>右侧审核面板</h1>
      </div>
      <div class="brs-header-actions">
        <p class="brs-subtitle">当前页自动同步。</p>
        <button
          class="brs-icon-button"
          type="button"
          :title="store.pluginEnabled ? '停用插件' : '启用插件'"
          @click="store.togglePlugin"
        >
          <span class="brs-power-dot" :class="{ 'is-on': store.pluginEnabled }"></span>
        </button>
        <button class="brs-icon-button" type="button" aria-label="隐藏助手" title="隐藏助手" @click="hidden = true">
          <PanelRightCloseIcon aria-hidden="true" :size="15" />
        </button>
        <button class="brs-icon-button" type="button" aria-label="停用本页助手" title="停用本页助手" @click="closed = true">
          <XIcon aria-hidden="true" :size="15" />
        </button>
      </div>
    </header>

    <main class="brs-panel" :class="{ 'brs-panel-disabled': !store.pluginEnabled }">
      <ScanControls />
      <template v-if="store.showHistory">
        <GreetingHistory />
      </template>
      <template v-else>
        <section class="brs-workspace" aria-label="岗位审核工作区">
          <JobQueue />
          <JobReview />
        </section>
      </template>
    </main>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { PanelRightCloseIcon, XIcon } from 'lucide-vue-next'

import GreetingHistory from '@/app/components/GreetingHistory.vue'
import JobQueue from '@/app/components/JobQueue.vue'
import JobReview from '@/app/components/JobReview.vue'
import ScanControls from '@/app/components/ScanControls.vue'
import { useReviewStore } from '@/app/stores/reviewStore'

const hidden = ref(false)
const closed = ref(false)
const panelX = ref(0)
const panelY = ref(0)
const store = useReviewStore()
let dragStart: { pointerX: number; pointerY: number; panelX: number; panelY: number } | null = null

const panelStyle = computed(() => ({
  transform: `translate(${panelX.value}px, ${panelY.value}px)`,
}))

onMounted(() => {
  void store.loadJobs()
  void store.loadSettings()
  store.startAutoSync()
})

onUnmounted(() => {
  store.stopAutoSync()
  stopDrag()
})

watch(closed, (isClosed) => {
  if (isClosed) {
    store.stopAutoSync()
  }
})

watch(hidden, (isHidden) => {
  if (closed.value) return

  if (isHidden) {
    store.stopAutoSync()
  } else {
    store.startAutoSync()
  }
})

function startDrag(event: MouseEvent): void {
  if (event.button !== 0 || event.target instanceof Element && event.target.closest('button')) return

  dragStart = {
    pointerX: event.clientX,
    pointerY: event.clientY,
    panelX: panelX.value,
    panelY: panelY.value,
  }
  document.addEventListener('mousemove', dragPanel)
  document.addEventListener('mouseup', stopDrag)
  event.preventDefault()
}

function dragPanel(event: MouseEvent): void {
  if (!dragStart) return

  panelX.value = dragStart.panelX + event.clientX - dragStart.pointerX
  panelY.value = dragStart.panelY + event.clientY - dragStart.pointerY
}

function stopDrag(): void {
  dragStart = null
  document.removeEventListener('mousemove', dragPanel)
  document.removeEventListener('mouseup', stopDrag)
}
</script>
