import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import App from '@/app/App.vue'

describe('App', () => {
  it('renders the review panel controls', () => {
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
})
