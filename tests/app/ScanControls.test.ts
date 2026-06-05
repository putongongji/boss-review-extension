import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ScanControls from '@/app/components/ScanControls.vue'
import { useReviewStore } from '@/app/stores/reviewStore'

const mocks = vi.hoisted(() => ({
  ExtensionStorage: vi.fn(),
}))

vi.mock('@/core/storage', () => ({
  ExtensionStorage: mocks.ExtensionStorage,
}))

describe('ScanControls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.ExtensionStorage.mockImplementation(() => ({
      getSettings: vi.fn(),
      getResumeMaterial: vi.fn(),
    }))
    setActivePinia(createPinia())
  })

  it('calls store scan actions from scan buttons', async () => {
    const wrapper = mount(ScanControls)
    const store = useReviewStore()
    const scanCurrentPage = vi.spyOn(store, 'scanCurrentPage').mockResolvedValue()
    const buttons = wrapper.findAll('button')

    await buttons[0].trigger('click')

    expect(scanCurrentPage).toHaveBeenCalledOnce()
  })

  it('disables refresh while scanning', async () => {
    const wrapper = mount(ScanControls)
    const store = useReviewStore()
    const buttons = wrapper.findAll('button')

    store.scanning = true
    await wrapper.vm.$nextTick()

    expect(buttons[0].attributes('disabled')).toBeDefined()
  })
})
