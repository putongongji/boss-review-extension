import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'

import App from '@/app/App.vue'
import { useReviewStore } from '@/app/stores/reviewStore'
import { DEFAULT_SETTINGS } from '@/core/defaults'
import type { ReviewJob } from '@/core/types'

const mocks = vi.hoisted(() => ({
  ExtensionStorage: vi.fn(),
}))

vi.mock('@/core/storage', () => ({
  ExtensionStorage: mocks.ExtensionStorage,
}))

describe('App', () => {
  it('renders the review panel controls', () => {
    mocks.ExtensionStorage.mockImplementation(() => ({
      getSettings: vi.fn().mockResolvedValue(DEFAULT_SETTINGS),
      getResumeMaterial: vi.fn().mockResolvedValue(''),
      saveSettings: vi.fn(),
      saveResumeMaterial: vi.fn(),
    }))
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia()],
      },
    })

    expect(wrapper.text()).toContain('Boss 人审助手')
    expect(wrapper.text()).toContain('扫描当前页')
    expect(wrapper.text()).toContain('连续扫描')
    expect(wrapper.text()).toContain('待审')
  })

  it('marks the selected queue row semantically', async () => {
    mocks.ExtensionStorage.mockImplementation(() => ({
      getSettings: vi.fn().mockResolvedValue(DEFAULT_SETTINGS),
      getResumeMaterial: vi.fn().mockResolvedValue(''),
      saveSettings: vi.fn(),
      saveResumeMaterial: vi.fn(),
    }))
    const pinia = createPinia()
    const wrapper = mount(App, {
      global: {
        plugins: [pinia],
      },
    })
    const store = useReviewStore()

    store.setJobs([createReviewJob('job-1'), createReviewJob('job-2')])
    await wrapper.vm.$nextTick()

    const rows = wrapper.findAll('.brs-job-row')
    expect(rows[0].attributes('aria-current')).toBe('true')
    expect(rows[1].attributes('aria-current')).toBeUndefined()
  })
})

function createReviewJob(jobId: string): ReviewJob {
  return {
    jobId,
    title: 'AI 产品经理',
    company: '示例科技',
    skills: [],
    welfare: [],
    sourceUrl: 'https://www.zhipin.com',
    status: 'drafted',
    statusMessage: '已生成草稿',
    capturedAt: Date.now(),
  }
}
