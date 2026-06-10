<template>
  <section class="brs-section brs-review" aria-label="岗位审核详情">
    <template v-if="store.selectedJob">
      <div class="brs-review-scroll">
        <div class="brs-review-head">
          <div class="brs-review-title">
            <h2>{{ store.selectedJob.title }}</h2>
            <p>{{ store.selectedJob.company }}</p>
          </div>
          <span class="brs-status-pill">{{ statusLabel }}</span>
        </div>

        <div v-if="store.selectedJob.status === 'failed'" class="brs-error-block" role="alert">
          <strong>操作失败</strong>
          <p>{{ store.selectedJob.statusMessage }}</p>
        </div>

        <div v-else class="brs-result-block">
          <strong>结果</strong>
          <p>{{ store.selectedJob.statusMessage }}</p>
        </div>

        <dl class="brs-job-facts">
          <div>
            <dt>薪资</dt>
            <dd>{{ store.selectedJob.salary || '未标注' }}</dd>
          </div>
          <div>
            <dt>地点</dt>
            <dd>{{ store.selectedJob.location || '未标注' }}</dd>
          </div>
          <div>
            <dt>经验</dt>
            <dd>{{ store.selectedJob.experience || '未标注' }}</dd>
          </div>
          <div>
            <dt>学历</dt>
            <dd>{{ store.selectedJob.degree || '未标注' }}</dd>
          </div>
          <div>
            <dt>招聘者</dt>
            <dd>{{ recruiterText }}</dd>
          </div>
          <div>
            <dt>工作地点</dt>
            <dd>{{ store.selectedJob.workAddress || '未标注' }}</dd>
          </div>
        </dl>

        <div class="brs-review-block">
          <h3>JD 内容</h3>
          <p class="brs-jd-text">{{ store.selectedJob.jdText || '点击左侧岗位后读取 JD。' }}</p>
        </div>

        <div class="brs-review-block">
          <h3>岗位关键词</h3>
          <div v-if="keywordTags.length" class="brs-tag-list">
            <span v-for="tag in keywordTags" :key="tag">{{ tag }}</span>
          </div>
          <p v-else>暂无关键词。</p>
        </div>

        <div class="brs-review-block">
          <h3>打招呼</h3>
          <template v-if="store.selectedJob.status === 'sent'">
            <div class="brs-result-block">
              <strong>已打招呼 ✓</strong>
              <p>{{ store.selectedJob.statusMessage }}</p>
            </div>
          </template>
          <template v-else>
            <label class="brs-toggle-row">
              <input v-model="store.customGreetingEnabled" type="checkbox" :disabled="store.selectedJob.status === 'enriching'" />
              <span>默认打招呼后，延迟发送自定义内容</span>
            </label>
            <label class="brs-field">
              <span>自定义内容</span>
              <textarea v-model="store.greetingText" rows="3" placeholder="关闭开关时不发送；打开后会在默认打招呼成功后延迟发送。" :disabled="store.selectedJob.status === 'enriching'" />
            </label>
            <div class="brs-inline-actions">
              <button
                class="brs-button brs-button-ghost"
                type="button"
                :disabled="!store.selectedJob.jdText || store.generatingGreeting"
                @click="store.generateGreetingFromJD"
              >
                {{ store.generatingGreeting ? '生成中...' : '智能生成' }}
              </button>
            </div>
            <div class="brs-review-actions">
              <button
                class="brs-button brs-button-primary"
                type="button"
                :disabled="store.selectedJob.status === 'enriching' || !store.pluginEnabled"
                @click="store.greetSelectedJob"
              >
                {{ store.selectedJob.status === 'enriching' ? '打招呼中...' : '立即沟通' }}
              </button>
            </div>
          </template>
        </div>
      </div>
    </template>

    <div v-else class="brs-empty brs-empty-review">
      <p>选择一个岗位</p>
      <span>左侧岗位来自当前 Boss 页面，点击后读取 JD。</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useReviewStore } from '@/app/stores/reviewStore'

const store = useReviewStore()
const recruiterText = computed(() =>
  [store.selectedJob?.recruiterName, store.selectedJob?.recruiterTitle].filter(Boolean).join(' · ') || '未标注',
)
const keywordTags = computed(() => store.selectedJob?.skills?.filter(Boolean).slice(0, 8) ?? [])
const statusLabel = computed(() => {
  const status = store.selectedJob?.status
  const labels: Record<string, string> = {
    captured: '待读取',
    enriching: '处理中',
    drafted: '已读取',
    reviewing: '已沟通',
    sent: '已打招呼',
    failed: '失败',
  }
  return status ? labels[status] ?? status : ''
})
</script>
