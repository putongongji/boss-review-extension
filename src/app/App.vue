<template>
  <aside class="brs-shell" aria-label="Boss 人审助手">
    <header class="brs-header">
      <div>
        <p class="brs-kicker">Boss 人审助手</p>
        <h1>右侧审核面板</h1>
      </div>
      <p class="brs-subtitle">先审后发，保留人工确认边界。</p>
    </header>

    <main class="brs-panel">
      <ScanControls />
      <StatsBar />
      <section class="brs-workspace" aria-label="岗位审核工作区">
        <JobQueue />
        <JobReview />
      </section>
      <SettingsPanel />
    </main>
  </aside>
</template>

<script setup lang="ts">
import JobQueue from '@/app/components/JobQueue.vue'
import JobReview from '@/app/components/JobReview.vue'
import ScanControls from '@/app/components/ScanControls.vue'
import SettingsPanel from '@/app/components/SettingsPanel.vue'
import StatsBar from '@/app/components/StatsBar.vue'
</script>
