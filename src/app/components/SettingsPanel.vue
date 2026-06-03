<template>
  <section class="brs-section brs-settings" aria-label="设置">
    <details>
      <summary>设置</summary>
      <div class="brs-settings-body">
        <label class="brs-field">
          <span>简历素材</span>
          <textarea v-model="resume" rows="6" placeholder="粘贴你的简历素材，生成打招呼语时只使用这里的证据。" />
        </label>
        <div class="brs-field-grid">
          <label class="brs-field">
            <span>最大页数</span>
            <input v-model.number="maxPages" min="1" max="10" type="number" />
          </label>
          <label class="brs-field">
            <span>最大岗位数</span>
            <input v-model.number="maxJobs" min="1" max="150" type="number" />
          </label>
        </div>
        <button class="brs-button brs-button-secondary" type="button" @click="save">保存设置</button>
      </div>
    </details>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { ExtensionStorage } from '@/core/storage'

const storage = new ExtensionStorage()
const resume = ref('')
const maxPages = ref(5)
const maxJobs = ref(100)

onMounted(async () => {
  resume.value = await storage.getResumeMaterial()
  const settings = await storage.getSettings()
  maxPages.value = settings.maxPages
  maxJobs.value = settings.maxJobs
})

async function save(): Promise<void> {
  await storage.saveResumeMaterial(resume.value)
  await storage.saveSettings({ maxPages: maxPages.value, maxJobs: maxJobs.value })
}
</script>
