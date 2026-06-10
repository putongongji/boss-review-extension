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
        :disabled="store.scanning || !store.pluginEnabled"
        @click="store.scanCurrentPage"
      >
        刷新
      </button>
      <button
        class="brs-button brs-button-secondary"
        type="button"
        @click="store.toggleHistory"
      >
        {{ store.showHistory ? '返回岗位' : '招呼记录' }}
      </button>
      <button class="brs-button brs-button-secondary" type="button" @click="store.exportGreetingLogs">
        导出记录
      </button>
    </div>

    <div v-if="store.autoGreeting || store.autoGreetProgress" class="brs-auto-greet-bar" role="status">
      <template v-if="store.autoGreeting">
        <span class="brs-auto-greet-progress">{{ store.autoGreetProgress }}</span>
        <button class="brs-button brs-button-danger" type="button" @click="store.stopAutoGreet">
          停止
        </button>
      </template>
      <template v-else>
        <span class="brs-auto-greet-result">{{ store.autoGreetProgress }}</span>
      </template>
    </div>

    <div v-if="!store.autoGreeting" class="brs-control-actions">
      <button
        class="brs-button brs-button-primary"
        type="button"
        :disabled="store.scanning || store.filteredJobs.length === 0 || !store.pluginEnabled"
        @click="store.startAutoGreet"
      >
        自动打招呼 ({{ store.filteredJobs.filter(j => j.status !== 'sent' && j.status !== 'failed').length }})
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

    <details class="brs-settings">
      <summary>API 设置</summary>
      <div class="brs-settings-body">
        <label class="brs-field">
          <span>DeepSeek API Key</span>
          <small>用于智能生成打招呼语</small>
          <input
            :value="store.llmApiKey"
            type="password"
            placeholder="sk-..."
            @change="onApiKeyChange"
          />
        </label>
        <p class="brs-settings-note">模型：deepseek-chat（默认）</p>
        <label class="brs-field">
          <span>我的背景（简历）</span>
          <small>Markdown 格式，用于智能生成打招呼语</small>
          <textarea
            :value="store.resumeMaterial"
            rows="5"
            placeholder="输入你的工作经历、技能、项目经验等"
            @change="onResumeChange"
          />
        </label>
      </div>
    </details>
  </section>
</template>

<script setup lang="ts">
import { useReviewStore } from '@/app/stores/reviewStore'

const store = useReviewStore()

function onApiKeyChange(event: Event): void {
  const input = event.target as HTMLInputElement
  void store.saveApiKey(input.value)
}

function onResumeChange(event: Event): void {
  const textarea = event.target as HTMLTextAreaElement
  void store.saveResumeMaterial(textarea.value)
}
</script>
