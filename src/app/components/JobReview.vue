<template>
  <section class="brs-section brs-review" aria-label="岗位审核详情">
    <template v-if="store.selectedJob">
      <div class="brs-review-head">
        <div class="brs-review-title">
          <h2>{{ store.selectedJob.title }}</h2>
          <p>{{ store.selectedJob.company }}</p>
        </div>
        <span class="brs-status-pill">{{ store.selectedJob.statusMessage }}</span>
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
      </dl>

      <div class="brs-review-block">
        <h3>JD 摘要</h3>
        <p>{{ store.selectedJob.greeting?.jdSummary || '等待生成岗位摘要。' }}</p>
      </div>

      <div class="brs-review-block">
        <h3>匹配证据</h3>
        <ul v-if="store.selectedJob.greeting?.matchedEvidence.length" class="brs-evidence-list">
          <li v-for="evidence in store.selectedJob.greeting.matchedEvidence" :key="evidence">
            {{ evidence }}
          </li>
        </ul>
        <p v-else>暂无匹配证据。</p>
      </div>

      <div class="brs-review-block">
        <div class="brs-block-title-row">
          <h3>招呼语草稿</h3>
          <div class="brs-inline-actions">
            <button class="brs-icon-button" type="button" aria-label="重写招呼语" title="重写招呼语">
              <RefreshCcwIcon aria-hidden="true" :size="15" />
            </button>
            <button class="brs-icon-button" type="button" aria-label="复制招呼语" title="复制招呼语">
              <CopyIcon aria-hidden="true" :size="15" />
            </button>
          </div>
        </div>
        <p class="brs-greeting-draft">
          {{ store.selectedJob.greeting?.greeting || '等待生成招呼语草稿。' }}
        </p>
      </div>

      <div class="brs-review-actions">
        <button class="brs-button brs-button-primary" type="button">发送</button>
        <button class="brs-button brs-button-secondary" type="button" @click="store.skipSelected">跳过</button>
      </div>
    </template>

    <div v-else class="brs-empty brs-empty-review">
      <p>选择一个岗位开始审核</p>
      <span>扫描结果进入队列后，可在这里查看摘要、证据和招呼语。</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { CopyIcon, RefreshCcwIcon } from 'lucide-vue-next'

import { useReviewStore } from '@/app/stores/reviewStore'

const store = useReviewStore()
</script>
