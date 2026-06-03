import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { defineContentScript } from 'wxt/utils/define-content-script'
import { injectScript } from 'wxt/utils/inject-script'

import App from '@/app/App.vue'
import '@/styles/main.css'

const ROOT_ID = 'boss-review-sender-root'

function mountApp(): void {
  if (document.getElementById(ROOT_ID)) return

  const root = document.createElement('div')
  root.id = ROOT_ID
  document.body.append(root)

  const app = createApp(App)
  app.use(createPinia())
  app.mount(root)
}

export default defineContentScript({
  matches: ['*://zhipin.com/*', '*://*.zhipin.com/*'],
  async main() {
    mountApp()
    await injectScript('/main-world.js', { keepInDom: true })
  },
})
